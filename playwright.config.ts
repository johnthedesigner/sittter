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
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000/signin',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...testEnv,
      RESEND_API_KEY: 'e2e-no-real-sends',
      NODE_ENV: 'development',
    },
  },
})
