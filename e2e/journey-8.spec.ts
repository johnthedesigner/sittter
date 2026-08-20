/**
 * Journey 8 — Signing in.
 * Covers docs/user-journeys.md steps 8.1.1 through 8.1.6.
 *
 * Runs against the Neon `test` branch, reseeded before each test. The web
 * server is started by playwright.config.ts with a RESEND_API_KEY that cannot
 * authenticate, so exercising the real form sends no mail.
 */

import { SIGN_IN_COPY as COPY } from '../src/app/signin/copy'
import {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_NAME,
  UNREGISTERED_EMAIL,
  expect,
  mintExpiredSignInLink,
  mintSignInLink,
  test,
} from './fixtures'

test('8.1.1 — opening the app signed out loads the sign-in page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/signin$/)
  await expect(page.getByRole('heading', { name: COPY.heading })).toBeVisible()
  await expect(page.getByLabel(COPY.emailLabel)).toBeVisible()
  await expect(page.getByRole('button', { name: COPY.submit })).toBeVisible()
})

test('8.1.2 — submitting a registered email shows the confirmation message', async ({ page }) => {
  await page.goto('/signin')
  await page.getByLabel(COPY.emailLabel).fill(SEEDED_ADMIN_EMAIL)
  await page.getByRole('button', { name: COPY.submit }).click()

  await expect(page.getByText(COPY.sent)).toBeVisible()
  // The message does not confirm the address is registered.
  await expect(page.getByText(COPY.sent)).toContainText('If that address belongs to an admin')
})

test('8.1.5 — an unregistered email shows the SAME message', async ({ page }) => {
  /** Submit an address and return exactly what the page then says. */
  async function submitAndRead(email: string): Promise<string> {
    await page.goto('/signin')
    await page.getByLabel(COPY.emailLabel).fill(email)
    await page.getByRole('button', { name: COPY.submit }).click()
    // Wait for the redirect to settle before reading, so the two captures
    // are taken at the same point in the flow rather than racing it.
    await page.waitForURL(/\/signin\?sent=1$/)
    await expect(page.getByText(COPY.sent)).toBeVisible()
    return (await page.locator('main').innerText()).replace(/\s+/g, ' ').trim()
  }

  const unregistered = await submitAndRead(UNREGISTERED_EMAIL)
  const registered = await submitAndRead(SEEDED_ADMIN_EMAIL)

  // Nothing on the page distinguishes them. If anything ever did, the page
  // would be telling a stranger which addresses belong to admins.
  expect(unregistered).toBe(registered)
  expect(unregistered).toContain('If that address belongs to an admin')
})

test('8.1.3 — following the link creates a session and loads home', async ({ page }) => {
  const link = await mintSignInLink(SEEDED_ADMIN_EMAIL)

  await page.goto(link.url)

  await expect(page).toHaveURL(/\/home$/)
  // The Phase 1 stub rendered the name in the page body; Task 2.1 replaced
  // that page with the real home screen and the name moved to the shell.
  // What 8.1.3 asserts is unchanged: the session resolves to THIS admin,
  // read from the database rather than from the cookie.
  await expect(page.getByTestId('acting-admin')).toHaveText(SEEDED_ADMIN_NAME)
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
})

test('8.1.4 — the same link a second time no longer works', async ({ page }) => {
  const link = await mintSignInLink(SEEDED_ADMIN_EMAIL)

  await page.goto(link.url)
  await expect(page).toHaveURL(/\/home$/)

  await page.context().clearCookies()
  await page.goto(link.url)

  await expect(page).toHaveURL(/\/signin\?invalid=1$/)
  await expect(page.getByText(COPY.invalid)).toBeVisible()
})

test('8.1.6 — the session survives a new browser context on the same device', async ({
  page,
  context,
}) => {
  const link = await mintSignInLink(SEEDED_ADMIN_EMAIL)
  await page.goto(link.url)
  await expect(page).toHaveURL(/\/home$/)

  // A fresh page carrying the same cookie jar, as returning days later would.
  const returning = await context.newPage()
  await returning.goto('/home')
  await expect(returning.getByTestId('acting-admin')).toHaveText(SEEDED_ADMIN_NAME)
  await returning.close()
})

test('the session guard redirects an unauthenticated visitor away from /home', async ({ page }) => {
  await page.goto('/home')
  await expect(page).toHaveURL(/\/signin$/)
  await expect(page.getByRole('heading', { name: COPY.heading })).toBeVisible()
})

test('an expired link fails closed with the invalid-link message', async ({ page }) => {
  const link = await mintExpiredSignInLink(SEEDED_ADMIN_EMAIL)
  await page.goto(link.url)
  await expect(page).toHaveURL(/\/signin\?invalid=1$/)
  await expect(page.getByText(COPY.invalid)).toBeVisible()
})

test('a tampered token fails closed', async ({ page }) => {
  const link = await mintSignInLink(SEEDED_ADMIN_EMAIL)
  const tampered = `${link.token.slice(0, -1)}${link.token.endsWith('A') ? 'B' : 'A'}`
  await page.goto(`/api/auth/callback?token=${encodeURIComponent(tampered)}`)
  await expect(page).toHaveURL(/\/signin\?invalid=1$/)
})

test('a callback with no token at all fails closed', async ({ page }) => {
  await page.goto('/api/auth/callback')
  await expect(page).toHaveURL(/\/signin\?invalid=1$/)
})

test('a garbage session cookie redirects to sign-in rather than erroring', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'sittter_session',
      value: 'not-a-real-token',
      domain: 'localhost',
      path: '/',
    },
  ])
  await page.goto('/home')
  await expect(page).toHaveURL(/\/signin$/)
})

test('signing out returns to the sign-in page and ends the session', async ({ page }) => {
  const link = await mintSignInLink(SEEDED_ADMIN_EMAIL)
  await page.goto(link.url)
  await expect(page).toHaveURL(/\/home$/)

  await page.getByTestId('sign-out').click()
  await expect(page).toHaveURL(/\/signin$/)

  // The session is gone, not merely navigated away from.
  await page.goto('/home')
  await expect(page).toHaveURL(/\/signin$/)
})
