import { PrismaClient } from '@prisma/client';

// Load .env only when DATABASE_URL isn't already provided. This lets tests point
// at an isolated database file (by setting the env var first) without the .env
// file clobbering their choice, while normal `npm run dev` still works.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file present; rely on the ambient environment.
  }
}

/**
 * Single PrismaClient for the process, re-used across requests.
 */
export const prisma = new PrismaClient();

/**
 * Transaction-capable client type. Services accept this so they can run either
 * against the base client or inside an interactive `$transaction` callback.
 */
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
