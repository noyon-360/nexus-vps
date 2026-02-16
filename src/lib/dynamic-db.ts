import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import prisma from './prisma'; // Default instance
import { getSystemSettings } from '@/app/actions/settings';

// Cache for external prisma clients to avoid re-instantiation on every request
const clientCache: Record<string, PrismaClient> = {};

/**
 * Returns a Prisma client for the current user.
 * If user has external settings, returns a client connected to that DB.
 * Otherwise returns the default prisma client.
 */
export async function getDynamicPrisma() {
    const res = await getSystemSettings();
    if (!res.success || !res.settings || !res.settings.externalDbUrl) {
        return prisma;
    }

    const { externalDbUrl, userId } = res.settings;
    const cacheKey = `${userId}-${externalDbUrl}`;

    if (clientCache[cacheKey]) {
        return clientCache[cacheKey];
    }

    try {
        const pool = new Pool({ connectionString: externalDbUrl });
        const adapter = new PrismaPg(pool);
        const newClient = new PrismaClient({ adapter });

        clientCache[cacheKey] = newClient;
        return newClient;
    } catch (error) {
        console.error("Failed to instantiate external prisma client:", error);
        return prisma; // Fallback to local on error
    }
}
