/**
 * Visit generation, regeneration, and the preservation rules.
 *
 * `generateVisits` in `src/core/schedule.ts` is the only scheduler; these
 * tests are about what happens to rows that already exist, which is the part
 * Phase 0 left to the service layer.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { toCalendarDate } from '@/core/dates'
import { createAdmin } from '@/db/repositories/admins'
import { createBusiness } from '@/db/repositories/businesses'
import { createCustomer } from '@/db/repositories/customers'
import { createProperty } from '@/db/repositories/properties'
import { createBooking, updateBooking } from '@/db/repositories/bookings'
import { createCareInstruction } from '@/db/repositories/care-instructions'
import { createVisitLog } from '@/db/repositories/visit-logs'
import { listActivityForBooking } from '@/db/repositories/activity'
import { listVisitTaskIds, listVisitsForBooking } from '@/db/repositories/visits'
import { resetDatabase } from '@/db/testing/database'

import {
  VisitError,
  addVisit,
  generateVisitsOnConfirmation,
  planRegeneration,
  regenerateVisitsForBooking,
  removeVisit,
} from './visits'
import { setAvailabilityChecked, setDatesFirm } from './bookings'

const TODAY = toCalendarDate('2026-08-17')
const NOW = new Date('2026-08-17T12:00:00Z')

/** A 7-day booking with a daily cat and an every-other-day plant. */
async function fixture() {
  const business = await createBusiness({ name: 'sittter', contactEmail: 'h@example.com' })
  const admin = await createAdmin(business.id, { email: 'k@example.com', name: 'Kate Miller' })
  const customer = await createCustomer(business.id, { name: 'Dana' })
  const property = await createProperty(business.id, { customerId: customer.id, nickname: 'Maple' })
  const booking = await createBooking(business.id, {
    propertyId: property.id,
    startDate: '2026-08-20',
    endDate: '2026-08-26',
  })
  const cat = await createCareInstruction(business.id, {
    propertyId: property.id,
    label: 'Feed the cat',
    cadence: 'every_day',
    sortOrder: 0,
  })
  const plant = await createCareInstruction(business.id, {
    propertyId: property.id,
    label: 'Water the plants',
    cadence: 'every_other_day',
    sortOrder: 1,
  })
  return { business, admin, property, booking, cat, plant }
}

async function regenerate(
  business: string,
  admin: { id: string; name: string },
  bookingId: string
) {
  return regenerateVisitsForBooking(business, admin.id, admin.name, bookingId, TODAY)
}

beforeEach(async () => {
  await resetDatabase()
})

describe('generation', () => {
  it('produces one visit per date, with both tasks on shared dates', async () => {
    const { business, admin, booking, cat, plant } = await fixture()
    await regenerate(business.id, admin, booking.id)

    const visits = await listVisitsForBooking(business.id, booking.id)
    expect(visits).toHaveLength(7)

    const byDate = new Map(visits.map((v) => [v.visitDate, v]))
    // 2026-08-20 is offset 0: both cadences land on it.
    const shared = await listVisitTaskIds(business.id, byDate.get('2026-08-20')!.id)
    expect([...shared].sort()).toEqual([cat.id, plant.id].sort())

    // 2026-08-21 is offset 1: the cat only.
    const catOnly = await listVisitTaskIds(business.id, byDate.get('2026-08-21')!.id)
    expect(catOnly).toEqual([cat.id])
  })

  it('generated visits default to the anytime window', async () => {
    const { business, admin, booking } = await fixture()
    await regenerate(business.id, admin, booking.id)
    const visits = await listVisitsForBooking(business.id, booking.id)
    for (const v of visits) expect(v.window).toBe('anytime')
  })

  it('surfaces skipped instructions with the reason src/core provides', async () => {
    const { business, booking, property } = await fixture()
    await createCareInstruction(business.id, {
      propertyId: property.id,
      label: 'Odd job',
      cadence: 'as_needed',
      sortOrder: 2,
    })

    const plan = await planRegeneration(business.id, booking.id)
    expect(plan.skipped).toHaveLength(1)
    expect(plan.skipped[0]!.label).toBe('Odd job')
    expect(plan.skipped[0]!.reason).toMatch(/as needed/i)
  })

  it('refuses to plan for a booking with no dates', async () => {
    const { business, booking } = await fixture()
    await updateBooking(business.id, booking.id, { startDate: null, endDate: null })
    await expect(planRegeneration(business.id, booking.id)).rejects.toBeInstanceOf(VisitError)
  })
})

