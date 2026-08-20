/**
 * Link allocation, resolution, and revocation.
 *
 * The load-bearing test here is that a dead link is a dead link: a slug that
 * never existed, an expired one, and a revoked one must be indistinguishable,
 * because `resolveSlug` is reachable with no authentication at all.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { toCalendarDate } from '@/core/dates'
import { ALPHABET } from '@/core/slug'
import type { RandomSource } from '@/core/slug'
import { createBusiness } from '@/db/repositories/businesses'
import { createCustomer } from '@/db/repositories/customers'
import { createProperty } from '@/db/repositories/properties'
import { createBooking, updateBooking } from '@/db/repositories/bookings'
import { createLink, findLinkBySlug, listLinks } from '@/db/repositories/links'
import { resetDatabase } from '@/db/testing/database'

import {
  allocateLink,
  ensureBookingFormLink,
  ensureCustomerLink,
  ensurePublicIntakeLink,
  linkUrl,
  resolveSlug,
  revokeLinkById,
  rotateCustomerLink,
} from './links'

const TODAY = toCalendarDate('2026-08-20')
const NOW = new Date('2026-08-20T12:00:00Z')

/** A source that produces exactly these slugs, in order, then a fixed one. */
function sourceProducing(...slugs: string[]): RandomSource {
  const values: number[] = []
  for (const slug of slugs) {
    for (const ch of slug.toUpperCase()) {
      const index = ALPHABET.indexOf(ch)
      if (index === -1) throw new Error(`sourceProducing cannot produce ${JSON.stringify(ch)}`)
      values.push(index / ALPHABET.length)
    }
  }
  let i = 0
  const fallback = 'ZW7XQ'
  return () => {
    if (i < values.length) return values[i++] ?? 0
    const pos = (i++ - values.length) % 5
    return ALPHABET.indexOf(fallback[pos] ?? 'Z') / ALPHABET.length
  }
}

async function fixture() {
  const business = await createBusiness({ name: 'sittter', contactEmail: 'h@example.com' })
  const other = await createBusiness({ name: 'Other', contactEmail: 'o@example.com' })
  const customer = await createCustomer(business.id, { name: 'Dana' })
  const property = await createProperty(business.id, {
    customerId: customer.id,
    nickname: 'Maple',
  })
  const booking = await createBooking(business.id, {
    propertyId: property.id,
    startDate: '2026-09-01',
    endDate: '2026-09-07',
  })
  return { business, other, customer, property, booking }
}

beforeEach(async () => {
  await resetDatabase()
})

describe('allocateLink', () => {
  it('stores the slug uppercase and resolves it case-insensitively', async () => {
    const { business, customer } = await fixture()
    const link = await allocateLink(
      business.id,
      { type: 'customer_portal', customerId: customer.id },
      sourceProducing('ab3k9')
    )
    expect(link.slug).toBe('AB3K9')
    expect((await findLinkBySlug(business.id, 'ab3k9'))!.id).toBe(link.id)
  })

  it('RETRIES ON A DATABASE COLLISION, not only on reserved and blocked words', async () => {
    const { business, customer } = await fixture()

    // Seed the slug the source will produce first.
    await createLink(business.id, { slug: 'PQ3RT', type: 'public_intake' })

    const link = await allocateLink(
      business.id,
      { type: 'customer_portal', customerId: customer.id },
      sourceProducing('PQ3RT', 'XM4TB')
    )

    expect(link.slug).toBe('XM4TB')
    // The seeded one is untouched, and there is exactly one of it.
    expect((await listLinks(business.id)).filter((l) => l.slug === 'PQ3RT')).toHaveLength(1)
  })

  it('consumes the injected source in order, so allocation is deterministic', async () => {
    const { business, customer, booking } = await fixture()
    // One source, two allocations: the second continues where the first
    // stopped rather than restarting. That is what makes "suppose the source
    // would produce a taken slug" a test rather than a hope.
    const source = sourceProducing('AB3K9', 'XM4TB')

    const first = await allocateLink(
      business.id,
      { type: 'customer_portal', customerId: customer.id },
      source
    )
    const second = await allocateLink(
      business.id,
      { type: 'booking_form', bookingId: booking.id },
      source
    )

    expect(first.slug).toBe('AB3K9')
    expect(second.slug).toBe('XM4TB')
  })

  it('gives up rather than looping forever on a degenerate source', async () => {
    const { business, customer } = await fixture()
    await createLink(business.id, { slug: 'PQ3RT', type: 'public_intake' })
    const always = sourceProducing(...Array.from({ length: 40 }, () => 'PQ3RT'))
    await expect(
      allocateLink(business.id, { type: 'customer_portal', customerId: customer.id }, always)
    ).rejects.toThrow(/could not allocate/i)
  })
})

