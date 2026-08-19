/**
 * Repository integration tests.
 *
 * Run against the Neon `test` branch — never `main`. See
 * `src/db/testing/database.ts`, which refuses any other target.
 *
 * Two things every test here is built around:
 *   a write is verified by reading the row back, not by trusting the return
 *   a read is verified by seeding a SECOND business and proving isolation
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { deriveStatus } from '@/core/status'
import { toCalendarDate } from '@/core/dates'

import { TRUNCATED_TABLES, publicTables, resetDatabase, testSql } from '../testing/database'
import { createBusiness, getBusiness, getOnlyBusiness, updateBusiness } from './businesses'
import { createAdmin, findAdminByEmail, getAdmin, listAdmins, markAdminSeen } from './admins'
import {
  consumeMagicLinkToken,
  createMagicLinkToken,
  createSession,
  deleteSession,
  findLiveMagicLinkToken,
  findSession,
} from './auth'
import {
  createCustomer,
  getCustomer,
  getCustomerForPortal,
  listCustomers,
  updateCustomer,
} from './customers'
import {
  createProperty,
  getProperty,
  getPropertyForPortal,
  listProperties,
  listPropertiesForCustomer,
} from './properties'
import { createCareInstruction, listCareInstructionsForProperty } from './care-instructions'
import { createBooking, getBooking, listBookings, updateBooking } from './bookings'
import {
  createAdhocLineItem,
  createPricingComponent,
  listAdhocLineItems,
  listDefaultPricingComponents,
} from './pricing'
import { createVisit, listVisitTaskIds, listVisitsForBooking, setVisitTasks } from './visits'
import { createVisitLog, getVisitLog } from './visit-logs'
import { createPhoto, deletePhoto, listPhotosForVisitLog, totalStorageBytes } from './photos'
import { createActivityEntry, listActivityForBooking } from './activity'
import { createLink, findLinkBySlug, recordLinkHit, revokeLink } from './links'
import { getObservedWeather, recordObservedWeather } from './weather'
import {
  createCalendarEvent,
  listDirtyCalendarEvents,
  markCalendarEventSynced,
} from './calendar-events'
import { getDigestSend, listEmailSends, recordDigestSend, recordEmailSend } from './email-sends'
import { isSeeded, seed } from '../seed'

const d = toCalendarDate

/** Two businesses, so every read can be proved not to cross the boundary. */
async function twoBusinesses() {
  const a = await createBusiness({ name: 'Business A', contactEmail: 'a@example.com' })
  const b = await createBusiness({ name: 'Business B', contactEmail: 'b@example.com' })
  return { a, b }
}

beforeEach(async () => {
  await resetDatabase()
})

describe('the test harness itself', () => {
  it('truncates every table in the schema, so none is silently skipped', async () => {
    const inSchema = await publicTables()
    const missing = inSchema.filter(
      (t) => !TRUNCATED_TABLES.includes(t) && t !== '__drizzle_migrations'
    )
    expect(missing).toEqual([])
  })

  it('starts each test from an empty database', async () => {
    const sql = testSql()
    const rows = await sql`select count(*)::int as n from businesses`
    expect(rows[0]!.n).toBe(0)
  })
})

describe('businesses', () => {
  it('writes a row that reads back with the values given', async () => {
    const created = await createBusiness({
      name: 'sittter',
      contactEmail: 'hello@example.com',
      contactPhone: '555-0100',
    })
    const read = await getBusiness(created.id)
    expect(read).not.toBeNull()
    expect(read!.name).toBe('sittter')
    expect(read!.contactEmail).toBe('hello@example.com')
    expect(read!.timezone).toBe('America/New_York')
    expect(read!.digestLocalHour).toBe(7)
  })

  it('updates persist', async () => {
    const created = await createBusiness({ name: 'Old', contactEmail: 'a@example.com' })
    await updateBusiness(created.id, { name: 'New', digestLocalHour: 6 })
    const read = await getBusiness(created.id)
    expect(read!.name).toBe('New')
    expect(read!.digestLocalHour).toBe(6)
  })

  it('getOnlyBusiness returns the single V1 business', async () => {
    await createBusiness({ name: 'Only', contactEmail: 'a@example.com' })
    expect((await getOnlyBusiness())!.name).toBe('Only')
  })
})

