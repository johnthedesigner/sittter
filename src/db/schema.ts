/**
 * The database schema.
 *
 * Mirrors `docs/dev-plan.md` §5 table for table and column for column.
 * Changes are applied by generating a migration with `pnpm db:generate`,
 * reviewing the SQL, and committing it in `drizzle/`. Never hand-edit a file
 * in `drizzle/`, and never run a push command against any database.
 * See AGENTS.md, "Migrations are the only way to change the schema".
 *
 * Two representation rules from AGENTS.md are enforced here by type choice:
 *
 *   Money is integer cents. Every currency column is `integer`. No numeric,
 *   real, or double precision column holds a currency value.
 *
 *   Calendar dates are `date`, not `timestamp`. A service range, a visit
 *   date, a logged date, a paid date, and an observed weather date have no
 *   time component and no zone. Columns naming an instant something happened
 *   — created_at, dates_firm_at, synced_at — are `timestamptz`.
 *
 * There is no status column on bookings and there never will be. Status is
 * derived by `deriveStatus()` in `src/core/status.ts`.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

// ── Enumerations ─────────────────────────────────────────────────────

export const cadenceEnum = pgEnum('cadence', [
  'every_day',
  'every_other_day',
  'every_third_day',
  'once_at_start',
  'once_at_end',
  'as_needed',
  'custom',
])

export const timeWindowEnum = pgEnum('time_window', [
  'morning',
  'midday',
  'afternoon',
  'evening',
  'anytime',
])

export const visitOutcomeEnum = pgEnum('visit_outcome', [
  'completed',
  'partially_completed',
  'skipped',
  'could_not_complete',
])

export const pricingComponentTypeEnum = pgEnum('pricing_component_type', [
  'per_day',
  'per_visit',
  'flat',
  'per_hour',
  'custom',
])

export const activitySourceEnum = pgEnum('activity_source', [
  'text_message',
  'in_person',
  'email',
  'phone',
  'customer_form',
  'app',
])

export const linkTypeEnum = pgEnum('link_type', [
  'customer_portal',
  'booking_form',
  'public_intake',
])

export const calendarEventKindEnum = pgEnum('calendar_event_kind', ['booking', 'visit'])

// Shorthand for the two timestamp shapes used throughout.
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

// ── Tenancy and identity ─────────────────────────────────────────────

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone'),
  timezone: text('timezone').notNull().default('America/New_York'),
  googleCalendarId: text('google_calendar_id'),
  copyConfirmation: text('copy_confirmation').notNull().default(''),
  copyWhatToLeave: text('copy_what_to_leave').notNull().default(''),
  copyPricing: text('copy_pricing').notNull().default(''),
  copyPayment: text('copy_payment').notNull().default(''),
  copyChanges: text('copy_changes').notNull().default(''),
  digestLocalHour: integer('digest_local_hour').notNull().default(7),
  createdAt: createdAt(),
})

export const admins = pgTable(
  'admins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name').notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (table) => [unique('admins_business_email_unique').on(table.businessId, table.email)]
)

export const magicLinkTokens = pgTable('magic_link_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: uuid('admin_id')
    .notNull()
    .references(() => admins.id, { onDelete: 'cascade' }),
  // A SHA-256 hash. The plaintext token exists only in the emailed URL.
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: uuid('admin_id')
    .notNull()
    .references(() => admins.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
})

// ── Customers and properties ─────────────────────────────────────────

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('customers_business_email_idx').on(table.businessId, sql`lower(${table.email})`),
  ]
)

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  nickname: text('nickname').notNull(),
  address: text('address'),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  geocodedAt: timestamp('geocoded_at', { withTimezone: true }),
  /** ADMIN ONLY. Never selected for a customer surface. */
  accessNotes: text('access_notes'),
  /** ADMIN ONLY. Never selected for a customer surface. */
  accessCodes: text('access_codes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const careInstructions = pgTable(
  'care_instructions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'cascade' }),
    bookingId: uuid('booking_id').references((): typeof bookings.id => bookings.id, {
      onDelete: 'cascade',
    }),
    label: text('label').notNull(),
    detail: text('detail'),
    cadence: cadenceEnum('cadence').notNull().default('as_needed'),
    cadenceCustom: text('cadence_custom'),
    weatherRelevant: boolean('weather_relevant').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    // Belongs to a property or a booking, never both and never neither.
    check(
      'one_owner',
      sql`(${table.propertyId} IS NOT NULL AND ${table.bookingId} IS NULL) OR (${table.propertyId} IS NULL AND ${table.bookingId} IS NOT NULL)`
    ),
  ]
)

