import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit tests. src/core/ only — the pure layer, no database, no network.
export default defineConfig({
  test: {
    include: ['src/core/**/*.test.ts'],
    environment: 'node',
    // META-PLAN §2 step 12 requires a clean exit with zero tests: the unit
    // glob is empty until Task 0.1 and the integration glob until Phase 1.
    // Tradeoff: a glob broken later would pass silently rather than fail.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/*.test.ts'],
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
