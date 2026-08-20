import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit tests: the pure layers. No database, no network.
//
// docs/META-PLAN.md §2 scoped this to src/core/ only, written before any
// component existed. src/components/ holds pure display helpers — label
// maps and formatters that import nothing but types — and they fell into
// neither suite: not src/core/, and not src/{db,services}/. Running them in
// the integration suite would make them require a Neon connection to assert
// that 5900 renders as "$59.00".
//
// The src/core/ boundary is unaffected: it is enforced by ESLint on the
// source, not by which runner executes a test.
export default defineConfig({
  test: {
    include: ['src/{core,components}/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/{core,components}/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/components/**/*.tsx'],
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
