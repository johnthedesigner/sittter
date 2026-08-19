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
  // Vite reads `jsx` straight from tsconfig. When it is "preserve", .tsx
  // fails here as "content contains invalid JS syntax" — which is what
  // happened before the first `pnpm build`, at which point Next 16 rewrote
  // tsconfig to "react-jsx" itself ("mandatory changes were made to your
  // tsconfig.json"). This override is kept so the suite does not depend on
  // Next having rewritten the file, and so a fresh clone that runs tests
  // before it ever builds still works.
  //
  // The key is `oxc`, NOT `esbuild`: Vite 8 replaced esbuild with oxc and
  // silently ignores the old key, which makes a wrong guess here look like
  // the option having no effect at all.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
