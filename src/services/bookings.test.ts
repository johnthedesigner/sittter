/**
 * Capture service integration tests.
 *
 * Runs against the Neon `test` branch. Asserts persisted state, not the
 * return value alone.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { toCalendarDate } from '@/core/dates'
import { deriveStatus } from '@/core/status'
import { createAdmin } from '@/db/repositories/admins'
import { createBusiness } from '@/db/repositories/businesses'
import { listActivityForBooking } from '@/db/repositories/activity'
import { getBooking, listBookings } from '@/db/repositories/bookings'
import { listCustomers } from '@/db/repositories/customers'
import { listProperties, listPropertiesForCustomer } from '@/db/repositories/properties'
import { resetDatabase } from '@/db/testing/database'
import { toBookingCore } from './home'

import {
  CaptureError,
  DEFAULT_PROPERTY_NICKNAME,
  captureBooking,
  validateCapture,
} from './bookings'
import type { CaptureInput } from './bookings'

const TODAY = toCalendarDate('2026-08-17')

async function fixture() {
  const business = await createBusiness({ name: 'sittter', contactEmail: 'h@example.com' })
  const admin = await createAdmin(business.id, { email: 'sitter@example.com', name: 'Kate Miller' })
  return { business, admin }
}

function input(overrides: Partial<CaptureInput> = {}): CaptureInput {
  return {
    customerId: null,
    newCustomerName: 'Dana Whitfield',
    propertyId: null,
    newPropertyNickname: null,
    startDate: null,
    endDate: null,
    datesApproximate: true,
    note: null,
    ...overrides,
  }
}

async function capture(overrides: Partial<CaptureInput> = {}) {
  const { business, admin } = await fixture()
  const result = await captureBooking(business.id, admin.id, admin.name, input(overrides), TODAY)
  return { business, admin, result }
}

beforeEach(async () => {
  await resetDatabase()
})

describe('validateCapture', () => {
  it('requires a customer', () => {
    expect(validateCapture(input({ newCustomerName: null }))).toMatch(/customer name is required/i)
    expect(validateCapture(input({ newCustomerName: '   ' }))).toMatch(/customer name is required/i)
  })

  it('accepts a customer name and nothing else', () => {
    expect(validateCapture(input())).toBeNull()
  })

  it('rejects an end date before the start date, before anything is written', () => {
    const problem = validateCapture(input({ startDate: '2026-08-21', endDate: '2026-08-15' }))
    expect(problem).toBe('The end date cannot be before the start date.')
  })

  it('accepts a single-day range', () => {
    expect(validateCapture(input({ startDate: '2026-08-15', endDate: '2026-08-15' }))).toBeNull()
  })

  it('rejects a date that is not real', () => {
    expect(validateCapture(input({ startDate: '2026-02-30' }))).toMatch(/not a real date/i)
  })

  it('accepts a start date with no end date', () => {
    expect(validateCapture(input({ startDate: '2026-08-15' }))).toBeNull()
  })
})

describe('captureBooking — the minimum', () => {
  it('creates a booking from a customer name alone', async () => {
    const { business, result } = await capture()

    const customers = await listCustomers(business.id)
    expect(customers).toHaveLength(1)
    expect(customers[0]!.name).toBe('Dana Whitfield')
    // A customer created this way has a name and nothing else, and is valid.
    expect(customers[0]!.email).toBeNull()
    expect(customers[0]!.phone).toBeNull()
    expect(customers[0]!.notes).toBeNull()

    const booking = await getBooking(business.id, result.bookingId)
    expect(booking).not.toBeNull()
    expect(booking!.startDate).toBeNull()
    expect(booking!.endDate).toBeNull()
  })

  it('creates a property for a brand-new customer', async () => {
    const { business, result } = await capture()
    const properties = await listPropertiesForCustomer(business.id, result.customerId)
    expect(properties).toHaveLength(1)
    expect(properties[0]!.nickname).toBe(DEFAULT_PROPERTY_NICKNAME)
  })

  it('records the acting admin on the booking', async () => {
    const { business, admin, result } = await capture()
    const booking = await getBooking(business.id, result.bookingId)
    expect(booking!.createdBy).toBe(admin.id)
  })

  it('throws CaptureError, not a database error, when the customer is missing', async () => {
    const { business, admin } = await fixture()
    await expect(
      captureBooking(business.id, admin.id, admin.name, input({ newCustomerName: null }), TODAY)
    ).rejects.toBeInstanceOf(CaptureError)
  })

  it('writes nothing at all when validation fails', async () => {
    const { business, admin } = await fixture()
    await expect(
      captureBooking(
        business.id,
        admin.id,
        admin.name,
        input({ startDate: '2026-08-21', endDate: '2026-08-15' }),
        TODAY
      )
    ).rejects.toBeInstanceOf(CaptureError)

    expect(await listBookings(business.id)).toEqual([])
    expect(await listCustomers(business.id)).toEqual([])
    expect(await listProperties(business.id)).toEqual([])
  })
})

describe('captureBooking — derived status', () => {
  it('a booking with no dates derives inquiry', async () => {
    const { business, result } = await capture()
    const booking = await getBooking(business.id, result.bookingId)
    expect(deriveStatus(toBookingCore(booking!), TODAY)).toBe('inquiry')
  })

  it('a booking with dates derives tentative', async () => {
    const { business, result } = await capture({
      startDate: '2026-08-20',
      endDate: '2026-08-25',
    })
    const booking = await getBooking(business.id, result.bookingId)
    expect(booking!.startDate).toBe('2026-08-20')
    expect(booking!.endDate).toBe('2026-08-25')
    expect(deriveStatus(toBookingCore(booking!), TODAY)).toBe('tentative')
  })
})

describe('captureBooking — the activity log', () => {
  it('writes the note as the first entry, source app, not a system entry', async () => {
    const { business, result } = await capture({ note: 'Wants the cat fed twice a day.' })
    const entries = await listActivityForBooking(business.id, result.bookingId)

    const note = entries.find((e) => !e.isSystem)
    expect(note).toBeDefined()
    expect(note!.note).toBe('Wants the cat fed twice a day.')
    expect(note!.source).toBe('app')
    expect(note!.isSystem).toBe(false)
    expect(note!.entryDate).toBe(TODAY)

    // First in the log's history: created before the system entry.
    const system = entries.find((e) => e.isSystem)!
    expect(note!.createdAt.getTime()).toBeLessThanOrEqual(system.createdAt.getTime())
  })

  it('writes the system entry with the exact Reference data text, attributed', async () => {
    const { business, admin, result } = await capture()
    const entries = await listActivityForBooking(business.id, result.bookingId)

    const system = entries.find((e) => e.isSystem)
    expect(system).toBeDefined()
    expect(system!.note).toBe('Kate Miller created this booking.')
    expect(system!.actorId).toBe(admin.id)
    expect(system!.isSystem).toBe(true)
  })

  it('writes only the system entry when there is no note', async () => {
    const { business, result } = await capture({ note: null })
    const entries = await listActivityForBooking(business.id, result.bookingId)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.isSystem).toBe(true)
  })

  it('trims a note and ignores one that is only whitespace', async () => {
    const { business, result } = await capture({ note: '   ' })
    const entries = await listActivityForBooking(business.id, result.bookingId)
    expect(entries).toHaveLength(1)
  })
})

describe('captureBooking — existing customers and properties', () => {
  it('reuses an existing customer rather than creating a second', async () => {
    const { business, admin } = await fixture()
    const first = await captureBooking(business.id, admin.id, admin.name, input(), TODAY)
    await captureBooking(
      business.id,
      admin.id,
      admin.name,
      input({ customerId: first.customerId, newCustomerName: null, propertyId: first.propertyId }),
      TODAY
    )
    expect(await listCustomers(business.id)).toHaveLength(1)
    expect(await listProperties(business.id)).toHaveLength(1)
    expect(await listBookings(business.id)).toHaveLength(2)
  })

  it('creates a second property for an existing customer when none is chosen', async () => {
    const { business, admin } = await fixture()
    const first = await captureBooking(business.id, admin.id, admin.name, input(), TODAY)
    await captureBooking(
      business.id,
      admin.id,
      admin.name,
      input({
        customerId: first.customerId,
        newCustomerName: null,
        newPropertyNickname: 'Beach house',
      }),
      TODAY
    )
    const properties = await listPropertiesForCustomer(business.id, first.customerId)
    expect(properties.map((p) => p.nickname).sort()).toEqual(['Beach house', 'Home'])
  })
})
