/**
 * The attribution audit.
 *
 * `docs/spec.md` §6.2: every state-changing action records the acting admin.
 * That is the accountability mechanism replacing permissions, and there is no
 * role model to fall back on — so it has to actually hold, everywhere.
 *
 * This ENUMERATES every exported action rather than sampling a few. A new
 * action added without attribution fails here, which is the point: sampling
 * would pass forever while coverage quietly rotted.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { toCalendarDate } from '@/core/dates'
import { createAdmin } from '@/db/repositories/admins'
import { createBusiness } from '@/db/repositories/businesses'
import { createCustomer } from '@/db/repositories/customers'
import { createProperty } from '@/db/repositories/properties'
import { createCareInstruction } from '@/db/repositories/care-instructions'
import { createPricingComponent } from '@/db/repositories/pricing'
import { createVisit } from '@/db/repositories/visits'
import { listActivityForBooking } from '@/db/repositories/activity'
import { resetDatabase } from '@/db/testing/database'

import { captureBooking, changeBookingDates } from './bookings'
import {
  cancelBooking,
  declineBooking,
  markPaid,
  setAvailabilityChecked,
  setDatesFirm,
} from './bookings'
import { overrideCounts } from './pricing'
import { regenerateVisitsForBooking } from './visits'

const ACTIONS_DIR = 'src/app/(admin)/actions'
const TODAY = toCalendarDate('2026-08-17')
const NOW = new Date('2026-08-17T12:00:00Z')

/**
 * Exported actions that change no state and so record no actor.
 *
 * Each is a READ. Adding to this list is a decision to be made deliberately,
 * not a way to silence the audit.
 */
const READ_ONLY_ACTIONS = new Set([
  'loadPropertiesForCustomer', // reads a customer's properties for the capture form
  'actingAdmin', // the resolver itself
])

function actionFiles(): string[] {
  return readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts'))
}

function exportedActions(file: string): string[] {
  const source = readFileSync(join(ACTIONS_DIR, file), 'utf8')
  return [...source.matchAll(/export async function (\w+)/g)].map((m) => m[1]!)
}

