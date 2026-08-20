/**
 * Link allocation, resolution, and revocation.
 *
 * A SLUG CARRIES NO CLAIMS. It is a five-character opaque lookup key — not a
 * signed token, not an encoded identifier. Access is decided by reading the
 * row server-side and checking `revoked_at` and `expires_at`. Signed payloads
 * are explicitly not used because they cannot be revoked, and revocation is a
 * requirement. See AGENTS.md and `docs/spec.md` §6.1.
 *
 * A DEAD LINK IS A DEAD LINK. A slug that never existed, one that expired,
 * one that was revoked, and one whose booking has moved on all produce the
 * same result. Distinguishing them would let a stranger probe which slugs are
 * real, and `resolveSlug` is reachable without any authentication at all.
 */

import { normalizeSlug, generateSlug } from '@/core/slug'
import type { RandomSource } from '@/core/slug'
import { deriveStatus } from '@/core/status'
import type { CalendarDate } from '@/core/types'

import { getBooking } from '@/db/repositories/bookings'
import { getProperty } from '@/db/repositories/properties'
import {
  createLink,
  findLinkBySlug,
  listLinks,
  recordLinkHit,
  revokeLink as revokeLinkRow,
} from '@/db/repositories/links'
import type { Link } from '@/db/repositories/links'

import { toBookingCore } from './home'

export class LinkError extends Error {}

/** Guards against a degenerate random source; unreachable with a real one. */
const MAX_ALLOCATION_ATTEMPTS = 20

/**
 * Allocate a slug and create the link.
 *
 * Retries on a DATABASE collision, not only on the reserved and blocked
 * words `generateSlug` already rejects. `links.slug` is globally unique, so
 * the insert is the only authority on whether a slug is taken — checking
 * first and inserting after is a race, and at 33.5 million combinations the
 * race is rare enough that it would be found in production rather than here.
 */
export async function allocateLink(
  businessId: string,
  input: {
    type: Link['type']
    customerId?: string | null
    bookingId?: string | null
    expiresAt?: Date | null
  },
  random: RandomSource
): Promise<Link> {
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const slug = generateSlug(random)
    try {
      return await createLink(businessId, {
        slug,
        type: input.type,
        customerId: input.customerId ?? null,
        bookingId: input.bookingId ?? null,
        expiresAt: input.expiresAt ?? null,
      })
    } catch (error: unknown) {
      // A unique violation means the slug is taken. Anything else is a real
      // failure and must not be swallowed by a retry loop.
      if (!isUniqueViolation(error)) throw error
    }
  }
  throw new LinkError(`Could not allocate a slug in ${MAX_ALLOCATION_ATTEMPTS} attempts.`)
}

function isUniqueViolation(error: unknown): boolean {
  const text =
    error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : String(error)
  return /duplicate key|unique constraint|23505/i.test(text)
}

/** What a slug resolves to. `invalid` covers every failure, indistinguishably. */
export type Resolution =
  | { kind: 'customer_portal'; link: Link; customerId: string }
  | { kind: 'booking_form'; link: Link; bookingId: string }
  | { kind: 'public_intake'; link: Link }
  | { kind: 'invalid' }

const INVALID: Resolution = { kind: 'invalid' }

/**
 * Resolve a slug.
 *
 * Returns `invalid` for a malformed slug, one that does not exist, an expired
 * one, and a revoked one alike — the caller renders one page for all of them.
 *
 * A `booking_form` link whose booking has moved past `tentative` resolves to
 * that customer's PORTAL instead, per `docs/spec.md` §5.3. The link is not
 * dead; it just means something different now.
 *
 * Records a hit only on a successful resolution, so the counter measures use
 * rather than probing.
 */
export async function resolveSlug(
  businessId: string,
  rawSlug: string,
  now: Date,
  today: CalendarDate
): Promise<Resolution> {
  const slug = normalizeSlug(rawSlug)
  if (slug === null) return INVALID

  const link = await findLinkBySlug(businessId, slug)
  if (link === null) return INVALID
  if (link.revokedAt !== null) return INVALID
  if (link.expiresAt !== null && link.expiresAt.getTime() <= now.getTime()) return INVALID

  if (link.type === 'public_intake') {
    await recordLinkHit(businessId, slug, now)
    return { kind: 'public_intake', link }
  }

  if (link.type === 'customer_portal') {
    if (link.customerId === null) return INVALID
    await recordLinkHit(businessId, slug, now)
    return { kind: 'customer_portal', link, customerId: link.customerId }
  }

  // booking_form
  if (link.bookingId === null) return INVALID
  const booking = await getBooking(businessId, link.bookingId)
  if (booking === null) return INVALID

  const status = deriveStatus(toBookingCore(booking), today)
  await recordLinkHit(businessId, slug, now)

  if (status === 'inquiry' || status === 'tentative') {
    return { kind: 'booking_form', link, bookingId: link.bookingId }
  }

  // Past the point where the customer can still fill it in: send them to
  // their portal rather than to a dead end.
  const property = await getProperty(businessId, booking.propertyId)
  if (property === null) return INVALID
  return { kind: 'customer_portal', link, customerId: property.customerId }
}

export async function revokeLinkById(
  businessId: string,
  linkId: string,
  now: Date
): Promise<Link | null> {
  return revokeLinkRow(businessId, linkId, now)
}

/**
 * Replace a customer's portal link.
 *
 * Revokes the old slug and issues a new one. The old link then behaves like
 * any other dead link, which is the whole point — a link handed to the wrong
 * person can be taken back.
 */
export async function rotateCustomerLink(
  businessId: string,
  customerId: string,
  now: Date,
  random: RandomSource
): Promise<Link> {
  const existing = (await listLinks(businessId)).filter(
    (l) => l.type === 'customer_portal' && l.customerId === customerId && l.revokedAt === null
  )
  for (const link of existing) {
    await revokeLinkRow(businessId, link.id, now)
  }
  return allocateLink(businessId, { type: 'customer_portal', customerId }, random)
}

/** The customer's live portal link, allocating one if they have none. */
export async function ensureCustomerLink(
  businessId: string,
  customerId: string,
  random: RandomSource
): Promise<Link> {
  const live = (await listLinks(businessId)).find(
    (l) => l.type === 'customer_portal' && l.customerId === customerId && l.revokedAt === null
  )
  return live ?? allocateLink(businessId, { type: 'customer_portal', customerId }, random)
}

/** The booking's live form link, allocating one if it has none. */
export async function ensureBookingFormLink(
  businessId: string,
  bookingId: string,
  random: RandomSource
): Promise<Link> {
  const live = (await listLinks(businessId)).find(
    (l) => l.type === 'booking_form' && l.bookingId === bookingId && l.revokedAt === null
  )
  return live ?? allocateLink(businessId, { type: 'booking_form', bookingId }, random)
}

/**
 * The business's public intake link.
 *
 * Idempotent — exactly one per business however many times this is called,
 * because the URL goes on a card and in a text message signature and must not
 * change underneath them.
 */
export async function ensurePublicIntakeLink(
  businessId: string,
  random: RandomSource
): Promise<Link> {
  const live = (await listLinks(businessId)).find(
    (l) => l.type === 'public_intake' && l.revokedAt === null
  )
  return live ?? allocateLink(businessId, { type: 'public_intake' }, random)
}

/** The absolute URL for a slug, built from APP_URL. */
export function linkUrl(appUrl: string, slug: string): string {
  return `${appUrl.replace(/\/+$/, '')}/s/${slug}`
}