describe('admins', () => {
  it('writes a row that reads back', async () => {
    const { a } = await twoBusinesses()
    const created = await createAdmin(a.id, { email: 'sitter@example.com', name: 'Sitter' })
    const read = await getAdmin(a.id, created.id)
    expect(read!.email).toBe('sitter@example.com')
    expect(read!.name).toBe('Sitter')
    expect(read!.lastSeenAt).toBeNull()
  })

  it('does not return admins belonging to another business', async () => {
    const { a, b } = await twoBusinesses()
    const mine = await createAdmin(a.id, { email: 'mine@example.com', name: 'Mine' })
    await createAdmin(b.id, { email: 'theirs@example.com', name: 'Theirs' })

    expect((await listAdmins(a.id)).map((r) => r.email)).toEqual(['mine@example.com'])
    expect(await getAdmin(b.id, mine.id)).toBeNull()
    expect(await findAdminByEmail(b.id, 'mine@example.com')).toBeNull()
  })

  it('finds an admin by email case-insensitively', async () => {
    const { a } = await twoBusinesses()
    await createAdmin(a.id, { email: 'Sitter@Example.com', name: 'Sitter' })
    expect((await findAdminByEmail(a.id, 'sitter@example.com'))!.name).toBe('Sitter')
    expect((await findAdminByEmail(a.id, 'SITTER@EXAMPLE.COM'))!.name).toBe('Sitter')
  })

  it('returns null for an unregistered address rather than throwing', async () => {
    const { a } = await twoBusinesses()
    expect(await findAdminByEmail(a.id, 'nobody@example.com')).toBeNull()
  })

  it('markAdminSeen persists', async () => {
    const { a } = await twoBusinesses()
    const admin = await createAdmin(a.id, { email: 'x@example.com', name: 'X' })
    const at = new Date('2026-08-17T12:00:00Z')
    await markAdminSeen(a.id, admin.id, at)
    expect((await getAdmin(a.id, admin.id))!.lastSeenAt?.toISOString()).toBe(at.toISOString())
  })

  it('rejects a duplicate email within one business', async () => {
    const { a } = await twoBusinesses()
    await createAdmin(a.id, { email: 'dup@example.com', name: 'One' })
    await expect(createAdmin(a.id, { email: 'dup@example.com', name: 'Two' })).rejects.toThrow()
  })
})

describe('magic link tokens and sessions', () => {
  it('stores a token and finds it while unconsumed', async () => {
    const { a } = await twoBusinesses()
    const admin = await createAdmin(a.id, { email: 'x@example.com', name: 'X' })
    const expiresAt = new Date('2026-08-17T12:15:00Z')
    await createMagicLinkToken(a.id, { adminId: admin.id, tokenHash: 'hash-1', expiresAt })

    const found = await findLiveMagicLinkToken(a.id, 'hash-1')
    expect(found!.adminId).toBe(admin.id)
    expect(found!.expiresAt.toISOString()).toBe(expiresAt.toISOString())
  })

  it('a consumed token is no longer live, and cannot be consumed twice', async () => {
    const { a } = await twoBusinesses()
    const admin = await createAdmin(a.id, { email: 'x@example.com', name: 'X' })
    await createMagicLinkToken(a.id, {
      adminId: admin.id,
      tokenHash: 'hash-2',
      expiresAt: new Date('2026-08-17T12:15:00Z'),
    })

    const first = await consumeMagicLinkToken(a.id, 'hash-2', new Date('2026-08-17T12:05:00Z'))
    expect(first).not.toBeNull()
    expect(await findLiveMagicLinkToken(a.id, 'hash-2')).toBeNull()

    const second = await consumeMagicLinkToken(a.id, 'hash-2', new Date('2026-08-17T12:06:00Z'))
    expect(second).toBeNull()
  })

  it('does not find a token belonging to another business', async () => {
    const { a, b } = await twoBusinesses()
    const admin = await createAdmin(a.id, { email: 'x@example.com', name: 'X' })
    await createMagicLinkToken(a.id, {
      adminId: admin.id,
      tokenHash: 'hash-3',
      expiresAt: new Date('2026-08-17T12:15:00Z'),
    })
    expect(await findLiveMagicLinkToken(b.id, 'hash-3')).toBeNull()
  })

  it('refuses to issue a token for an admin in another business', async () => {
    const { a, b } = await twoBusinesses()
    const admin = await createAdmin(a.id, { email: 'x@example.com', name: 'X' })
    await expect(
      createMagicLinkToken(b.id, {
        adminId: admin.id,
        tokenHash: 'hash-4',
        expiresAt: new Date('2026-08-17T12:15:00Z'),
      })
    ).rejects.toThrow(/not in this business/)
  })

  it('creates, finds, and deletes a session, scoped by business', async () => {
    const { a, b } = await twoBusinesses()
    const admin = await createAdmin(a.id, { email: 'x@example.com', name: 'X' })
    await createSession(a.id, {
      adminId: admin.id,
      tokenHash: 'sess-1',
      expiresAt: new Date('2026-11-15T12:00:00Z'),
    })

    expect((await findSession(a.id, 'sess-1'))!.adminId).toBe(admin.id)
    expect(await findSession(b.id, 'sess-1')).toBeNull()
    expect(await deleteSession(b.id, 'sess-1')).toBe(false)
    expect(await deleteSession(a.id, 'sess-1')).toBe(true)
    expect(await findSession(a.id, 'sess-1')).toBeNull()
  })
})