describe('resolveSlug — a dead link is a dead link', () => {
  it('NEVER EXISTED, EXPIRED, AND REVOKED ARE INDISTINGUISHABLE', async () => {
    const { business, customer } = await fixture()

    const expired = await createLink(business.id, {
      slug: 'EXPRD',
      type: 'customer_portal',
      customerId: customer.id,
      expiresAt: new Date('2026-08-19T12:00:00Z'),
    })
    const revoked = await createLink(business.id, {
      slug: 'RVKED',
      type: 'customer_portal',
      customerId: customer.id,
    })
    await revokeLinkById(business.id, revoked.id, NOW)

    const neverExisted = await resolveSlug(business.id, 'ZZZZZ', NOW, TODAY)
    const isExpired = await resolveSlug(business.id, 'EXPRD', NOW, TODAY)
    const isRevoked = await resolveSlug(business.id, 'RVKED', NOW, TODAY)

    expect(neverExisted).toEqual({ kind: 'invalid' })
    expect(isExpired).toEqual(neverExisted)
    expect(isRevoked).toEqual(neverExisted)
    expect(expired.slug).toBe('EXPRD') // the row exists; the answer does not say so
  })

  it('a malformed slug is invalid, not an error', async () => {
    const { business } = await fixture()
    for (const bad of ['', 'AB3', 'AB3K99', 'AB3I9', 'not a slug']) {
      expect(await resolveSlug(business.id, bad, NOW, TODAY)).toEqual({ kind: 'invalid' })
    }
  })

  it('a slug belonging to another business does not resolve', async () => {
    const { business, other, customer } = await fixture()
    await createLink(business.id, {
      slug: 'AB3K9',
      type: 'customer_portal',
      customerId: customer.id,
    })
    expect(await resolveSlug(other.id, 'AB3K9', NOW, TODAY)).toEqual({ kind: 'invalid' })
  })

  it('an expiry in the future still resolves', async () => {
    const { business, customer } = await fixture()
    await createLink(business.id, {
      slug: 'FTRE9',
      type: 'customer_portal',
      customerId: customer.id,
      expiresAt: new Date('2026-09-01T00:00:00Z'),
    })
    expect((await resolveSlug(business.id, 'FTRE9', NOW, TODAY)).kind).toBe('customer_portal')
  })
})

describe('resolveSlug — dispatch by type', () => {
  it('resolves a portal slug to its customer', async () => {
    const { business, customer } = await fixture()
    await createLink(business.id, {
      slug: 'AB3K9',
      type: 'customer_portal',
      customerId: customer.id,
    })
    const result = await resolveSlug(business.id, 'ab3k9', NOW, TODAY)
    expect(result).toMatchObject({ kind: 'customer_portal', customerId: customer.id })
  })

  it('resolves an intake slug', async () => {
    const { business } = await fixture()
    await createLink(business.id, { slug: 'NTAKE', type: 'public_intake' })
    expect((await resolveSlug(business.id, 'NTAKE', NOW, TODAY)).kind).toBe('public_intake')
  })

  it('resolves a booking form slug while the booking is tentative', async () => {
    const { business, booking } = await fixture()
    await createLink(business.id, { slug: 'BKFRM', type: 'booking_form', bookingId: booking.id })
    const result = await resolveSlug(business.id, 'BKFRM', NOW, TODAY)
    expect(result).toMatchObject({ kind: 'booking_form', bookingId: booking.id })
  })

  it('A CONFIRMED BOOKING SENDS THE CUSTOMER TO THEIR PORTAL INSTEAD', async () => {
    // docs/spec.md §5.3 — the link is not dead, it means something else now.
    const { business, booking, customer } = await fixture()
    await createLink(business.id, { slug: 'BKFRM', type: 'booking_form', bookingId: booking.id })
    await updateBooking(business.id, booking.id, {
      datesFirmAt: NOW,
      availabilityCheckedAt: NOW,
    })

    const result = await resolveSlug(business.id, 'BKFRM', NOW, TODAY)
    expect(result).toMatchObject({ kind: 'customer_portal', customerId: customer.id })
  })

  it('records a hit only on a successful resolution', async () => {
    const { business, customer } = await fixture()
    await createLink(business.id, {
      slug: 'AB3K9',
      type: 'customer_portal',
      customerId: customer.id,
    })

    await resolveSlug(business.id, 'AB3K9', NOW, TODAY)
    await resolveSlug(business.id, 'AB3K9', NOW, TODAY)
    await resolveSlug(business.id, 'ZZZZZ', NOW, TODAY)

    const link = await findLinkBySlug(business.id, 'AB3K9')
    expect(link!.hitCount).toBe(2)
    expect(link!.lastHitAt).not.toBeNull()
  })
})

