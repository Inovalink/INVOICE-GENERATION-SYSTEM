import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Always cache on globalThis — prevents new connection pools on every hot reload
// in dev and on every cold-start re-evaluation in serverless production environments.
globalForPrisma.prisma = prisma;
