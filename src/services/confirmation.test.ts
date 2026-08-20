/**
 * Confirmation transition tests.
 *
 * The isolated-submission rule in `docs/spec.md` §5.5 is enforced by the
 * SIGNATURE of `setAvailabilityChecked`: it takes a booking, a boolean, and
 * nothing else. There is no argument through which another change could ride
 * along, which is what makes a combined save structurally impossible rather
 * than merely discouraged.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { toCalendarDate } from '@/core/dates'
import { deriveStatus } from '@/core/status'
import { createAdmin } from '@/db/repositories/admins'
import { createBusiness } from '@/db/repositories/businesses'
import { createCustomer } from '@/db/repositories/customers'
import { createProperty } from '@/db/repositories/properties'
import { createBooking, getBooking } from '@/db/repositories/bookings'
import { listActivityForBooking } from '@/db/repositories/activity'
import { resetDatabase } from '@/db/testing/database'
import { toBookingCore } from './home'

import {
  TRANSITION_ENTRIES,
  cancelBooking,
  declineBooking,
  markPaid,
  setAvailabilityChecked,
  setDatesFirm,
} from './bookings'

const TODAY = toCalendarDate('2026-08-17')
const NOW = new Date('2026-08-17T12:00:00Z')

async function fixture(bookingOverrides = {}) {
  const business = await createBusiness({ name: 'sittter', contactEmail: 'h@example.com' })
  const kate = await createAdmin(business.id, { email: 'kate@example.com', name: 'Kate Miller' })
  const sam = await createAdmin(business.id, { email: 'sam@example.com', name: 'Sam Reyes' })
  const customer = await createCustomer(business.id, { name: 'Dana' })
  const property = await createProperty(business.id, { customerId: customer.id, nickname: 'Maple' })
  const booking = await createBooking(business.id, {
    propertyId: property.id,
    startDate: '2026-08-25',
    endDate: '2026-08-30',
    ...bookingOverrides,
  })
  return { business, kate, sam, booking }
}

async function statusOf(businessId: string, bookingId: string, today = TODAY) {
  const row = await getBooking(businessId, bookingId)
  return deriveStatus(toBookingCore(row!), today)
}

beforeEach(async () => {
  await resetDatabase()
})

describe('the two flags are independent', () => {
  it('setting only dates-firm leaves the booking tentative', async () => {
    const { business, kate, booking } = await fixture()
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)

    const row = await getBooking(business.id, booking.id)
    expect(row!.datesFirmAt).not.toBeNull()
    expect(row!.availabilityCheckedAt).toBeNull()
    expect(await statusOf(business.id, booking.id)).toBe('tentative')
  })

  it('setting only availability leaves the booking tentative', async () => {
    const { business, kate, booking } = await fixture()
    await setAvailabilityChecked(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    expect(await statusOf(business.id, booking.id)).toBe('tentative')
  })

  it('BOTH flags plus both dates derive confirmed', async () => {
    const { business, kate, sam, booking } = await fixture()
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    await setAvailabilityChecked(business.id, sam.id, sam.name, booking.id, true, NOW, TODAY)
    expect(await statusOf(business.id, booking.id)).toBe('confirmed')
  })

  it('both flags without dates is still an inquiry', async () => {
    const { business, kate, booking } = await fixture({ startDate: null, endDate: null })
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    await setAvailabilityChecked(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    expect(await statusOf(business.id, booking.id)).toBe('inquiry')
  })
})

describe('attribution', () => {
  it('records the acting admin and an instant on each flag', async () => {
    const { business, kate, sam, booking } = await fixture()
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    await setAvailabilityChecked(business.id, sam.id, sam.name, booking.id, true, NOW, TODAY)

    const row = await getBooking(business.id, booking.id)
    expect(row!.datesFirmBy).toBe(kate.id)
    expect(row!.availabilityCheckedBy).toBe(sam.id)
    expect(row!.datesFirmAt!.toISOString()).toBe(NOW.toISOString())
  })

  it('ANY admin may set or unset either flag — no role restriction', async () => {
    const { business, kate, sam, booking } = await fixture()
    // Kate sets it, Sam clears it, Sam sets it again.
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    await setDatesFirm(business.id, sam.id, sam.name, booking.id, false, NOW, TODAY)
    await setDatesFirm(business.id, sam.id, sam.name, booking.id, true, NOW, TODAY)

    const row = await getBooking(business.id, booking.id)
    expect(row!.datesFirmBy).toBe(sam.id)
  })

  it('unsetting clears BOTH the instant and the actor', async () => {
    const { business, kate, booking } = await fixture()
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, false, NOW, TODAY)

    const row = await getBooking(business.id, booking.id)
    expect(row!.datesFirmAt).toBeNull()
    expect(row!.datesFirmBy).toBeNull()
  })
})

describe('system entries', () => {
  it('writes the exact Reference data text for each flag transition', async () => {
    const { business, kate, booking } = await fixture()
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, false, NOW, TODAY)
    await setAvailabilityChecked(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    await setAvailabilityChecked(business.id, kate.id, kate.name, booking.id, false, NOW, TODAY)

    const notes = (await listActivityForBooking(business.id, booking.id)).map((e) => e.note)
    expect(notes).toContain("Kate Miller marked the customer's dates firm.")
    expect(notes).toContain('Kate Miller cleared the dates-firm flag.')
    expect(notes).toContain('Kate Miller checked the family calendar.')
    expect(notes).toContain('Kate Miller cleared the calendar check.')
  })

  it('writes nothing when the flag is already in that state', async () => {
    const { business, kate, booking } = await fixture()
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    const entries = await listActivityForBooking(business.id, booking.id)
    expect(entries).toHaveLength(1)
  })

  it('every system entry is attributed and marked as a system entry', async () => {
    const { business, kate, booking } = await fixture()
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    const entry = (await listActivityForBooking(business.id, booking.id))[0]!
    expect(entry.actorId).toBe(kate.id)
    expect(entry.isSystem).toBe(true)
    expect(entry.source).toBe('app')
  })
})

describe('terminal transitions', () => {
  it('declined outranks a past end date and a paid date', async () => {
    const { business, kate, booking } = await fixture({
      startDate: '2026-08-01',
      endDate: '2026-08-07',
    })
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    await setAvailabilityChecked(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    await markPaid(
      business.id,
      kate.id,
      kate.name,
      booking.id,
      toCalendarDate('2026-08-08'),
      'Cash',
      TODAY
    )
    expect(await statusOf(business.id, booking.id)).toBe('closed')

    await declineBooking(business.id, kate.id, kate.name, booking.id, NOW, TODAY)
    expect(await statusOf(business.id, booking.id)).toBe('declined')
  })

  it('cancelled outranks everything, declined included', async () => {
    const { business, kate, booking } = await fixture()
    await declineBooking(business.id, kate.id, kate.name, booking.id, NOW, TODAY)
    await cancelBooking(business.id, kate.id, kate.name, booking.id, NOW, TODAY)
    expect(await statusOf(business.id, booking.id)).toBe('cancelled')
  })

  it('writes the Reference data text for decline and cancel', async () => {
    const { business, kate, booking } = await fixture()
    await declineBooking(business.id, kate.id, kate.name, booking.id, NOW, TODAY)
    await cancelBooking(business.id, kate.id, kate.name, booking.id, NOW, TODAY)
    const notes = (await listActivityForBooking(business.id, booking.id)).map((e) => e.note)
    expect(notes).toContain(TRANSITION_ENTRIES.declined('Kate Miller'))
    expect(notes).toContain(TRANSITION_ENTRIES.cancelled('Kate Miller'))
  })
})

describe('markPaid', () => {
  it('records a calendar date and a method note, and derives closed once past', async () => {
    const { business, kate, booking } = await fixture({
      startDate: '2026-08-01',
      endDate: '2026-08-07',
    })
    await setDatesFirm(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    await setAvailabilityChecked(business.id, kate.id, kate.name, booking.id, true, NOW, TODAY)
    expect(await statusOf(business.id, booking.id)).toBe('complete')

    await markPaid(
      business.id,
      kate.id,
      kate.name,
      booking.id,
      toCalendarDate('2026-08-08'),
      'Venmo',
      TODAY
    )

    const row = await getBooking(business.id, booking.id)
    expect(row!.paidAt).toBe('2026-08-08')
    expect(row!.paidMethodNote).toBe('Venmo')
    expect(await statusOf(business.id, booking.id)).toBe('closed')
  })

  it('stores a blank method note as null', async () => {
    const { business, kate, booking } = await fixture()
    await markPaid(business.id, kate.id, kate.name, booking.id, TODAY, '   ', TODAY)
    const row = await getBooking(business.id, booking.id)
    expect(row!.paidMethodNote).toBeNull()
  })
})