describe('customers', () => {
  it('writes a row that reads back', async () => {
    const { a } = await twoBusinesses()
    const created = await createCustomer(a.id, {
      name: 'Dana',
      email: 'dana@example.com',
      notes: 'admin only',
    })
    const read = await getCustomer(a.id, created.id)
    expect(read!.name).toBe('Dana')
    expect(read!.notes).toBe('admin only')
  })

  it('does not return customers from another business', async () => {
    const { a, b } = await twoBusinesses()
    const mine = await createCustomer(a.id, { name: 'Mine' })
    await createCustomer(b.id, { name: 'Theirs' })
    expect((await listCustomers(a.id)).map((r) => r.name)).toEqual(['Mine'])
    expect(await getCustomer(b.id, mine.id)).toBeNull()
  })

  it('the portal read names its columns and cannot return notes', async () => {
    const { a } = await twoBusinesses()
    const created = await createCustomer(a.id, {
      name: 'Dana',
      email: 'dana@example.com',
      notes: 'SECRET-CUSTOMER-NOTE',
    })
    const portal = await getCustomerForPortal(a.id, created.id)
    expect(Object.keys(portal!).sort()).toEqual(['email', 'id', 'name', 'phone'])
    expect(JSON.stringify(portal)).not.toContain('SECRET-CUSTOMER-NOTE')
  })

  it('updates persist', async () => {
    const { a } = await twoBusinesses()
    const created = await createCustomer(a.id, { name: 'Old' })
    await updateCustomer(a.id, created.id, { name: 'New', phone: '555-0199' })
    const read = await getCustomer(a.id, created.id)
    expect(read!.name).toBe('New')
    expect(read!.phone).toBe('555-0199')
  })

  it('an update scoped to the wrong business changes nothing', async () => {
    const { a, b } = await twoBusinesses()
    const created = await createCustomer(a.id, { name: 'Untouched' })
    expect(await updateCustomer(b.id, created.id, { name: 'Hacked' })).toBeNull()
    expect((await getCustomer(a.id, created.id))!.name).toBe('Untouched')
  })
})

describe('properties', () => {
  async function propertyFixture() {
    const { a, b } = await twoBusinesses()
    const customer = await createCustomer(a.id, { name: 'Dana' })
    const property = await createProperty(a.id, {
      customerId: customer.id,
      nickname: 'Maple Street',
      address: '14 Maple Street',
      accessNotes: 'Side door sticks.',
      accessCodes: 'SECRET-ACCESS-CODE-4417',
    })
    return { a, b, customer, property }
  }

  it('writes a row that reads back, access codes included for admins', async () => {
    const { a, property } = await propertyFixture()
    const read = await getProperty(a.id, property.id)
    expect(read!.nickname).toBe('Maple Street')
    expect(read!.accessCodes).toBe('SECRET-ACCESS-CODE-4417')
  })

  it('THE PORTAL READ CANNOT RETURN ACCESS CODES OR ACCESS NOTES', async () => {
    const { a, property } = await propertyFixture()
    const portal = await getPropertyForPortal(a.id, property.id)

    expect(Object.keys(portal!).sort()).toEqual(['address', 'customerId', 'id', 'nickname'])
    expect(Object.keys(portal!)).not.toContain('accessCodes')
    expect(Object.keys(portal!)).not.toContain('accessNotes')
    expect(JSON.stringify(portal)).not.toContain('SECRET-ACCESS-CODE-4417')
    expect(JSON.stringify(portal)).not.toContain('Side door sticks')
  })

  it('does not return properties from another business', async () => {
    const { a, b, property } = await propertyFixture()
    expect(await getProperty(b.id, property.id)).toBeNull()
    expect(await getPropertyForPortal(b.id, property.id)).toBeNull()
    expect(await listProperties(b.id)).toEqual([])
    expect((await listProperties(a.id)).map((r) => r.nickname)).toEqual(['Maple Street'])
  })

  it('lists a customer’s properties', async () => {
    const { a, customer } = await propertyFixture()
    expect((await listPropertiesForCustomer(a.id, customer.id)).map((r) => r.nickname)).toEqual([
      'Maple Street',
    ])
  })
})

