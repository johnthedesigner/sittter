/**
 * Pricing orchestration.
 *
 * `priceBooking` in `src/core/pricing.ts` is the ONLY engine. Nothing here
 * multiplies a rate by a count; this module decides WHICH components apply
 * and turns rows into the pure layer's input.
 *
 * MONEY IS INTEGER CENTS throughout. No total is stored — a stored total is
 * an answer that goes stale the moment an input changes, and the snapshot
 * below exists precisely so the INPUTS can be frozen instead.
 */

import { priceBooking } from '@/core/pricing'
import type {
  AdhocLineItem,
  CalendarDate,
  PricedBooking,
  PricingComponent,
  VisitCore,
} from '@/core/types'

import { createActivityEntry } from '@/db/repositories/activity'
import { getBooking, updateBooking } from '@/db/repositories/bookings'
import {
  createAdhocLineItem,
  createPricingComponent,
  deleteAdhocLineItem as deleteAdhocRow,
  deletePricingComponent as deleteComponentRow,
  listAdhocLineItems,
  listDefaultPricingComponents,
  listPricingComponentsForBooking,
  updatePricingComponent,
} from '@/db/repositories/pricing'
import type { NewPricingComponent, PricingComponentRow } from '@/db/repositories/pricing'
import { listVisitsForBooking } from '@/db/repositories/visits'

import { toBookingCore } from './home'

export class PricingError extends Error {}

function toCoreComponent(row: PricingComponentRow): PricingComponent {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    amountCents: row.amountCents,
    sortOrder: row.sortOrder,
  }
}

/**
 * Freeze the business defaults onto a booking.
 *
 * Called when a booking becomes confirmed. It copies the COMPONENTS, not the
 * total — journey step 9.1.6 requires that raising the business rate later
 * leaves this booking's price alone, while an override or an added visit
 * still recalculates correctly. Storing a total would satisfy the first and
 * break the second.
 *
 * Idempotent: a booking that already carries a snapshot is left alone.
 */
export async function snapshotPricing(
  businessId: string,
  bookingId: string,
  now: Date
): Promise<void> {
  const booking = await getBooking(businessId, bookingId)
  if (booking === null) return
  if (booking.pricingSnapshotAt !== null) return

  const defaults = await listDefaultPricingComponents(businessId)
  for (const component of defaults) {
    await createPricingComponent(businessId, {
      bookingId,
      type: component.type,
      label: component.label,
      amountCents: component.amountCents,
      sortOrder: component.sortOrder,
    })
  }

  await updateBooking(businessId, bookingId, { pricingSnapshotAt: now })
}

export interface BookingPrice extends PricedBooking {
  /** True once the components have been frozen onto this booking. */
  isSnapshot: boolean
}

/**
 * Price a booking.
 *
 * Uses the snapshotted components when the booking has them, and the current
 * business defaults when it does not — an unconfirmed booking should show
 * what it would cost today.
 */
export async function priceBookingById(
  businessId: string,
  bookingId: string
): Promise<BookingPrice | null> {
  const booking = await getBooking(businessId, bookingId)
  if (booking === null) return null

  const snapshot = await listPricingComponentsForBooking(businessId, bookingId)
  const isSnapshot = snapshot.length > 0
  const components = isSnapshot ? snapshot : await listDefaultPricingComponents(businessId)

  const visitRows = await listVisitsForBooking(businessId, bookingId)
  const visits: VisitCore[] = visitRows.map((v) => ({
    id: v.id,
    date: v.visitDate as CalendarDate,
    window: v.window,
    durationMinutes: v.durationMinutes,
    taskIds: [],
  }))

  const adhocRows = await listAdhocLineItems(businessId, bookingId)
  const adhocItems: AdhocLineItem[] = adhocRows.map((a) => ({
    id: a.id,
    label: a.label,
    amountCents: a.amountCents,
    sortOrder: a.sortOrder,
  }))

  const priced = priceBooking({
    booking: toBookingCore(booking),
    visits,
    components: components.map(toCoreComponent),
    adhocItems,
  })

  return { ...priced, isSnapshot }
}

/**
 * Override the day or visit count.
 *
 * The DATES ARE NOT TOUCHED — journey step 9.1.2 waives a travel day without
 * changing when the sitter is expected. `priceBooking` uses the override and
 * flags it, so a surface can show that a human changed the number.
 */
