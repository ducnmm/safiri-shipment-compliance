import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(here, '.tmp');
const templateDb = join(tmpDir, 'template.db');
const projectRoot = join(here, '..');

/**
 * Build one migrated "template" SQLite database before the test run. Each test
 * file copies it to its own isolated file (see setup.ts), so suites never share
 * state and can run in parallel.
 */
export default function setup(): () => void {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: `file:${templateDb}` },
    stdio: 'ignore',
    cwd: projectRoot,
  });

  return () => {
    rmSync(tmpDir, { recursive: true, force: true });
  };
}
