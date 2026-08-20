/**
 * Date-change service tests. The system entry and the validation that keeps
 * a check constraint from ever being the thing a user meets.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { toCalendarDate } from '@/core/dates'
import { createAdmin } from '@/db/repositories/admins'
import { createBusiness } from '@/db/repositories/businesses'
import { createCustomer } from '@/db/repositories/customers'
import { createProperty, getProperty } from '@/db/repositories/properties'
import { createBooking, getBooking } from '@/db/repositories/bookings'
import { listActivityForBooking } from '@/db/repositories/activity'
import { resetDatabase } from '@/db/testing/database'

import { CaptureError, changeBookingDates, updatePropertyDetails } from './bookings'

const TODAY = toCalendarDate('2026-08-17')

async function fixture() {
  const business = await createBusiness({ name: 'sittter', contactEmail: 'h@example.com' })
  const admin = await createAdmin(business.id, { email: 'k@example.com', name: 'Kate Miller' })
  const customer = await createCustomer(business.id, { name: 'Dana' })
  const property = await createProperty(business.id, { customerId: customer.id, nickname: 'Maple' })
  const booking = await createBooking(business.id, { propertyId: property.id })
  return { business, admin, property, booking }
}

beforeEach(async () => {
  await resetDatabase()
})

describe('changeBookingDates', () => {
  it('persists the new range and the approximate flag', async () => {
    const { business, admin, booking } = await fixture()
    await changeBookingDates(
      business.id,
      admin.id,
      admin.name,
      booking.id,
      { startDate: '2026-09-01', endDate: '2026-09-07', datesApproximate: false },
      TODAY
    )
    const updated = await getBooking(business.id, booking.id)
    expect(updated!.startDate).toBe('2026-09-01')
    expect(updated!.endDate).toBe('2026-09-07')
    expect(updated!.datesApproximate).toBe(false)
  })

  it('writes the exact Reference data system entry, attributed', async () => {
    const { business, admin, booking } = await fixture()
    await changeBookingDates(
      business.id,
      admin.id,
      admin.name,
      booking.id,
      { startDate: '2026-09-01', endDate: '2026-09-07', datesApproximate: true },
      TODAY
    )
    const entries = await listActivityForBooking(business.id, booking.id)
    const system = entries.find((e) => e.isSystem)
    expect(system!.note).toBe('Kate Miller changed the dates to 2026-09-01–2026-09-07.')
    expect(system!.actorId).toBe(admin.id)
  })

  it('writes no entry when the dates did not actually change', async () => {
    const { business, admin, booking } = await fixture()
    const set = { startDate: '2026-09-01', endDate: '2026-09-07', datesApproximate: true }
    await changeBookingDates(business.id, admin.id, admin.name, booking.id, set, TODAY)
    await changeBookingDates(business.id, admin.id, admin.name, booking.id, set, TODAY)
    const entries = await listActivityForBooking(business.id, booking.id)
    expect(entries.filter((e) => e.isSystem)).toHaveLength(1)
  })

  it('REJECTS an inverted range before the write, so the constraint never surfaces', async () => {
    const { business, admin, booking } = await fixture()
    await expect(
      changeBookingDates(
        business.id,
        admin.id,
        admin.name,
        booking.id,
        { startDate: '2026-09-07', endDate: '2026-09-01', datesApproximate: true },
        TODAY
      )
    ).rejects.toBeInstanceOf(CaptureError)

    // Unchanged, and no activity entry written.
    const unchanged = await getBooking(business.id, booking.id)
    expect(unchanged!.startDate).toBeNull()
    expect(await listActivityForBooking(business.id, booking.id)).toEqual([])
  })

  it('allows clearing the dates back to none', async () => {
    const { business, admin, booking } = await fixture()
    await changeBookingDates(
      business.id,
      admin.id,
      admin.name,
      booking.id,
      { startDate: '2026-09-01', endDate: '2026-09-07', datesApproximate: true },
      TODAY
    )
    await changeBookingDates(
      business.id,
      admin.id,
      admin.name,
      booking.id,
      { startDate: null, endDate: null, datesApproximate: true },
      TODAY
    )
    const updated = await getBooking(business.id, booking.id)
    expect(updated!.startDate).toBeNull()
    expect(updated!.endDate).toBeNull()
  })
})

describe('updatePropertyDetails', () => {
  it('persists the address and the admin-only fields', async () => {
    const { business, property } = await fixture()
    await updatePropertyDetails(business.id, property.id, {
      nickname: 'Maple Street',
      address: '14 Maple Street',
      accessNotes: 'Side door sticks',
      accessCodes: '4417',
    })
    const updated = await getProperty(business.id, property.id)
    expect(updated!.nickname).toBe('Maple Street')
    expect(updated!.address).toBe('14 Maple Street')
    expect(updated!.accessNotes).toBe('Side door sticks')
    expect(updated!.accessCodes).toBe('4417')
  })

  it('stores a blank field as null rather than an empty string', async () => {
    const { business, property } = await fixture()
    await updatePropertyDetails(business.id, property.id, {
      nickname: 'Maple',
      address: '   ',
      accessNotes: '',
      accessCodes: null,
    })
    const updated = await getProperty(business.id, property.id)
    expect(updated!.address).toBeNull()
    expect(updated!.accessNotes).toBeNull()
    expect(updated!.accessCodes).toBeNull()
  })

  it('requires a nickname', async () => {
    const { business, property } = await fixture()
    await expect(
      updatePropertyDetails(business.id, property.id, {
        nickname: '  ',
        address: null,
        accessNotes: null,
        accessCodes: null,
      })
    ).rejects.toBeInstanceOf(CaptureError)
  })
})