describe('care instructions', () => {
  it('writes and reads back in sortOrder, scoped by business', async () => {
    const { a, b } = await twoBusinesses()
    const customer = await createCustomer(a.id, { name: 'Dana' })
    const property = await createProperty(a.id, { customerId: customer.id, nickname: 'Maple' })

    await createCareInstruction(a.id, {
      propertyId: property.id,
      label: 'Second',
      cadence: 'every_other_day',
      sortOrder: 1,
    })
    await createCareInstruction(a.id, {
      propertyId: property.id,
      label: 'First',
      cadence: 'every_day',
      sortOrder: 0,
    })

    const rows = await listCareInstructionsForProperty(a.id, property.id)
    expect(rows.map((r) => r.label)).toEqual(['First', 'Second'])
    expect(rows[0]!.cadence).toBe('every_day')
    expect(await listCareInstructionsForProperty(b.id, property.id)).toEqual([])
  })

  it('rejects an instruction owned by neither a property nor a booking', async () => {
    const { a } = await twoBusinesses()
    await expect(createCareInstruction(a.id, { label: 'Orphan' })).rejects.toThrow()
  })
})

describe('bookings', () => {
  async function bookingFixture() {
    const { a, b } = await twoBusinesses()
    const customer = await createCustomer(a.id, { name: 'Dana' })
    const property = await createProperty(a.id, { customerId: customer.id, nickname: 'Maple' })
    return { a, b, property }
  }

  it('writes a row that reads back with dates as calendar dates', async () => {
    const { a, property } = await bookingFixture()
    const created = await createBooking(a.id, {
      propertyId: property.id,
      startDate: '2026-08-15',
      endDate: '2026-08-21',
      datesApproximate: false,
    })
    const read = await getBooking(a.id, created.id)
    expect(read!.startDate).toBe('2026-08-15')
    expect(read!.endDate).toBe('2026-08-21')
    expect(read!.datesApproximate).toBe(false)
  })

  it('has no status column, so status must be derived', async () => {
    const { a, property } = await bookingFixture()
    const created = await createBooking(a.id, {
      propertyId: property.id,
      startDate: '2026-08-15',
      endDate: '2026-08-21',
      datesFirmAt: new Date('2026-08-01T12:00:00Z'),
      availabilityCheckedAt: new Date('2026-08-02T12:00:00Z'),
    })
    const read = await getBooking(a.id, created.id)
    expect(read).not.toHaveProperty('status')
    expect(
      deriveStatus(
        {
          id: read!.id,
          startDate: d(read!.startDate!),
          endDate: d(read!.endDate!),
          datesApproximate: read!.datesApproximate,
          datesFirmAt: read!.datesFirmAt?.toISOString() ?? null,
          availabilityCheckedAt: read!.availabilityCheckedAt?.toISOString() ?? null,
          declinedAt: null,
          cancelledAt: null,
          paidAt: null,
          dayCountOverride: null,
          visitCountOverride: null,
        },
        d('2026-08-17')
      )
    ).toBe('in_progress')
  })

  it('rejects an inverted service range at the database', async () => {
    const { a, property } = await bookingFixture()
    await expect(
      createBooking(a.id, {
        propertyId: property.id,
        startDate: '2026-08-21',
        endDate: '2026-08-15',
      })
    ).rejects.toThrow()
  })

  it('does not return bookings from another business', async () => {
    const { a, b, property } = await bookingFixture()
    const created = await createBooking(a.id, { propertyId: property.id })
    expect(await getBooking(b.id, created.id)).toBeNull()
    expect(await listBookings(b.id)).toEqual([])
    expect(await listBookings(a.id)).toHaveLength(1)
  })

  it('updates persist and are scoped', async () => {
    const { a, b, property } = await bookingFixture()
    const created = await createBooking(a.id, { propertyId: property.id })
    expect(await updateBooking(b.id, created.id, { paidAt: '2026-08-20' })).toBeNull()
    await updateBooking(a.id, created.id, { paidAt: '2026-08-20' })
    expect((await getBooking(a.id, created.id))!.paidAt).toBe('2026-08-20')
  })
})

