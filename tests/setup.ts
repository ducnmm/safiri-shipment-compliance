import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runs before each test file's modules are imported. Copies the migrated
 * template database to a unique per-file path and points DATABASE_URL at it,
 * BEFORE db.ts constructs its PrismaClient — giving every suite an isolated DB.
 */
const here = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(here, '.tmp');
const templateDb = join(tmpDir, 'template.db');
const suffix = `${process.pid}-${Math.random().toString(36).slice(2)}`;
const workerDb = join(tmpDir, `test-${suffix}.db`);

copyFileSync(templateDb, workerDb);
process.env.DATABASE_URL = `file:${workerDb}`;
