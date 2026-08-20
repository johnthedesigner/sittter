/**
 * Pricing service tests.
 *
 * The one that matters most is 9.1.6: raising the business default must not
 * change a confirmed booking's total. That is what the snapshot is for, and
 * it is why the snapshot copies COMPONENTS rather than storing a total.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { toCalendarDate } from '@/core/dates'
import { createAdmin } from '@/db/repositories/admins'
import { createBusiness } from '@/db/repositories/businesses'
import { createCustomer } from '@/db/repositories/customers'
import { createProperty } from '@/db/repositories/properties'
import { createBooking, getBooking } from '@/db/repositories/bookings'
import { createVisit } from '@/db/repositories/visits'
import { createPricingComponent, listAdhocLineItems } from '@/db/repositories/pricing'
import { listActivityForBooking } from '@/db/repositories/activity'
import { resetDatabase } from '@/db/testing/database'

import {
  PricingError,
  addAdhoc,
  overrideCounts,
  priceBookingById,
  saveComponent,
  snapshotPricing,
  summaryText,
} from './pricing'

const TODAY = toCalendarDate('2026-08-17')
const NOW = new Date('2026-08-17T12:00:00Z')

/** A seven-day booking with four visits, matching the §6.1 worked example. */
async function fixture() {
  const business = await createBusiness({ name: 'sittter', contactEmail: 'h@example.com' })
  const admin = await createAdmin(business.id, { email: 'k@example.com', name: 'Kate Miller' })
  const customer = await createCustomer(business.id, { name: 'Dana Whitfield' })
  const property = await createProperty(business.id, {
    customerId: customer.id,
    nickname: 'Maple Street',
  })
  const booking = await createBooking(business.id, {
    propertyId: property.id,
    startDate: '2026-08-15',
    endDate: '2026-08-21',
  })

  await createPricingComponent(business.id, {
    bookingId: null,
    type: 'per_day',
    label: 'Daily rate',
    amountCents: 500,
    sortOrder: 0,
  })
  await createPricingComponent(business.id, {
    bookingId: null,
    type: 'per_visit',
    label: 'Per visit',
    amountCents: 600,
    sortOrder: 1,
  })

  for (const date of ['2026-08-15', '2026-08-17', '2026-08-19', '2026-08-21']) {
    await createVisit(business.id, { bookingId: booking.id, visitDate: date })
  }

  return { business, admin, booking, customer, property }
}

beforeEach(async () => {
  await resetDatabase()
})

describe('priceBookingById', () => {
  it('reproduces the worked example: 7 days and 4 visits for 5900 cents', async () => {
    const { business, booking } = await fixture()
    const priced = await priceBookingById(business.id, booking.id)

    expect(priced!.dayCount).toBe(7)
    expect(priced!.visitCount).toBe(4)
    expect(priced!.lineItems.map((i) => [i.label, i.basis, i.amountCents])).toEqual([
      ['Daily rate', '7 days at $5.00', 3500],
      ['Per visit', '4 visits at $6.00', 2400],
    ])
    expect(priced!.totalCents).toBe(5900)
    expect(priced!.isSnapshot).toBe(false)
  })

  it('every amount is an integer', async () => {
    const { business, booking } = await fixture()
    const priced = await priceBookingById(business.id, booking.id)
    for (const item of priced!.lineItems) {
      expect(Number.isInteger(item.amountCents)).toBe(true)
      expect(Number.isInteger(item.unitAmountCents)).toBe(true)
    }
    expect(Number.isInteger(priced!.totalCents)).toBe(true)
  })
})

describe('the snapshot — journey step 9.1.6', () => {
  it('RAISING THE BUSINESS DEFAULT DOES NOT CHANGE A SNAPSHOTTED BOOKING', async () => {
    const { business, booking } = await fixture()
    await snapshotPricing(business.id, booking.id, NOW)

    const before = await priceBookingById(business.id, booking.id)
    expect(before!.totalCents).toBe(5900)
    expect(before!.isSnapshot).toBe(true)

    // The business raises its daily rate from $5.00 to $9.00.
    const defaults = (await import('@/db/repositories/pricing')).listDefaultPricingComponents
    const rows = await defaults(business.id)
    const perDay = rows.find((r) => r.type === 'per_day')!
    await saveComponent(business.id, {
      id: perDay.id,
      bookingId: null,
      type: 'per_day',
      label: 'Daily rate',
      amountCents: 900,
      sortOrder: 0,
    })

    const after = await priceBookingById(business.id, booking.id)
    expect(after!.totalCents).toBe(5900)
  })

  it('a snapshotted booking still recalculates when a visit is added', async () => {
    const { business, booking } = await fixture()
    await snapshotPricing(business.id, booking.id, NOW)
    await createVisit(business.id, { bookingId: booking.id, visitDate: '2026-08-16' })

    const priced = await priceBookingById(business.id, booking.id)
    // Five visits now: the snapshot froze the RATES, not the answer.
    expect(priced!.visitCount).toBe(5)
    expect(priced!.totalCents).toBe(3500 + 5 * 600)
  })

  it('is idempotent — a second call does not duplicate components', async () => {
    const { business, booking } = await fixture()
    await snapshotPricing(business.id, booking.id, NOW)
    await snapshotPricing(business.id, booking.id, NOW)

    const priced = await priceBookingById(business.id, booking.id)
    expect(priced!.lineItems).toHaveLength(2)
    expect(priced!.totalCents).toBe(5900)
  })

  it('records when the snapshot was taken', async () => {
    const { business, booking } = await fixture()
    await snapshotPricing(business.id, booking.id, NOW)
    const row = await getBooking(business.id, booking.id)
    expect(row!.pricingSnapshotAt!.toISOString()).toBe(NOW.toISOString())
  })

  it('no total is stored on the booking — there is no column for one', async () => {
    const { business, booking } = await fixture()
    await snapshotPricing(business.id, booking.id, NOW)
    const row = await getBooking(business.id, booking.id)
    expect(row).not.toHaveProperty('totalCents')
    expect(row).not.toHaveProperty('total')
  })
})