describe('rotation and idempotent allocation', () => {
  it('ROTATION REVOKES THE OLD SLUG AND ISSUES A NEW ONE', async () => {
    const { business, customer } = await fixture()
    const before = await ensureCustomerLink(business.id, customer.id, sourceProducing('AB3K9'))

    const after = await rotateCustomerLink(business.id, customer.id, NOW, sourceProducing('XM4TB'))

    expect(after.slug).toBe('XM4TB')
    expect(after.slug).not.toBe(before.slug)
    // The old one now behaves like any dead link.
    expect(await resolveSlug(business.id, before.slug, NOW, TODAY)).toEqual({ kind: 'invalid' })
    expect((await resolveSlug(business.id, after.slug, NOW, TODAY)).kind).toBe('customer_portal')
  })

  it('ensureCustomerLink returns the existing live link rather than a second', async () => {
    const { business, customer } = await fixture()
    const first = await ensureCustomerLink(business.id, customer.id, sourceProducing('AB3K9'))
    const second = await ensureCustomerLink(business.id, customer.id, sourceProducing('XM4TB'))
    expect(second.id).toBe(first.id)
  })

  it('ensurePublicIntakeLink IS IDEMPOTENT — one per business, always', async () => {
    const { business } = await fixture()
    const first = await ensurePublicIntakeLink(business.id, sourceProducing('NTAKE'))
    const second = await ensurePublicIntakeLink(business.id, sourceProducing('THER2'))
    const third = await ensurePublicIntakeLink(business.id, sourceProducing('AGN4X'))

    expect(second.id).toBe(first.id)
    expect(third.id).toBe(first.id)
    expect((await listLinks(business.id)).filter((l) => l.type === 'public_intake')).toHaveLength(1)
  })

  it('ensureBookingFormLink allocates once per booking', async () => {
    const { business, booking } = await fixture()
    const first = await ensureBookingFormLink(business.id, booking.id, sourceProducing('BKFRM'))
    const second = await ensureBookingFormLink(business.id, booking.id, sourceProducing('THER2'))
    expect(second.id).toBe(first.id)
  })

  it('a revoked link is replaced rather than reused', async () => {
    const { business, customer } = await fixture()
    const first = await ensureCustomerLink(business.id, customer.id, sourceProducing('AB3K9'))
    await revokeLinkById(business.id, first.id, NOW)
    const replacement = await ensureCustomerLink(business.id, customer.id, sourceProducing('XM4TB'))
    expect(replacement.id).not.toBe(first.id)
  })
})

describe('createLink guards the alphabet', () => {
  it('refuses a slug that could never resolve', async () => {
    const { business, customer } = await fixture()
    // U, I, L and O are absent from Crockford base32. A row carrying one is
    // dead on arrival, and silent about it.
    await expect(
      createLink(business.id, { slug: 'FUTUR', type: 'customer_portal', customerId: customer.id })
    ).rejects.toThrow(/not a valid slug/i)
  })
})

describe('linkUrl', () => {
  it('builds an absolute URL with no doubled slash', () => {
    expect(linkUrl('http://localhost:3000', 'AB3K9')).toBe('http://localhost:3000/s/AB3K9')
    expect(linkUrl('http://localhost:3000/', 'AB3K9')).toBe('http://localhost:3000/s/AB3K9')
  })
})
