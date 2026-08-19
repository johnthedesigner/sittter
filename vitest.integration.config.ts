import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Integration tests against a real database. Matches nothing until Phase 1.
export default defineConfig({
  test: {
    include: ['src/{db,services}/**/*.test.ts'],
    environment: 'node',
    // META-PLAN §2 step 12 requires a clean exit with zero tests: the unit
    // glob is empty until Task 0.1 and the integration glob until Phase 1.
    // Tradeoff: a glob broken later would pass silently rather than fail.
    passWithNoTests: true,
    // Repositories share one database; parallel files would race on fixtures.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
