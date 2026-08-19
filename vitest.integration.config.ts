import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Integration tests run against the Neon `test` branch, never `main`.
// Nothing outside Next.js loads a .env file on its own, so it is read here
// explicitly and handed to the test environment. A missing .env.test yields
// an empty object, and the guard in src/db/testing/database.ts fails loudly
// rather than letting the suite fall through to some other database.
const testEnv = loadEnv({ path: '.env.test' }).parsed ?? {}

export default defineConfig({
  test: {
    include: ['src/{db,services}/**/*.test.ts'],
    environment: 'node',
    env: testEnv,
    // Repositories share one database; parallel files would race on fixtures.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