export async function overrideCounts(
  businessId: string,
  actingAdminId: string,
  actingAdminName: string,
  bookingId: string,
  dayCountOverride: number | null,
  visitCountOverride: number | null,
  today: CalendarDate
): Promise<void> {
  for (const [label, value] of [
    ['day', dayCountOverride],
    ['visit', visitCountOverride],
  ] as const) {
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      throw new PricingError(`The ${label} count must be a whole number, or empty to clear it.`)
    }
  }

  const before = await getBooking(businessId, bookingId)
  if (before === null) throw new PricingError('That booking no longer exists.')

  await updateBooking(businessId, bookingId, { dayCountOverride, visitCountOverride })

  if (before.dayCountOverride !== dayCountOverride && dayCountOverride !== null) {
    await recordCountOverride(
      businessId,
      bookingId,
      actingAdminId,
      actingAdminName,
      'day',
      dayCountOverride,
      today
    )
  }
  if (before.visitCountOverride !== visitCountOverride && visitCountOverride !== null) {
    await recordCountOverride(
      businessId,
      bookingId,
      actingAdminId,
      actingAdminName,
      'visit',
      visitCountOverride,
      today
    )
  }
}

async function recordCountOverride(
  businessId: string,
  bookingId: string,
  actingAdminId: string,
  actingAdminName: string,
  kind: 'day' | 'visit',
  value: number,
  today: CalendarDate
): Promise<void> {
  await createActivityEntry(businessId, {
    bookingId,
    note: `${actingAdminName} set the ${kind} count to ${value}.`,
    source: 'app',
    entryDate: today,
    actorId: actingAdminId,
    isSystem: true,
  })
}

// ── Components and ad-hoc items ──────────────────────────────────────

export interface ComponentInput {
  id: string | null
  bookingId: string | null
  type: NewPricingComponent['type']
  label: string
  amountCents: number
  sortOrder: number
}

export async function saveComponent(
  businessId: string,
  input: ComponentInput
): Promise<PricingComponentRow> {
  if (input.label.trim().length === 0) throw new PricingError('A component needs a label.')
  if (!Number.isInteger(input.amountCents)) {
    throw new PricingError('An amount must be a whole number of cents.')
  }

  const values = {
    bookingId: input.bookingId,
    type: input.type,
    label: input.label.trim(),
    amountCents: input.amountCents,
    sortOrder: input.sortOrder,
  }

  if (input.id !== null && input.id.length > 0) {
    const row = await updatePricingComponent(businessId, input.id, values)
    if (row === null) throw new PricingError('That component no longer exists.')
    return row
  }
  return createPricingComponent(businessId, values)
}

export async function removeComponent(businessId: string, id: string): Promise<boolean> {
  return deleteComponentRow(businessId, id)
}

export async function addAdhoc(
  businessId: string,
  bookingId: string,
  label: string,
  amountCents: number,
  sortOrder: number
): Promise<void> {
  if (label.trim().length === 0) throw new PricingError('A line item needs a label.')
  if (!Number.isInteger(amountCents)) {
    throw new PricingError('An amount must be a whole number of cents.')
  }
  await createAdhocLineItem(businessId, {
    bookingId,
    label: label.trim(),
    amountCents,
    sortOrder,
  })
}

export async function removeAdhoc(businessId: string, id: string): Promise<boolean> {
  return deleteAdhocRow(businessId, id)
}

/**
 * A plain-text itemized summary, for journey step 9.1.5's copy action.
 *
 * Built here rather than in the component so the exact text is testable
 * without a browser, and so the clipboard and any future email share one
 * definition.
 */
export function summaryText(
  customerName: string,
  propertyNickname: string,
  priced: PricedBooking
): string {
  const dollars = (cents: number) => {
    const sign = cents < 0 ? '-' : ''
    const abs = Math.abs(cents)
    return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
  }

  const lines = [
    `${customerName} — ${propertyNickname}`,
    '',
    ...priced.lineItems.map((i) => `${i.label}: ${i.basis} — ${dollars(i.amountCents)}`),
    '',
    `Total: ${dollars(priced.totalCents)}`,
  ]
  return lines.join('\n')
}