describe('pricing', () => {
  it('stores money as integer cents, negatives included', async () => {
    const { a, b } = await twoBusinesses()
    const customer = await createCustomer(a.id, { name: 'Dana' })
    const property = await createProperty(a.id, { customerId: customer.id, nickname: 'Maple' })
    const booking = await createBooking(a.id, { propertyId: property.id })

    await createPricingComponent(a.id, {
      bookingId: null,
      type: 'per_day',
      label: 'Daily rate',
      amountCents: 500,
      sortOrder: 0,
    })
    await createAdhocLineItem(a.id, {
      bookingId: booking.id,
      label: 'Discount',
      amountCents: -1000,
      sortOrder: 0,
    })

    const defaults = await listDefaultPricingComponents(a.id)
    expect(defaults).toHaveLength(1)
    expect(defaults[0]!.amountCents).toBe(500)
    expect(Number.isInteger(defaults[0]!.amountCents)).toBe(true)

    const adhoc = await listAdhocLineItems(a.id, booking.id)
    expect(adhoc[0]!.amountCents).toBe(-1000)

    expect(await listDefaultPricingComponents(b.id)).toEqual([])
    expect(await listAdhocLineItems(b.id, booking.id)).toEqual([])
  })
})

describe('visits, logs, and photos', () => {
  async function visitFixture() {
    const { a, b } = await twoBusinesses()
    const customer = await createCustomer(a.id, { name: 'Dana' })
    const property = await createProperty(a.id, { customerId: customer.id, nickname: 'Maple' })
    const booking = await createBooking(a.id, {
      propertyId: property.id,
      startDate: '2026-08-15',
      endDate: '2026-08-21',
    })
    const task = await createCareInstruction(a.id, {
      propertyId: property.id,
      label: 'Feed the cat',
      cadence: 'every_day',
    })
    return { a, b, booking, task }
  }

  it('writes a visit that reads back, and rejects two on one date', async () => {
    const { a, booking } = await visitFixture()
    await createVisit(a.id, { bookingId: booking.id, visitDate: '2026-08-15' })
    const rows = await listVisitsForBooking(a.id, booking.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.visitDate).toBe('2026-08-15')
    expect(rows[0]!.window).toBe('anytime')

    await expect(
      createVisit(a.id, { bookingId: booking.id, visitDate: '2026-08-15' })
    ).rejects.toThrow()
  })

  it('sets and reads visit tasks', async () => {
    const { a, booking, task } = await visitFixture()
    const visit = await createVisit(a.id, { bookingId: booking.id, visitDate: '2026-08-15' })
    await setVisitTasks(a.id, visit.id, [task.id])
    expect(await listVisitTaskIds(a.id, visit.id)).toEqual([task.id])
  })

  it('does not return visits from another business', async () => {
    const { a, b, booking } = await visitFixture()
    await createVisit(a.id, { bookingId: booking.id, visitDate: '2026-08-15' })
    expect(await listVisitsForBooking(b.id, booking.id)).toEqual([])
  })

  it('logs a visit and reads it back', async () => {
    const { a, b, booking } = await visitFixture()
    const visit = await createVisit(a.id, { bookingId: booking.id, visitDate: '2026-08-15' })
    await createVisitLog(a.id, {
      visitId: visit.id,
      outcome: 'completed',
      note: 'All fine.',
      loggedDate: '2026-08-15',
    })
    const log = await getVisitLog(a.id, visit.id)
    expect(log!.outcome).toBe('completed')
    expect(log!.note).toBe('All fine.')
    expect(log!.loggedDate).toBe('2026-08-15')
    expect(await getVisitLog(b.id, visit.id)).toBeNull()
  })

  it('stores photos and returns the storage key on delete', async () => {
    const { a, b, booking } = await visitFixture()
    const visit = await createVisit(a.id, { bookingId: booking.id, visitDate: '2026-08-15' })
    const log = await createVisitLog(a.id, {
      visitId: visit.id,
      outcome: 'completed',
      loggedDate: '2026-08-15',
    })
    const photo = await createPhoto(a.id, {
      visitLogId: log.id,
      storageKey: 'photos/abc.jpg',
      bytes: 120_000,
    })

    expect((await listPhotosForVisitLog(a.id, log.id))[0]!.storageKey).toBe('photos/abc.jpg')
    expect(await totalStorageBytes(a.id)).toBe(120_000)
    expect(await totalStorageBytes(b.id)).toBe(0)

    expect(await deletePhoto(b.id, photo.id)).toBeNull()
    expect(await deletePhoto(a.id, photo.id)).toBe('photos/abc.jpg')
    expect(await listPhotosForVisitLog(a.id, log.id)).toEqual([])
  })
})

