/**
 * The domain's type vocabulary.
 *
 * These types are independent of database row shapes. Repositories map rows
 * to these; nothing here knows that a database exists.
 *
 * Two representation rules from AGENTS.md are load-bearing throughout:
 *
 *   Money is integer cents. Every currency value is an integer number of
 *   cents in TypeScript, in Postgres, in transport, and in email templates.
 *   No floating point arithmetic touches a currency value. Formatting to
 *   dollars happens only at the point of display.
 *
 *   Calendar dates are not timestamps. A service range, a visit date, a
 *   logged date and a paid date are calendar dates in America/New_York with
 *   no time component and no zone, carried as CalendarDate. Fields naming an
 *   instant something happened — datesFirmAt, cancelledAt — are timestamps
 *   with a zone and are typed as string here.
 */

// ── Calendar dates ───────────────────────────────────────────────────

/**
 * A calendar date with no time and no zone, as 'YYYY-MM-DD'.
 *
 * Branded so a bare string cannot be passed where a validated date is
 * expected. Construct one with toCalendarDate() from src/core/dates.ts;
 * the brand is not exported, so there is no other way to make one.
 */
export type CalendarDate = string & { readonly __brand: 'CalendarDate' }

// ── Enumerations ─────────────────────────────────────────────────────

export type Cadence =
  | 'every_day'
  | 'every_other_day'
  | 'every_third_day'
  | 'once_at_start'
  | 'once_at_end'
  | 'as_needed'
  | 'custom'

export type BookingStatus =
  | 'inquiry'
  | 'tentative'
  | 'confirmed'
  | 'in_progress'
  | 'complete'
  | 'closed'
  | 'declined'
  | 'cancelled'

export type CustomerFacingStatus =
  | 'requested'
  | 'waiting_on_you'
  | 'waiting_on_us'
  | 'confirmed'
  | 'in_progress'
  | 'complete'
  | 'cancelled'

export type TimeWindow = 'morning' | 'midday' | 'afternoon' | 'evening' | 'anytime'

export type PricingComponentType = 'per_day' | 'per_visit' | 'flat' | 'per_hour' | 'custom'

// ── Inputs ───────────────────────────────────────────────────────────

export interface CareInstruction {
  id: string
  label: string
  detail: string | null
  cadence: Cadence
  cadenceCustom: string | null
  weatherRelevant: boolean
  sortOrder: number
}

export interface PricingComponent {
  id: string
  type: PricingComponentType
  label: string
  amountCents: number
  sortOrder: number
}

export interface AdhocLineItem {
  id: string
  label: string
  amountCents: number
  sortOrder: number
}

/**
 * The booking fields the pure layer needs. Not the full database row.
 *
 * There is no status field and there never will be. Status is derived by
 * deriveStatus() in src/core/status.ts from the flags below and today's
 * date. See AGENTS.md, "Booking status is derived, never stored".
 */
export interface BookingCore {
  id: string
  startDate: CalendarDate | null
  endDate: CalendarDate | null
  datesApproximate: boolean
  /** Timestamp with zone: the instant the customer confirmed dates. */
  datesFirmAt: string | null
  /** Timestamp with zone: the instant an admin checked the family calendar. */
  availabilityCheckedAt: string | null
  declinedAt: string | null
  cancelledAt: string | null
  /** A calendar date, not an instant: the day payment was received. */
  paidAt: CalendarDate | null
  dayCountOverride: number | null
  visitCountOverride: number | null
}

export interface VisitCore {
  id: string
  date: CalendarDate
  window: TimeWindow
  durationMinutes: number | null
  taskIds: string[]
}

// ── Pricing output ───────────────────────────────────────────────────

export interface LineItem {
  label: string
  /** Human-readable derivation, e.g. "7 days at $5.00". */
  basis: string
  quantity: number
  unitAmountCents: number
  amountCents: number
  source: 'component' | 'adhoc'
}

export interface PricedBooking {
  lineItems: LineItem[]
  totalCents: number
  dayCount: number
  visitCount: number
  dayCountWasOverridden: boolean
  visitCountWasOverridden: boolean
}

// ── Schedule output ──────────────────────────────────────────────────

export interface GeneratedVisit {
  date: CalendarDate
  taskIds: string[]
}

export interface ScheduleResult {
  visits: GeneratedVisit[]
  skippedInstructions: { id: string; reason: string }[]
}

// ── Digest output ────────────────────────────────────────────────────

export interface DigestTimelineDay {
  date: CalendarDate
  position: 'past' | 'today' | 'future'
  hasVisit: boolean
  logged: boolean
  outcome: string | null
  /** Visit note, truncated for the timeline. Null when there is no note. */
  summary: string | null
}

export interface DigestWeather {
  highF: number
  lowF: number
  precipitationChance: number
  expectedInches: number
  /** Derived phrasing, e.g. "rain likely after 2pm". Null when nothing to say. */
  derivedLine: string | null
}

export interface DigestBookingBlock {
  bookingId: string
  propertyNickname: string
  customerName: string
  startDate: CalendarDate
  endDate: CalendarDate
  todayVisit: VisitCore | null
  todayTasks: string[]
  timeline: DigestTimelineDay[]
  weather: DigestWeather | null
}

export interface DigestAttentionItem {
  kind:
    | 'unlogged_visit'
    | 'missing_dates_firm'
    | 'missing_availability_check'
    | 'starts_soon_unconfirmed'
  bookingId: string
  label: string
  href: string
}

export interface DigestModel {
  date: CalendarDate
  bookings: DigestBookingBlock[]
  attention: DigestAttentionItem[]
  isEmpty: boolean
}
