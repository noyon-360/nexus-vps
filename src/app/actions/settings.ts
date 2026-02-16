"use server";

import prisma from "@/lib/prisma";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getSystemSettings() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        console.log("[getSystemSettings] Fetching for email:", session.user.email);
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { systemSettings: true }
        });

        if (!user) {
            console.log("[getSystemSettings] User not found for email:", session.user.email);
            return { success: false, message: "User not found" };
        }

        console.log("[getSystemSettings] Settings found in DB:", user.systemSettings ? "Yes" : "No", user.systemSettings?.externalDbUrl);
        return { success: true, settings: user.systemSettings };
    } catch (error: any) {
        console.error("[getSystemSettings] Failed to fetch system settings:", error);
        return { success: false, message: error.message };
    }
}

export async function updateSystemSettings(data: {
    externalDbUrl?: string | null;
    externalDbType?: string | null;
}) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        console.log("[updateSystemSettings] Saving for email:", session.user.email);
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return { success: false, message: "User not found" };
        }

        console.log("[updateSystemSettings] Attempting upsert for userId:", user.id);
        const settings = await prisma.systemSettings.upsert({
            where: { userId: user.id },
            update: {
                externalDbUrl: data.externalDbUrl,
                externalDbType: data.externalDbType,
            },
            create: {
                userId: user.id,
                externalDbUrl: data.externalDbUrl,
                externalDbType: data.externalDbType,
            }
        });

        const verification = await prisma.systemSettings.findUnique({
            where: { userId: user.id }
        });
        console.log("[updateSystemSettings] Settings verified in DB after save:", verification ? "Found" : "NOT FOUND", verification?.externalDbUrl);

        console.log("[updateSystemSettings] Settings updated successfully for user:", user.id, "URL:", data.externalDbUrl);
        revalidatePath("/dashboard");
        revalidatePath("/", "layout");
        return { success: true, settings };
    } catch (error: any) {
        console.error("[updateSystemSettings] Failed to update system settings:", error);
        return { success: false, message: error.message };
    }
}

export async function testDatabaseConnection(url: string, type: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        if (type === 'postgresql') {
            const { Pool } = await import('pg');
            const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            await pool.end();
            return { success: true, message: "PostgreSQL connection successful" };
        } else {
            return { success: false, message: "Only PostgreSQL is supported" };
        }
    } catch (error: any) {
        console.error("Database connection test failed:", error);
        return { success: false, message: `Connection failed: ${error.message}` };
    }
}

export async function migrateData(direction: 'to_external' | 'to_local') {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { systemSettings: true }
        });

        if (!user) {
            return { success: false, message: "User not found" };
        }

        if (!user.systemSettings?.externalDbUrl) {
            return { success: false, message: "External database not configured" };
        }

        const externalUrl = user.systemSettings.externalDbUrl;

        // Specialized logic to get a fresh client for the target
        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: externalUrl });
        const adapter = new PrismaPg(pool);
        const externalPrisma = new PrismaClient({ adapter });

        const sourceDb = direction === 'to_external' ? prisma : externalPrisma;
        const targetDb = direction === 'to_external' ? externalPrisma : prisma;

        // 1. Sync User record first to satisfy FK constraints
        const { systemSettings, ...userData } = user;
        await targetDb.user.upsert({
            where: { email: user.email },
            update: userData as any,
            create: userData as any,
        });

        // Fetch data from source
        const [vpsList, presets, requests, clients] = await Promise.all([
            sourceDb.vps.findMany({ where: { userId: user.id }, include: { deploys: true } }),
            sourceDb.credentialPreset.findMany({ where: { userId: user.id } }),
            sourceDb.credentialRequest.findMany(), // Requests are global in this schema setup
            sourceDb.client.findMany({ where: { userId: user.id } }),
        ]);

        // Migrate VPS and their Deploys
        for (const vps of vpsList) {
            const { id, deploys, ...vpsData } = vps as any;
            await targetDb.vps.upsert({
                where: { userId_ip: { userId: user.id, ip: vps.ip } },
                update: vpsData as any,
                create: { ...vpsData, userId: user.id } as any,
            });

            // Migrate Deploys for this VPS
            if (deploys && deploys.length > 0) {
                // Get the newly created/updated VPS id in target
                const targetVps = await targetDb.vps.findUnique({
                    where: { userId_ip: { userId: user.id, ip: vps.ip } }
                });

                if (targetVps) {
                    for (const deploy of deploys) {
                        const { id: dId, vpsId, ...deployData } = deploy;
                        // For deploys, we don't have a unique constraint other than ID, 
                        // but IDs might collide or change. We'll use a simple create for now
                        // or check if it already exists by some other means.
                        // Assuming we want to avoid duplicates if re-migrating:
                        const existingDeploy = await targetDb.deploy.findFirst({
                            where: { vpsId: targetVps.id, appName: deploy.appName, createdAt: deploy.createdAt }
                        });

                        if (!existingDeploy) {
                            await targetDb.deploy.create({
                                data: { ...deployData, vpsId: targetVps.id } as any
                            });
                        }
                    }
                }
            }
        }

        // Migrate Presets
        for (const preset of presets) {
            const { id, ...presetData } = preset;
            await targetDb.credentialPreset.upsert({
                where: { userId_name: { userId: user.id, name: preset.name } },
                update: presetData as any,
                create: { ...presetData, userId: user.id } as any,
            });
        }

        // Migrate Requests
        for (const req of requests) {
            const { id, ...reqData } = req;
            await targetDb.credentialRequest.upsert({
                where: { clientName: req.clientName },
                update: reqData as any,
                create: reqData as any,
            });
        }

        // Migrate Clients
        for (const client of clients) {
            const { id, ...clientData } = client;
            await targetDb.client.upsert({
                where: { clientName: client.clientName },
                update: clientData as any,
                create: { ...clientData, userId: user.id } as any,
            });
        }

        // Close external connection
        await externalPrisma.$disconnect();
        await pool.end();

        revalidatePath("/dashboard");
        return { success: true, message: `Data migrated successfully ${direction === 'to_external' ? 'to your personal' : 'to the default'} database.` };
    } catch (error: any) {
        console.error("Migration failed:", error);
        let message = `Migration failed: ${error.message}`;
        if (error.message.includes("does not exist")) {
            message += " (Please try clicking 'SYNC SCHEMA' first to initialize your external database)";
        }
        return { success: false, message };
    }
}

export async function initializeDatabase(url: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    try {
        // We use child_process to run prisma db push with a temporary DATABASE_URL env var
        // This ensures the target database has the correct schema
        const env = { ...process.env, DATABASE_URL: url };
        const { stdout } = await execAsync('npx prisma db push --accept-data-loss', { env });

        console.log("Prisma db push output:", stdout);
        return { success: true, message: "Database schema synchronized successfully." };
    } catch (error: any) {
        console.error("Initialization error:", error);
        return { success: false, message: error.message || "Failed to initialize database schema." };
    }
}