describe('count overrides — journey step 9.1.2', () => {
  it('overriding the day count recalculates WITHOUT changing the dates', async () => {
    const { business, admin, booking } = await fixture()
    await overrideCounts(business.id, admin.id, admin.name, booking.id, 6, null, TODAY)

    const priced = await priceBookingById(business.id, booking.id)
    expect(priced!.dayCount).toBe(6)
    expect(priced!.dayCountWasOverridden).toBe(true)
    expect(priced!.totalCents).toBe(6 * 500 + 4 * 600)

    const row = await getBooking(business.id, booking.id)
    expect(row!.startDate).toBe('2026-08-15')
    expect(row!.endDate).toBe('2026-08-21')
  })

  it('writes the Reference data system entry, attributed', async () => {
    const { business, admin, booking } = await fixture()
    await overrideCounts(business.id, admin.id, admin.name, booking.id, 6, null, TODAY)
    const entries = await listActivityForBooking(business.id, booking.id)
    const system = entries.find((e) => e.isSystem)
    expect(system!.note).toBe('Kate Miller set the day count to 6.')
    expect(system!.actorId).toBe(admin.id)
  })

  it('clearing an override returns to the derived count', async () => {
    const { business, admin, booking } = await fixture()
    await overrideCounts(business.id, admin.id, admin.name, booking.id, 6, null, TODAY)
    await overrideCounts(business.id, admin.id, admin.name, booking.id, null, null, TODAY)
    const priced = await priceBookingById(business.id, booking.id)
    expect(priced!.dayCount).toBe(7)
    expect(priced!.dayCountWasOverridden).toBe(false)
  })

  it('rejects a negative or fractional count', async () => {
    const { business, admin, booking } = await fixture()
    await expect(
      overrideCounts(business.id, admin.id, admin.name, booking.id, -1, null, TODAY)
    ).rejects.toBeInstanceOf(PricingError)
    await expect(
      overrideCounts(business.id, admin.id, admin.name, booking.id, 1.5, null, TODAY)
    ).rejects.toBeInstanceOf(PricingError)
  })
})

describe('ad-hoc line items — steps 9.1.3 and 9.1.4', () => {
  it('a positive amount raises the total', async () => {
    const { business, booking } = await fixture()
    await addAdhoc(business.id, booking.id, 'Cat litter', 1500, 0)
    const priced = await priceBookingById(business.id, booking.id)
    expect(priced!.totalCents).toBe(5900 + 1500)
  })

  it('a NEGATIVE amount lowers it', async () => {
    const { business, booking } = await fixture()
    await addAdhoc(business.id, booking.id, 'Returning customer discount', -1000, 0)
    const priced = await priceBookingById(business.id, booking.id)
    expect(priced!.totalCents).toBe(5900 - 1000)

    const discount = priced!.lineItems.find((i) => i.source === 'adhoc')
    expect(discount!.amountCents).toBe(-1000)
  })

  it('rejects a non-integer amount', async () => {
    const { business, booking } = await fixture()
    await expect(addAdhoc(business.id, booking.id, 'Bad', 12.5, 0)).rejects.toBeInstanceOf(
      PricingError
    )
  })

  it('persists so the row can be removed later', async () => {
    const { business, booking } = await fixture()
    await addAdhoc(business.id, booking.id, 'Cat litter', 1500, 0)
    expect(await listAdhocLineItems(business.id, booking.id)).toHaveLength(1)
  })
})

describe('summaryText — journey step 9.1.5', () => {
  it('is plain text, itemized, with a total', async () => {
    const { business, booking } = await fixture()
    const priced = await priceBookingById(business.id, booking.id)
    const text = summaryText('Dana Whitfield', 'Maple Street', priced!)

    expect(text).toContain('Dana Whitfield — Maple Street')
    expect(text).toContain('Daily rate: 7 days at $5.00 — $35.00')
    expect(text).toContain('Per visit: 4 visits at $6.00 — $24.00')
    expect(text).toContain('Total: $59.00')
    expect(text).not.toMatch(/<[a-z]/i)
  })

  it('formats a negative line item', async () => {
    const { business, booking } = await fixture()
    await addAdhoc(business.id, booking.id, 'Discount', -1000, 0)
    const priced = await priceBookingById(business.id, booking.id)
    const text = summaryText('Dana', 'Maple', priced!)
    expect(text).toContain('-$10.00')
    expect(text).toContain('Total: $49.00')
  })
})