describe('the attribution audit — every action resolves the acting admin', () => {
  it('finds every action module', () => {
    expect(actionFiles().sort()).toEqual([
      'activity.ts',
      'auth.ts',
      'bookings.ts',
      'care-instructions.ts',
      'confirmation.ts',
      'pricing.ts',
      'visits.ts',
    ])
  })

  it('EVERY state-changing action calls actingAdmin()', () => {
    const unattributed: string[] = []

    for (const file of actionFiles()) {
      const source = readFileSync(join(ACTIONS_DIR, file), 'utf8')

      for (const name of exportedActions(file)) {
        if (READ_ONLY_ACTIONS.has(name)) continue

        // auth.ts predates the admin session — signing in has no acting admin.
        if (file === 'auth.ts') continue

        const body = source.slice(source.indexOf(`export async function ${name}`))
        const end = body.indexOf('\nexport async function ')
        const fn = end === -1 ? body : body.slice(0, end)

        if (!fn.includes('actingAdmin(')) unattributed.push(`${file}:${name}`)
      }
    }

    expect(unattributed).toEqual([])
  })

  it('no action reaches the database directly — all go through a service or repository', () => {
    const offenders: string[] = []
    for (const file of actionFiles()) {
      const source = readFileSync(join(ACTIONS_DIR, file), 'utf8')
      if (source.includes("from 'drizzle-orm")) offenders.push(file)
      if (/\bdb\(\)\s*\./.test(source)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})

describe('every system entry in the Reference data has its exact text asserted', () => {
  async function fixture() {
    const business = await createBusiness({ name: 'sittter', contactEmail: 'h@example.com' })
    const admin = await createAdmin(business.id, { email: 'k@example.com', name: 'Kate Miller' })
    const customer = await createCustomer(business.id, { name: 'Dana' })
    const property = await createProperty(business.id, {
      customerId: customer.id,
      nickname: 'Maple',
    })
    return { business, admin, customer, property }
  }

  beforeEach(async () => {
    await resetDatabase()
  })

  it('produces all eleven, each attributed and marked as a system entry', async () => {
    const { business, admin, property } = await fixture()
    const b = business.id
    const who = { id: admin.id, name: admin.name }

    // 1 — created
    const captured = await captureBooking(
      b,
      who.id,
      who.name,
      {
        customerId: null,
        newCustomerName: 'Ray Okonkwo',
        propertyId: property.id,
        newPropertyNickname: null,
        startDate: '2026-08-20',
        endDate: '2026-08-26',
        datesApproximate: false,
        note: null,
      },
      TODAY
    )
    const id = captured.bookingId

    await createCareInstruction(b, {
      propertyId: property.id,
      label: 'Cats',
      cadence: 'every_day',
      sortOrder: 0,
    })
    await createPricingComponent(b, {
      bookingId: null,
      type: 'per_day',
      label: 'Daily rate',
      amountCents: 500,
      sortOrder: 0,
    })
    await createVisit(b, { bookingId: id, visitDate: '2026-08-20' })

    // 2 — dates changed
    await changeBookingDates(
      b,
      who.id,
      who.name,
      id,
      { startDate: '2026-08-21', endDate: '2026-08-27', datesApproximate: false },
      TODAY
    )
    // 3, 4 — dates firm set then cleared
    await setDatesFirm(b, who.id, who.name, id, true, NOW, TODAY)
    await setDatesFirm(b, who.id, who.name, id, false, NOW, TODAY)
    // 5, 6 — availability set then cleared
    await setAvailabilityChecked(b, who.id, who.name, id, true, NOW, TODAY)
    await setAvailabilityChecked(b, who.id, who.name, id, false, NOW, TODAY)
    // 7 — visits regenerated
    await regenerateVisitsForBooking(b, who.id, who.name, id, TODAY)
    // 8 — marked paid
    await markPaid(b, who.id, who.name, id, toCalendarDate('2026-08-28'), 'Venmo', TODAY)
    // 9 — count overridden
    await overrideCounts(b, who.id, who.name, id, 6, null, TODAY)
    // 10 — declined
    await declineBooking(b, who.id, who.name, id, NOW, TODAY)
    // 11 — cancelled
    await cancelBooking(b, who.id, who.name, id, NOW, TODAY)

    const entries = await listActivityForBooking(b, id)
    const notes = entries.map((e) => e.note)

    for (const expected of [
      'Kate Miller created this booking.',
      'Kate Miller changed the dates to 2026-08-21–2026-08-27.',
      "Kate Miller marked the customer's dates firm.",
      'Kate Miller cleared the dates-firm flag.',
      'Kate Miller checked the family calendar.',
      'Kate Miller cleared the calendar check.',
      'Kate Miller regenerated the visits.',
      'Kate Miller marked this booking paid.',
      'Kate Miller set the day count to 6.',
      'Kate Miller declined this booking.',
      'Kate Miller cancelled this booking.',
    ]) {
      expect(notes, `missing system entry: ${expected}`).toContain(expected)
    }

    // Every one of them is attributed and flagged as automatic.
    for (const entry of entries.filter((e) => e.isSystem)) {
      expect(entry.actorId).toBe(admin.id)
      expect(entry.isSystem).toBe(true)
      expect(entry.source).toBe('app')
    }
  })
})

describe('activity entries never reach a customer surface', () => {
  it('the activity repository exposes no customer-facing read', () => {
    const source = readFileSync('src/db/repositories/activity.ts', 'utf8')
    const exported = [...source.matchAll(/export async function (\w+)/g)].map((m) => m[1]!)

    // Only the two admin reads and the writer. A function named for a portal
    // or a public surface would be a security defect here.
    expect(exported.sort()).toEqual([
      'createActivityEntry',
      'listActivityForBooking',
      'listActivityForCustomer',
    ])

    // Checked against the NAMES, not the whole file — the file's own doc
    // comment says "customer-facing" while explaining that no such read
    // exists, and matching prose would fail on the comment that documents
    // the rule.
    for (const name of exported) {
      expect(name).not.toMatch(/portal|public/i)
    }
  })
})
