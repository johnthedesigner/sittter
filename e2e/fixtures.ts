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

/** The second seeded admin. Spec §6.2: all admins have identical capabilities. */
export const SECOND_ADMIN_EMAIL = 'co-admin+sittter@example.com'
export const SECOND_ADMIN_NAME = 'Co-administrator'

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

/** How many emails the app has sent. Used to assert that none was. */
export async function countEmailSends(): Promise<number> {
  const business = await getOnlyBusiness()
  if (business === null) return 0
  const { listEmailSends } = await import('../src/db/repositories/email-sends')
  return (await listEmailSends(business.id)).length
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

/** Sign in through the real callback route, as the emailed link would. */
export async function signIn(
  page: import('@playwright/test').Page,
  email: string = SEEDED_ADMIN_EMAIL
): Promise<void> {
  const link = await mintSignInLink(email)
  await page.goto(link.url)
  await page.waitForURL(/\/home$/)
}

/** Swap the signed-in admin, as the co-administrator picking up their phone. */
export async function switchAdmin(
  page: import('@playwright/test').Page,
  email: string
): Promise<void> {
  await page.context().clearCookies()
  await signIn(page, email)
}

/**
 * A test that starts signed in against a freshly seeded database.
 *
 * Most admin-surface specs need this; the sign-in journey itself does not,
 * and uses `test` instead.
 */
export const signedInTest = test.extend({
  page: async ({ page }, use) => {
    await signIn(page)
    await use(page)
  },
})

// ── Link fixtures, for the public surfaces ───────────────────────────

/** The access code the seed puts on Maple Street. Asserted absent from the portal. */
export const ACCESS_CODE_FIXTURE = 'SECRET-ACCESS-CODE-4417'

/** A deterministic slug source, so a fixture's slug is predictable. */
function slugSource(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

export async function seededCustomerIds(): Promise<{ first: string; second: string }> {
  const business = await getOnlyBusiness()
  if (business === null) throw new Error('the database is not seeded')
  const { listCustomers } = await import('../src/db/repositories/customers')
  const customers = await listCustomers(business.id)
  return { first: customers[0]!.id, second: customers[1]!.id }
}

/**
 * A live link of the given kind, allocated against the seeded data.
 *
 * Allocates through the real service so a fixture cannot drift from how the
 * application makes links.
 */
export async function linkFor(
  kind: 'customer_portal' | 'booking_form' | 'public_intake',
  customerId?: string
): Promise<{ slug: string }> {
  const business = await getOnlyBusiness()
  if (business === null) throw new Error('the database is not seeded')

  const links = await import('../src/services/links')
  const random = slugSource(Date.now() % 100000)

  if (kind === 'public_intake') {
    return { slug: (await links.ensurePublicIntakeLink(business.id, random)).slug }
  }

  const { listCustomers } = await import('../src/db/repositories/customers')
  const customers = await listCustomers(business.id)
  const chosen = customerId ?? customers[0]!.id

  if (kind === 'customer_portal') {
    return { slug: (await links.ensureCustomerLink(business.id, chosen, random)).slug }
  }

  // A booking form link for a booking still open to the customer.
  const { listBookings } = await import('../src/db/repositories/bookings')
  const { deriveStatus } = await import('../src/core/status')
  const { toBookingCore } = await import('../src/services/home')
  const bookings = await listBookings(business.id)
  const open = bookings.find((b) => {
    const status = deriveStatus(toBookingCore(b), SEED_REFERENCE_DATE)
    return status === 'inquiry' || status === 'tentative'
  })
  if (open === undefined) throw new Error('no booking is open to the customer')
  return { slug: (await links.ensureBookingFormLink(business.id, open.id, random)).slug }
}

/** A slug whose link has been revoked. */
export async function revokedLinkFor(): Promise<string> {
  const business = await getOnlyBusiness()
  if (business === null) throw new Error('the database is not seeded')
  const links = await import('../src/services/links')
  const { listCustomers } = await import('../src/db/repositories/customers')
  const customers = await listCustomers(business.id)

  const link = await links.allocateLink(
    business.id,
    { type: 'customer_portal', customerId: customers[0]!.id },
    slugSource(4242)
  )
  await links.revokeLinkById(business.id, link.id, new Date())
  return link.slug
}

/** A slug whose link expired in the past. */
export async function expiredLinkFor(): Promise<string> {
  const business = await getOnlyBusiness()
  if (business === null) throw new Error('the database is not seeded')
  const links = await import('../src/services/links')
  const { listCustomers } = await import('../src/db/repositories/customers')
  const customers = await listCustomers(business.id)

  const link = await links.allocateLink(
    business.id,
    {
      type: 'customer_portal',
      customerId: customers[0]!.id,
      expiresAt: new Date(Date.now() - 60_000),
    },
    slugSource(9182)
  )
  return link.slug
}

export { expect } from '@playwright/test'