describe('generation on confirmation', () => {
  it('generates when the second flag completes confirmation', async () => {
    const { business, admin, booking } = await fixture()

    await setDatesFirm(business.id, admin.id, admin.name, booking.id, true, NOW, TODAY)
    await generateVisitsOnConfirmation(business.id, admin.id, admin.name, booking.id, TODAY)
    expect(await listVisitsForBooking(business.id, booking.id)).toHaveLength(0)

    await setAvailabilityChecked(business.id, admin.id, admin.name, booking.id, true, NOW, TODAY)
    await generateVisitsOnConfirmation(business.id, admin.id, admin.name, booking.id, TODAY)
    expect(await listVisitsForBooking(business.id, booking.id)).toHaveLength(7)
  })

  it('does not rebuild a schedule that already exists', async () => {
    const { business, admin, booking } = await fixture()
    await setDatesFirm(business.id, admin.id, admin.name, booking.id, true, NOW, TODAY)
    await setAvailabilityChecked(business.id, admin.id, admin.name, booking.id, true, NOW, TODAY)
    await generateVisitsOnConfirmation(business.id, admin.id, admin.name, booking.id, TODAY)

    // An admin adds one by hand, then a flag is toggled off and on again.
    await addVisit(business.id, booking.id, toCalendarDate('2026-09-05'), 'morning', null)
    await setDatesFirm(business.id, admin.id, admin.name, booking.id, false, NOW, TODAY)
    await setDatesFirm(business.id, admin.id, admin.name, booking.id, true, NOW, TODAY)
    await generateVisitsOnConfirmation(business.id, admin.id, admin.name, booking.id, TODAY)

    const visits = await listVisitsForBooking(business.id, booking.id)
    expect(visits).toHaveLength(8)
    expect(visits.some((v) => v.visitDate === '2026-09-05')).toBe(true)
  })
})

describe('regeneration and preservation', () => {
  it('PRESERVES a logged visit the cadences no longer produce, and names it', async () => {
    const { business, admin, booking } = await fixture()
    await regenerate(business.id, admin, booking.id)

    // Log the last day, then shorten the booking so that date is out of range.
    const before = await listVisitsForBooking(business.id, booking.id)
    const last = before.find((v) => v.visitDate === '2026-08-26')!
    await createVisitLog(business.id, {
      visitId: last.id,
      outcome: 'completed',
      loggedDate: '2026-08-26',
    })
    await updateBooking(business.id, booking.id, { endDate: '2026-08-23' })

    const plan = await planRegeneration(business.id, booking.id)
    expect(plan.preservedLogged.map((v) => v.visitDate)).toContain('2026-08-26')

    await regenerate(business.id, admin, booking.id)

    const after = await listVisitsForBooking(business.id, booking.id)
    expect(after.some((v) => v.visitDate === '2026-08-26')).toBe(true)
  })

  it('removes an unlogged visit the cadences no longer produce', async () => {
    const { business, admin, booking } = await fixture()
    await regenerate(business.id, admin, booking.id)
    await updateBooking(business.id, booking.id, { endDate: '2026-08-23' })
    await regenerate(business.id, admin, booking.id)

    const after = await listVisitsForBooking(business.id, booking.id)
    expect(after.map((v) => v.visitDate)).toEqual([
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ])
  })

  it('writes the Reference data system entry, attributed', async () => {
    const { business, admin, booking } = await fixture()
    await regenerate(business.id, admin, booking.id)
    const entries = await listActivityForBooking(business.id, booking.id)
    const system = entries.find((e) => e.note.includes('regenerated the visits'))
    expect(system!.note).toBe('Kate Miller regenerated the visits.')
    expect(system!.actorId).toBe(admin.id)
    expect(system!.isSystem).toBe(true)
  })

  it('is idempotent — running it twice changes nothing', async () => {
    const { business, admin, booking } = await fixture()
    await regenerate(business.id, admin, booking.id)
    const first = await listVisitsForBooking(business.id, booking.id)
    await regenerate(business.id, admin, booking.id)
    const second = await listVisitsForBooking(business.id, booking.id)
    expect(second.map((v) => v.visitDate)).toEqual(first.map((v) => v.visitDate))
  })
})

describe('individual visit editing', () => {
  it('adds a visit on a date the cadences did not produce', async () => {
    const { business, admin, booking } = await fixture()
    await regenerate(business.id, admin, booking.id)
    await addVisit(business.id, booking.id, toCalendarDate('2026-08-27'), 'morning', 45)

    const visits = await listVisitsForBooking(business.id, booking.id)
    const added = visits.find((v) => v.visitDate === '2026-08-27')
    expect(added!.window).toBe('morning')
    expect(added!.durationMinutes).toBe(45)
  })

  it('refuses a second visit on the same date', async () => {
    const { business, admin, booking } = await fixture()
    await regenerate(business.id, admin, booking.id)
    await expect(
      addVisit(business.id, booking.id, toCalendarDate('2026-08-20'), 'morning', null)
    ).rejects.toBeInstanceOf(VisitError)
  })

  it('deletes an unlogged visit without a confirmation', async () => {
    const { business, admin, booking } = await fixture()
    await regenerate(business.id, admin, booking.id)
    const visits = await listVisitsForBooking(business.id, booking.id)
    await removeVisit(business.id, visits[0]!.id, false)
    expect(await listVisitsForBooking(business.id, booking.id)).toHaveLength(6)
  })

  it('REFUSES to delete a logged visit without a confirmation, then allows it', async () => {
    const { business, admin, booking } = await fixture()
    await regenerate(business.id, admin, booking.id)
    const visits = await listVisitsForBooking(business.id, booking.id)
    const target = visits[0]!
    await createVisitLog(business.id, {
      visitId: target.id,
      outcome: 'completed',
      loggedDate: target.visitDate,
    })

    await expect(removeVisit(business.id, target.id, false)).rejects.toBeInstanceOf(VisitError)
    expect(await listVisitsForBooking(business.id, booking.id)).toHaveLength(7)

    await removeVisit(business.id, target.id, true)
    expect(await listVisitsForBooking(business.id, booking.id)).toHaveLength(6)
  })
})
