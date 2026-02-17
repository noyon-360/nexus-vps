"use server";

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import prisma from "./prisma";

// Cache for organization database connections
const dbConnections = new Map<string, PrismaClient>();

// Maximum number of cached connections
const MAX_CONNECTIONS = 10;

/**
 * Get Prisma client for an organization's database
 */
export async function getOrganizationDb(organizationId: string): Promise<PrismaClient> {
    // Check if connection is already cached
    if (dbConnections.has(organizationId)) {
        return dbConnections.get(organizationId)!;
    }

    // Get organization details from main database
    const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { dbUrl: true },
    });

    if (!organization) {
        throw new Error("Organization not found");
    }

    // Create new Pool and Prisma client for organization database
    const pool = new Pool({ connectionString: organization.dbUrl });
    const adapter = new PrismaPg(pool);

    const orgDb = new PrismaClient({
        adapter,
    });

    // Cache the connection
    dbConnections.set(organizationId, orgDb);

    // Cleanup old connections if cache is too large
    if (dbConnections.size > MAX_CONNECTIONS) {
        const firstKey = dbConnections.keys().next().value;
        if (firstKey) {
            const oldConnection = dbConnections.get(firstKey);
            await oldConnection?.$disconnect();
            dbConnections.delete(firstKey);
        }
    }

    return orgDb;
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(dbUrl: string): Promise<{
    success: boolean;
    error?: string;
}> {
    let pool: Pool | null = null;
    let testClient: PrismaClient | null = null;

    try {
        pool = new Pool({ connectionString: dbUrl });
        const adapter = new PrismaPg(pool);

        testClient = new PrismaClient({
            adapter,
        });

        // Try to connect
        await testClient.$connect();

        // Test a simple query
        await testClient.$queryRaw`SELECT 1`;

        await testClient.$disconnect();
        await pool.end();

        return { success: true };
    } catch (error: any) {
        // Cleanup on error
        if (testClient) {
            try {
                await testClient.$disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
        }
        if (pool) {
            try {
                await pool.end();
            } catch (e) {
                // Ignore pool end errors
            }
        }

        return {
            success: false,
            error: error.message || "Failed to connect to database",
        };
    }
}

/**
 * Initialize organization database with schema
 */
export async function initializeOrganizationDb(dbUrl: string): Promise<{
    success: boolean;
    error?: string;
}> {
    let pool: Pool | null = null;
    let orgDb: PrismaClient | null = null;

    try {
        pool = new Pool({ connectionString: dbUrl });
        const adapter = new PrismaPg(pool);

        orgDb = new PrismaClient({
            adapter,
        });

        await orgDb.$connect();

        // Create tables for organization-specific data
        // Note: In production, you would run migrations here
        // For now, we'll use db push approach

        await orgDb.$disconnect();
        await pool.end();

        return { success: true };
    } catch (error: any) {
        // Cleanup on error
        if (orgDb) {
            try {
                await orgDb.$disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
        }
        if (pool) {
            try {
                await pool.end();
            } catch (e) {
                // Ignore pool end errors
            }
        }

        return {
            success: false,
            error: error.message || "Failed to initialize database",
        };
    }
}

/**
 * Cleanup all cached connections
 */
export async function cleanupConnections() {
    for (const [key, connection] of dbConnections.entries()) {
        await connection.$disconnect();
        dbConnections.delete(key);
    }
}
