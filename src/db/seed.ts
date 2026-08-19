/**
 * Development seed fixture.
 *
 * One business, two admins, two customers, three bookings — per
 * `tasks/phase-1.md` Reference data. The three bookings are shaped so that
 * `deriveStatus` returns `confirmed`, `tentative`, and `inquiry`, which makes
 * the seed useful for eyeballing every branch of the status table.
 *
 * DETERMINISTIC. Fixed identifiers, and every date derived from a reference
 * date passed in. No `Date.now()` and no `Math.random()` in the fixtures, so
 * two runs against the same reference date produce identical rows.
 *
 * REFUSES TO RUN against a non-empty database rather than trying to be
 * idempotent. Upserting into eleven tables invites a half-applied seed that
 * looks fine; a clear refusal does not.
 */

import { addDays, toCalendarDate } from '@/core/dates'
import type { CalendarDate } from '@/core/types'

import { db } from './client'
import {
  admins,
  bookings,
  businesses,
  careInstructions,
  customers,
  pricingComponents,
  properties,
} from './schema'

/**
 * The admin addresses.
 *
 * Both are the same real inbox on purpose. Resend's shared sender only
 * delivers to the address that owns the API key until a domain is verified,
 * so a magic link addressed anywhere else silently never arrives.
 */
export const SEED_ADMIN_EMAILS = ['jlivornese@gmail.com', 'jlivornese@gmail.com'] as const

export interface SeedResult {
  businessId: string
  adminIds: string[]
  customerIds: string[]
  bookingIds: string[]
}

/** True when the database already holds a business. */
export async function isSeeded(): Promise<boolean> {
  const rows = await db().select({ id: businesses.id }).from(businesses).limit(1)
  return rows.length > 0
}

/**
 * Seed the database.
 *
 * `referenceDate` anchors every generated date, so the fixture is a pure
 * function of its argument. Callers pass today; tests pass a fixed date.
 */
export async function seed(referenceDate: CalendarDate): Promise<SeedResult> {
  if (await isSeeded()) {
    throw new Error(
      'Database is not empty — refusing to seed.\n' +
        'This seed is deliberately not idempotent. Reset the database first.'
    )
  }

  const database = db()

  const [business] = await database
    .insert(businesses)
    .values({
      name: 'sittter',
      contactEmail: SEED_ADMIN_EMAILS[0],
      contactPhone: '555-0100',
      timezone: 'America/New_York',
      digestLocalHour: 7,
    })
    .returning()
  if (!business) throw new Error('seed: business insert returned no row')

  const adminRows = await database
    .insert(admins)
    .values([
      { businessId: business.id, email: SEED_ADMIN_EMAILS[0], name: 'Sitter' },
      { businessId: business.id, email: 'co-admin+sittter@example.com', name: 'Co-administrator' },
    ])
    .returning()

  const customerRows = await database
    .insert(customers)
    .values([
      {
        businessId: business.id,
        name: 'Dana Whitfield',
        email: 'dana@example.com',
        phone: '555-0111',
        notes: 'Prefers texts. Admin-only note; never shown to the customer.',
      },
      {
        businessId: business.id,
        name: 'Ray Okonkwo',
        email: 'ray@example.com',
        phone: '555-0122',
        notes: 'Gate code changes each season. Admin-only note.',
      },
    ])
    .returning()

  const [firstCustomer, secondCustomer] = customerRows
  if (!firstCustomer || !secondCustomer)
    throw new Error('seed: customer insert returned too few rows')

  const propertyRows = await database
    .insert(properties)
    .values([
      {
        businessId: business.id,
        customerId: firstCustomer.id,
        nickname: 'Maple Street',
        address: '14 Maple Street',
        accessNotes: 'Side door sticks. ADMIN ONLY.',
        accessCodes: '4417',
      },
      {
        businessId: business.id,
        customerId: secondCustomer.id,
        nickname: 'Oak Lane',
        address: '2 Oak Lane',
        accessNotes: 'Key under the third planter. ADMIN ONLY.',
        accessCodes: '9082',
      },
    ])
    .returning()

  const [firstProperty, secondProperty] = propertyRows
  if (!firstProperty || !secondProperty)
    throw new Error('seed: property insert returned too few rows')

  await database.insert(careInstructions).values([
    {
      businessId: business.id,
      propertyId: firstProperty.id,
      label: 'Feed the cat',
      detail: 'Half a tin, morning only.',
      cadence: 'every_day',
      weatherRelevant: false,
      sortOrder: 0,
    },
    {
      businessId: business.id,
      propertyId: firstProperty.id,
      label: 'Water the plants',
      detail: 'The ferns on the back porch.',
      cadence: 'every_other_day',
      weatherRelevant: true,
      sortOrder: 1,
    },
    {
      businessId: business.id,
      propertyId: secondProperty.id,
      label: 'Walk the dog',
      detail: 'Twice round the block.',
      cadence: 'every_day',
      weatherRelevant: true,
      sortOrder: 0,
    },
  ])

  // The business default pricing profile, matching DEFAULT_PRICING_COMPONENTS.
  await database.insert(pricingComponents).values([
    {
      businessId: business.id,
      bookingId: null,
      type: 'per_day',
      label: 'Daily rate',
      amountCents: 500,
      sortOrder: 0,
    },
    {
      businessId: business.id,
      bookingId: null,
      type: 'per_visit',
      label: 'Per visit',
      amountCents: 600,
      sortOrder: 1,
    },
  ])

  const firmedAt = new Date('2026-01-01T12:00:00Z')
  const checkedAt = new Date('2026-01-02T12:00:00Z')

  const bookingRows = await database
    .insert(bookings)
    .values([
      // 1 — both flags set, starts in 5 days → confirmed
      {
        businessId: business.id,
        propertyId: firstProperty.id,
        startDate: addDays(referenceDate, 5),
        endDate: addDays(referenceDate, 12),
        datesApproximate: false,
        datesFirmAt: firmedAt,
        availabilityCheckedAt: checkedAt,
      },
      // 2 — dates firm, availability not checked, starts in 3 weeks → tentative
      {
        businessId: business.id,
        propertyId: secondProperty.id,
        startDate: addDays(referenceDate, 21),
        endDate: addDays(referenceDate, 26),
        datesApproximate: false,
        datesFirmAt: firmedAt,
        availabilityCheckedAt: null,
      },
      // 3 — no dates at all → inquiry
      {
        businessId: business.id,
        propertyId: firstProperty.id,
        startDate: null,
        endDate: null,
        datesApproximate: true,
        datesFirmAt: null,
        availabilityCheckedAt: null,
      },
    ])
    .returning()

  return {
    businessId: business.id,
    adminIds: adminRows.map((r) => r.id),
    customerIds: customerRows.map((r) => r.id),
    bookingIds: bookingRows.map((r) => r.id),
  }
}

/** Entry point for `pnpm db:seed`. */
async function main(): Promise<void> {
  // The seed script runs outside Next.js, which is the only thing that loads
  // a .env file on its own.
  await import('dotenv/config')

  const today = toCalendarDate(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.APP_TIMEZONE ?? 'America/New_York',
    }).format(new Date())
  )

  const result = await seed(today)
  console.log(`Seeded against ${today}`)
  console.log(`  business  ${result.businessId}`)
  console.log(`  admins    ${result.adminIds.length}`)
  console.log(`  customers ${result.customerIds.length}`)
  console.log(`  bookings  ${result.bookingIds.length}`)
}

// Run only when invoked directly, not when imported by a test.
if (process.argv[1]?.endsWith('seed.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
