import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each API test suite spins up its own SQLite file, so run suites in
    // separate forks to avoid cross-test DB interference.
    pool: 'forks',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    setupFiles: ['tests/setup.ts'],
    hookTimeout: 30_000,
  },
});