describe('activity entries', () => {
  it('writes and reads back, scoped by business', async () => {
    const { a, b } = await twoBusinesses()
    const customer = await createCustomer(a.id, { name: 'Dana' })
    const property = await createProperty(a.id, { customerId: customer.id, nickname: 'Maple' })
    const booking = await createBooking(a.id, { propertyId: property.id })

    await createActivityEntry(a.id, {
      bookingId: booking.id,
      note: 'Texted about the gate code.',
      source: 'text_message',
      entryDate: '2026-08-14',
    })

    const rows = await listActivityForBooking(a.id, booking.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.source).toBe('text_message')
    expect(rows[0]!.isSystem).toBe(false)
    expect(await listActivityForBooking(b.id, booking.id)).toEqual([])
  })
})

describe('links', () => {
  it('stores the slug uppercase and resolves case-insensitively', async () => {
    const { a } = await twoBusinesses()
    const customer = await createCustomer(a.id, { name: 'Dana' })
    await createLink(a.id, { slug: 'ab3k9', type: 'customer_portal', customerId: customer.id })

    expect((await findLinkBySlug(a.id, 'AB3K9'))!.slug).toBe('AB3K9')
    expect((await findLinkBySlug(a.id, 'ab3k9'))!.slug).toBe('AB3K9')
    expect(await findLinkBySlug(a.id, 'ZZZZZ')).toBeNull()
  })

  it('counts hits and records revocation', async () => {
    const { a, b } = await twoBusinesses()
    const link = await createLink(a.id, { slug: 'PQ3RT', type: 'public_intake' })

    await recordLinkHit(a.id, 'pq3rt', new Date('2026-08-17T12:00:00Z'))
    await recordLinkHit(a.id, 'PQ3RT', new Date('2026-08-17T12:01:00Z'))
    expect((await findLinkBySlug(a.id, 'PQ3RT'))!.hitCount).toBe(2)

    // Another business cannot resolve, count a hit against, or revoke it.
    expect(await findLinkBySlug(b.id, 'PQ3RT')).toBeNull()
    await recordLinkHit(b.id, 'PQ3RT', new Date('2026-08-17T12:02:00Z'))
    expect((await findLinkBySlug(a.id, 'PQ3RT'))!.hitCount).toBe(2)

    expect(await revokeLink(b.id, link.id, new Date())).toBeNull()
    await revokeLink(a.id, link.id, new Date('2026-08-17T13:00:00Z'))
    expect((await findLinkBySlug(a.id, 'PQ3RT'))!.revokedAt).not.toBeNull()
  })
})

