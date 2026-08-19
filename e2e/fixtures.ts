/**
 * Shared end-to-end fixtures.
 *
 * These run in the Playwright process, alongside the app rather than inside
 * it, and talk to the same Neon `test` branch the web server is pointed at.
 *
 * Minting a sign-in link here plays the role the email plays in real use.
 * The plaintext token exists only in the emailed URL, so there is no way to
 * recover one from the database — and having the test read a real inbox would
 * be slow, flaky, and would send mail on every run.
 */

import { randomBytes } from 'node:crypto'

import { config as loadEnv } from 'dotenv'
import { test as base } from '@playwright/test'

loadEnv({ path: '.env.test' })

import { hashToken } from '../src/services/auth'
import { createMagicLinkToken } from '../src/db/repositories/auth'
import { getOnlyBusiness } from '../src/db/repositories/businesses'
import { findAdminByEmail } from '../src/db/repositories/admins'
import { resetDatabase } from '../src/db/testing/database'
import { seed } from '../src/db/seed'
import { toCalendarDate } from '../src/core/dates'

/** The reference date the seed is anchored to, so fixtures are deterministic. */
export const SEED_REFERENCE_DATE = toCalendarDate('2026-08-17')

/** The seeded admin. Matches `SEED_ADMIN_EMAILS[0]` in `src/db/seed.ts`. */
export const SEEDED_ADMIN_EMAIL = 'jlivornese@gmail.com'
export const SEEDED_ADMIN_NAME = 'Sitter'

export const UNREGISTERED_EMAIL = 'not-an-admin@example.com'

export interface SignInLink {
  /** The absolute path to open, as the emailed button would. */
  url: string
  token: string
}

/**
 * Create a live sign-in link for an admin and return its plaintext token.
 *
 * Deliberately uses the same hashing the service does, so a change to
 * `hashToken` breaks this rather than silently producing links that no longer
 * resolve.
 */
export async function mintSignInLink(email: string): Promise<SignInLink> {
  const business = await getOnlyBusiness()
  if (business === null) throw new Error('mintSignInLink: the database is not seeded')

  const admin = await findAdminByEmail(business.id, email)
  if (admin === null) throw new Error(`mintSignInLink: ${email} is not a registered admin`)

  const token = randomBytes(32).toString('base64url')
  await createMagicLinkToken(business.id, {
    adminId: admin.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  })

  return { token, url: `/api/auth/callback?token=${encodeURIComponent(token)}` }
}

/** An already-expired link, for proving expiry fails closed through the UI. */
export async function mintExpiredSignInLink(email: string): Promise<SignInLink> {
  const business = await getOnlyBusiness()
  if (business === null) throw new Error('mintExpiredSignInLink: the database is not seeded')
  const admin = await findAdminByEmail(business.id, email)
  if (admin === null) throw new Error(`mintExpiredSignInLink: ${email} is not an admin`)

  const token = randomBytes(32).toString('base64url')
  await createMagicLinkToken(business.id, {
    adminId: admin.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() - 1000),
  })

  return { token, url: `/api/auth/callback?token=${encodeURIComponent(token)}` }
}

export async function resetAndSeed(): Promise<void> {
  await resetDatabase()
  await seed(SEED_REFERENCE_DATE)
}

/**
 * A test that starts from a freshly seeded database and no session.
 *
 * Specs run serially — `fullyParallel` is false — because they share one
 * database and reseeding underneath a parallel spec would be a race.
 */
export const test = base.extend({
  page: async ({ page, context }, use) => {
    await resetAndSeed()
    await context.clearCookies()
    await use(page)
  },
})

export { expect } from '@playwright/test'
