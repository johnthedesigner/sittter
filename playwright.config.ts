import { config as loadEnv } from 'dotenv'
import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the Neon `test` branch, never `main` — the
 * fixtures truncate and reseed between specs.
 *
 * RESEND_API_KEY is deliberately overridden with a value that cannot
 * authenticate. Journey step 8.1.2 exercises the real sign-in form, which
 * reaches the email service; without this, every `pnpm test:e2e` would send a
 * real email. The service records the failure and returns the same result
 * either way, so the page behaviour under test is unchanged — which is itself
 * the "integrations fail soft" rule holding.
 */
const testEnv = loadEnv({ path: '.env.test' }).parsed ?? {}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // One worker, not just serial-within-a-file. Every spec truncates and
  // reseeds the same Neon `test` branch, so two files in parallel workers
  // race — one truncating while the other inserts, which surfaces as
  // "Database is not empty — refusing to seed" and foreign key violations
  // that have nothing to do with the code under test.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Port 3100, not 3000, and never reused.
    //
    // A developer's own `pnpm dev` on :3000 reads .env — the MAIN branch.
    // With reuseExistingServer, Playwright would silently adopt it, and the
    // fixtures would mint sign-in tokens in the test branch that the server
    // cannot find. Every spec then fails as an invalid magic link, which
    // looks exactly like an authentication bug and is not one.
    // A production build, not `next dev`. Next 16 allows only one dev server
    // per directory and exits if one is already running, so a developer's own
    // `pnpm dev` would break the suite. `next start` has no such check, and
    // testing against a real build is closer to what deploys anyway.
    command: 'pnpm build && pnpm exec next start -p 3100',
    url: 'http://localhost:3100/signin',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...testEnv,
      RESEND_API_KEY: 'e2e-no-real-sends',
    },
  },
})