describe('weather, calendar events, and send logs', () => {
  it('records observed weather once per property per day', async () => {
    const { a, b } = await twoBusinesses()
    const customer = await createCustomer(a.id, { name: 'Dana' })
    const property = await createProperty(a.id, { customerId: customer.id, nickname: 'Maple' })

    await recordObservedWeather(a.id, {
      propertyId: property.id,
      observedDate: '2026-08-16',
      summary: 'Warm and clear',
    })
    const second = await recordObservedWeather(a.id, {
      propertyId: property.id,
      observedDate: '2026-08-16',
      summary: 'Different summary',
    })
    expect(second).toBeNull()

    const read = await getObservedWeather(a.id, property.id, '2026-08-16')
    expect(read!.summary).toBe('Warm and clear')
    expect(await getObservedWeather(b.id, property.id, '2026-08-16')).toBeNull()
  })

  it('marks a calendar event dirty until synced', async () => {
    const { a, b } = await twoBusinesses()
    const customer = await createCustomer(a.id, { name: 'Dana' })
    const property = await createProperty(a.id, { customerId: customer.id, nickname: 'Maple' })
    const booking = await createBooking(a.id, { propertyId: property.id })

    const event = await createCalendarEvent(a.id, { kind: 'booking', bookingId: booking.id })
    expect(event.dirty).toBe(true)
    expect(await listDirtyCalendarEvents(a.id)).toHaveLength(1)
    expect(await listDirtyCalendarEvents(b.id)).toEqual([])

    await markCalendarEventSynced(a.id, event.id, 'google-1', new Date('2026-08-17T12:00:00Z'))
    expect(await listDirtyCalendarEvents(a.id)).toEqual([])
  })

  it('records an email send with its error, and a digest send once per day', async () => {
    const { a, b } = await twoBusinesses()

    await recordEmailSend(a.id, {
      kind: 'magic_link',
      recipient: 'x@example.com',
      subject: 'Your sittter sign-in link',
      error: 'provider unavailable',
    })
    const sends = await listEmailSends(a.id)
    expect(sends[0]!.error).toBe('provider unavailable')
    expect(sends[0]!.providerId).toBeNull()
    expect(await listEmailSends(b.id)).toEqual([])

    expect(await recordDigestSend(a.id, '2026-08-17', 2)).not.toBeNull()
    expect(await recordDigestSend(a.id, '2026-08-17', 2)).toBeNull()
    expect((await getDigestSend(a.id, '2026-08-17'))!.recipients).toBe(2)
    expect(await getDigestSend(b.id, '2026-08-17')).toBeNull()
  })
})

describe('the seed fixture', () => {
  const REFERENCE = d('2026-08-17')

  it('produces one business, two admins, two customers, and three bookings', async () => {
    const result = await seed(REFERENCE)
    expect(result.adminIds).toHaveLength(2)
    expect(result.customerIds).toHaveLength(2)
    expect(result.bookingIds).toHaveLength(3)
    expect(await listAdmins(result.businessId)).toHaveLength(2)
    expect(await listCustomers(result.businessId)).toHaveLength(2)
    expect(await listBookings(result.businessId)).toHaveLength(3)
  })

  it('refuses to run against a non-empty database rather than half-applying', async () => {
    await seed(REFERENCE)
    expect(await isSeeded()).toBe(true)
    await expect(seed(REFERENCE)).rejects.toThrow(/not empty/i)
  })

  it('is deterministic — the same reference date yields the same dates', async () => {
    const first = await seed(REFERENCE)
    const before = (await listBookings(first.businessId)).map((b) => [b.startDate, b.endDate])
    await resetDatabase()
    const second = await seed(REFERENCE)
    const after = (await listBookings(second.businessId)).map((b) => [b.startDate, b.endDate])
    expect(after).toEqual(before)
  })

  it('the three bookings derive confirmed, tentative, and inquiry', async () => {
    const result = await seed(REFERENCE)
    const rows = await listBookings(result.businessId)

    const statuses = rows.map((row) =>
      deriveStatus(
        {
          id: row.id,
          startDate: row.startDate === null ? null : d(row.startDate),
          endDate: row.endDate === null ? null : d(row.endDate),
          datesApproximate: row.datesApproximate,
          datesFirmAt: row.datesFirmAt?.toISOString() ?? null,
          availabilityCheckedAt: row.availabilityCheckedAt?.toISOString() ?? null,
          declinedAt: row.declinedAt?.toISOString() ?? null,
          cancelledAt: row.cancelledAt?.toISOString() ?? null,
          paidAt: row.paidAt === null ? null : d(row.paidAt),
          dayCountOverride: row.dayCountOverride,
          visitCountOverride: row.visitCountOverride,
        },
        REFERENCE
      )
    )

    expect([...statuses].sort()).toEqual(['confirmed', 'inquiry', 'tentative'])
  })

  it('seeds the default pricing profile at 500 and 600 cents', async () => {
    const result = await seed(REFERENCE)
    const defaults = await listDefaultPricingComponents(result.businessId)
    expect(defaults.map((c) => [c.type, c.amountCents])).toEqual([
      ['per_day', 500],
      ['per_visit', 600],
    ])
  })
})