// ── Bookings ─────────────────────────────────────────────────────────

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),

    // Calendar dates. No time, no zone.
    startDate: date('start_date'),
    endDate: date('end_date'),
    datesApproximate: boolean('dates_approximate').notNull().default(true),

    // Instants, each with the admin who caused it.
    datesFirmAt: timestamp('dates_firm_at', { withTimezone: true }),
    datesFirmBy: uuid('dates_firm_by').references(() => admins.id),
    availabilityCheckedAt: timestamp('availability_checked_at', { withTimezone: true }),
    availabilityCheckedBy: uuid('availability_checked_by').references(() => admins.id),

    declinedAt: timestamp('declined_at', { withTimezone: true }),
    declinedBy: uuid('declined_by').references(() => admins.id),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: uuid('cancelled_by').references(() => admins.id),

    /** A calendar date, not an instant: the day payment was received. */
    paidAt: date('paid_at'),
    paidMethodNote: text('paid_method_note'),

    pricingSnapshotAt: timestamp('pricing_snapshot_at', { withTimezone: true }),
    dayCountOverride: integer('day_count_override'),
    visitCountOverride: integer('visit_count_override'),

    createdAt: createdAt(),
    createdBy: uuid('created_by').references(() => admins.id),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('bookings_business_start_idx').on(table.businessId, table.startDate),
    check(
      'range_ordered',
      sql`${table.startDate} IS NULL OR ${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`
    ),
  ]
)

export const pricingComponents = pgTable('pricing_components', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  /** NULL means this is a business default rather than a booking snapshot. */
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
  type: pricingComponentTypeEnum('type').notNull(),
  label: text('label').notNull(),
  amountCents: integer('amount_cents').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
})

export const adhocLineItems = pgTable('adhoc_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  /** May be negative, for a discount. */
  amountCents: integer('amount_cents').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
})

// ── Visits ───────────────────────────────────────────────────────────

export const visits = pgTable(
  'visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    visitDate: date('visit_date').notNull(),
    window: timeWindowEnum('window').notNull().default('anytime'),
    durationMinutes: integer('duration_minutes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [unique('visits_booking_date_unique').on(table.bookingId, table.visitDate)]
)

export const visitTasks = pgTable(
  'visit_tasks',
  {
    visitId: uuid('visit_id')
      .notNull()
      .references(() => visits.id, { onDelete: 'cascade' }),
    careInstructionId: uuid('care_instruction_id')
      .notNull()
      .references(() => careInstructions.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.visitId, table.careInstructionId] })]
)

export const visitLogs = pgTable('visit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  visitId: uuid('visit_id')
    .notNull()
    .unique()
    .references(() => visits.id, { onDelete: 'cascade' }),
  outcome: visitOutcomeEnum('outcome').notNull(),
  note: text('note'),
  loggedDate: date('logged_date').notNull(),
  createdAt: createdAt(),
  createdBy: uuid('created_by').references(() => admins.id),
  updatedAt: updatedAt(),
})

export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  visitLogId: uuid('visit_log_id')
    .notNull()
    .references(() => visitLogs.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),
  width: integer('width'),
  height: integer('height'),
  bytes: integer('bytes').notNull(),
  createdAt: createdAt(),
  createdBy: uuid('created_by').references(() => admins.id),
})

// ── Communication and access ─────────────────────────────────────────

export const activityEntries = pgTable(
  'activity_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
    note: text('note').notNull(),
    source: activitySourceEnum('source').notNull(),
    entryDate: date('entry_date').notNull(),
    actorId: uuid('actor_id').references(() => admins.id),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    check('has_subject', sql`${table.bookingId} IS NOT NULL OR ${table.customerId} IS NOT NULL`),
  ]
)

export const links = pgTable('links', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  /** Stored uppercase, resolved case-insensitively. Carries no claims. */
  slug: text('slug').notNull().unique(),
  type: linkTypeEnum('type').notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  hitCount: integer('hit_count').notNull().default(0),
  lastHitAt: timestamp('last_hit_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export const rateLimitHits = pgTable(
  'rate_limit_hits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })]
)

// ── Integrations ─────────────────────────────────────────────────────

export const observedWeather = pgTable(
  'observed_weather',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    observedDate: date('observed_date').notNull(),
    tempMaxF: numeric('temp_max_f', { precision: 5, scale: 1 }),
    tempMinF: numeric('temp_min_f', { precision: 5, scale: 1 }),
    precipitationIn: numeric('precipitation_in', { precision: 5, scale: 2 }),
    summary: text('summary').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('observed_weather_property_date_unique').on(table.propertyId, table.observedDate),
  ]
)

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    kind: calendarEventKindEnum('kind').notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
    visitId: uuid('visit_id').references(() => visits.id, { onDelete: 'cascade' }),
    googleEventId: text('google_event_id'),
    dirty: boolean('dirty').notNull().default(true),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    lastError: text('last_error'),
  },
  (table) => [
    check('has_target', sql`${table.bookingId} IS NOT NULL OR ${table.visitId} IS NOT NULL`),
  ]
)

export const emailSends = pgTable('email_sends', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  providerId: text('provider_id'),
  error: text('error'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
})

export const digestSends = pgTable(
  'digest_sends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    sendDate: date('send_date').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    recipients: integer('recipients').notNull(),
  },
  (table) => [unique('digest_sends_business_date_unique').on(table.businessId, table.sendDate)]
)
