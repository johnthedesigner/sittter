/**
 * Care instruction integration tests, including the shadowing rule.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { createBusiness } from '@/db/repositories/businesses'
import { createCustomer } from '@/db/repositories/customers'
import { createProperty } from '@/db/repositories/properties'
import { createBooking } from '@/db/repositories/bookings'
import {
  listCareInstructionsForBooking,
  listCareInstructionsForProperty,
} from '@/db/repositories/care-instructions'
import { resetDatabase } from '@/db/testing/database'
import type { CareInstructionRow } from '@/db/repositories/care-instructions'

import {
  CareInstructionError,
  effectiveInstructionsForBooking,
  removeCareInstruction,
  resolveEffectiveInstructions,
  upsertCareInstruction,
} from './care-instructions'

async function fixture() {
  const business = await createBusiness({ name: 'sittter', contactEmail: 'h@example.com' })
  const customer = await createCustomer(business.id, { name: 'Dana' })
  const property = await createProperty(business.id, { customerId: customer.id, nickname: 'Maple' })
  const booking = await createBooking(business.id, { propertyId: property.id })
  return { business, property, booking }
}

function row(overrides: Partial<CareInstructionRow> = {}): CareInstructionRow {
  return {
    id: 'x',
    businessId: 'b',
    propertyId: 'p',
    bookingId: null,
    label: 'Cats',
    detail: null,
    cadence: 'every_day',
    cadenceCustom: null,
    weatherRelevant: false,
    sortOrder: 0,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  }
}

beforeEach(async () => {
  await resetDatabase()
})

describe('resolveEffectiveInstructions — the shadowing rule', () => {
  it('returns property instructions when there are no overrides', () => {
    const result = resolveEffectiveInstructions([row({ id: 'a', label: 'Cats' })], [])
    expect(result).toHaveLength(1)
    expect(result[0]!.isOverride).toBe(false)
    expect(result[0]!.shadows).toBeNull()
  })

  it('a booking override SHADOWS the property instruction of the same label', () => {
    const property = row({ id: 'p1', label: 'Cats', detail: 'Once a day' })
    const override = row({
      id: 'b1',
      label: 'Cats',
      detail: 'Twice a day this time',
      propertyId: null,
      bookingId: 'bk',
    })

    const result = resolveEffectiveInstructions([property], [override])

    // One entry, not two — a sitter must not read two conflicting rules.
    expect(result).toHaveLength(1)
    expect(result[0]!.instruction.id).toBe('b1')
    expect(result[0]!.isOverride).toBe(true)
    expect(result[0]!.shadows?.id).toBe('p1')
  })

  it('matches labels case-insensitively and ignores surrounding space', () => {
    const property = row({ id: 'p1', label: 'Cats' })
    const override = row({ id: 'b1', label: ' cats ', propertyId: null, bookingId: 'bk' })
    const result = resolveEffectiveInstructions([property], [override])
    expect(result).toHaveLength(1)
    expect(result[0]!.instruction.id).toBe('b1')
  })

  it('an override with a new label is added, not substituted', () => {
    const property = row({ id: 'p1', label: 'Cats' })
    const override = row({
      id: 'b1',
      label: 'Bins',
      propertyId: null,
      bookingId: 'bk',
      sortOrder: 1,
    })
    const result = resolveEffectiveInstructions([property], [override])
    expect(result.map((r) => r.instruction.label)).toEqual(['Cats', 'Bins'])
    expect(result[1]!.shadows).toBeNull()
  })

  it('orders by sortOrder across both sources', () => {
    const result = resolveEffectiveInstructions(
      [row({ id: 'p1', label: 'Plants', sortOrder: 2 })],
      [row({ id: 'b1', label: 'Bins', propertyId: null, bookingId: 'bk', sortOrder: 1 })]
    )
    expect(result.map((r) => r.instruction.label)).toEqual(['Bins', 'Plants'])
  })
})

describe('upsertCareInstruction', () => {
  it('attaches to the PROPERTY by default, not the booking', async () => {
    const { business, property, booking } = await fixture()

    await upsertCareInstruction(business.id, {
      id: null,
      label: 'Cats',
      detail: 'Half a tin',
      cadence: 'every_day',
      cadenceCustom: null,
      weatherRelevant: false,
      sortOrder: 0,
      bookingOnly: false,
      propertyId: property.id,
      bookingId: booking.id,
    })

    expect(await listCareInstructionsForProperty(business.id, property.id)).toHaveLength(1)
    expect(await listCareInstructionsForBooking(business.id, booking.id)).toHaveLength(0)
  })

  it('"This booking only" attaches to the booking and leaves the property untouched', async () => {
    const { business, property, booking } = await fixture()

    await upsertCareInstruction(business.id, {
      id: null,
      label: 'Cats',
      detail: 'Standing arrangement',
      cadence: 'every_day',
      cadenceCustom: null,
      weatherRelevant: false,
      sortOrder: 0,
      bookingOnly: false,
      propertyId: property.id,
      bookingId: booking.id,
    })
    await upsertCareInstruction(business.id, {
      id: null,
      label: 'Cats',
      detail: 'Twice a day this time',
      cadence: 'every_day',
      cadenceCustom: null,
      weatherRelevant: false,
      sortOrder: 0,
      bookingOnly: true,
      propertyId: property.id,
      bookingId: booking.id,
    })

    const propertyRows = await listCareInstructionsForProperty(business.id, property.id)
    expect(propertyRows).toHaveLength(1)
    expect(propertyRows[0]!.detail).toBe('Standing arrangement')

    const effective = await effectiveInstructionsForBooking(business.id, property.id, booking.id)
    expect(effective).toHaveLength(1)
    expect(effective[0]!.isOverride).toBe(true)
    expect(effective[0]!.instruction.detail).toBe('Twice a day this time')
    expect(effective[0]!.shadows?.detail).toBe('Standing arrangement')
  })

  it('stores free text for a custom cadence, and requires it', async () => {
    const { business, property, booking } = await fixture()

    const created = await upsertCareInstruction(business.id, {
      id: null,
      label: 'Odd job',
      detail: null,
      cadence: 'custom',
      cadenceCustom: 'Whenever it rains',
      weatherRelevant: true,
      sortOrder: 0,
      bookingOnly: false,
      propertyId: property.id,
      bookingId: booking.id,
    })
    expect(created.cadence).toBe('custom')
    expect(created.cadenceCustom).toBe('Whenever it rains')
    expect(created.weatherRelevant).toBe(true)

    await expect(
      upsertCareInstruction(business.id, {
        id: null,
        label: 'Odd job',
        detail: null,
        cadence: 'custom',
        cadenceCustom: '  ',
        weatherRelevant: false,
        sortOrder: 0,
        bookingOnly: false,
        propertyId: property.id,
        bookingId: booking.id,
      })
    ).rejects.toBeInstanceOf(CareInstructionError)
  })

  it('clears cadenceCustom when the cadence is not custom', async () => {
    const { business, property, booking } = await fixture()
    const created = await upsertCareInstruction(business.id, {
      id: null,
      label: 'Cats',
      detail: null,
      cadence: 'every_day',
      cadenceCustom: 'left over',
      weatherRelevant: false,
      sortOrder: 0,
      bookingOnly: false,
      propertyId: property.id,
      bookingId: booking.id,
    })
    expect(created.cadenceCustom).toBeNull()
  })

  it('rejects an empty label', async () => {
    const { business, property, booking } = await fixture()
    await expect(
      upsertCareInstruction(business.id, {
        id: null,
        label: '   ',
        detail: null,
        cadence: 'every_day',
        cadenceCustom: null,
        weatherRelevant: false,
        sortOrder: 0,
        bookingOnly: false,
        propertyId: property.id,
        bookingId: booking.id,
      })
    ).rejects.toBeInstanceOf(CareInstructionError)
  })

  it('updates an existing instruction in place', async () => {
    const { business, property, booking } = await fixture()
    const created = await upsertCareInstruction(business.id, {
      id: null,
      label: 'Cats',
      detail: 'Old',
      cadence: 'every_day',
      cadenceCustom: null,
      weatherRelevant: false,
      sortOrder: 0,
      bookingOnly: false,
      propertyId: property.id,
      bookingId: booking.id,
    })

    await upsertCareInstruction(business.id, {
      id: created.id,
      label: 'Cats',
      detail: 'New',
      cadence: 'every_other_day',
      cadenceCustom: null,
      weatherRelevant: true,
      sortOrder: 0,
      bookingOnly: false,
      propertyId: property.id,
      bookingId: booking.id,
    })

    const rows = await listCareInstructionsForProperty(business.id, property.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.detail).toBe('New')
    expect(rows[0]!.cadence).toBe('every_other_day')
    expect(rows[0]!.weatherRelevant).toBe(true)
  })

  it('deletes, scoped by business', async () => {
    const { business, property, booking } = await fixture()
    const other = await createBusiness({ name: 'Other', contactEmail: 'o@example.com' })
    const created = await upsertCareInstruction(business.id, {
      id: null,
      label: 'Cats',
      detail: null,
      cadence: 'every_day',
      cadenceCustom: null,
      weatherRelevant: false,
      sortOrder: 0,
      bookingOnly: false,
      propertyId: property.id,
      bookingId: booking.id,
    })

    expect(await removeCareInstruction(other.id, created.id)).toBe(false)
    expect(await removeCareInstruction(business.id, created.id)).toBe(true)
    expect(await listCareInstructionsForProperty(business.id, property.id)).toEqual([])
  })
})
