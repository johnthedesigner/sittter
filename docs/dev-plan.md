# sittter — Development Plan

> **Status:** V1 plan
> **Audience:** Human and agent
> **Source document for:** `tasks/phase-N.md` files, `AGENTS.md` architectural rules
> **Companion:** `docs/spec.md` defines what the product does. This document defines how it gets built.

---

## 1. Engineering principles

These become architectural rules in `AGENTS.md`. They are stated here with their reasoning; `AGENTS.md` states them absolutely.

**1. The core is pure.** Everything under `src/core/` is side-effect free. No database access, no network, no file system, no clock reads, no randomness, no logging. Functions take data and return data. The clock and the random source are passed in as arguments. This is what makes pricing, scheduling, status, and digest composition testable without infrastructure, and it is the boundary that is most expensive to uncross.

**2. Status is derived, never stored.** There is no `status` column on `bookings`. A single pure function computes it from flags and dates. Two surfaces showing different statuses for the same booking is a class of bug that cannot occur if the value has one source.

**3. Money is integer cents.** No floating point arithmetic touches a currency value anywhere in the system, including in the database, in transport, and in templates.

**4. Dates that are calendar dates are `date`, not `timestamp`.** A service range, a visit date, and an observed weather date are calendar dates in `America/New_York`. They have no time and no zone. Timestamps are for events that happened at an instant.

**5. Migrations are the only way to change the schema.** No manual schema edits, no `push` against a live database. Every migration is generated, reviewed, and committed.

**6. Every query is scoped by business.** Repository functions take a business identifier and filter on it. There is one business in V1, and the discipline costs nothing now and is unaffordable to retrofit.

**7. Integrations fail soft.** Calendar sync, weather, and email are recorded, retried, and never block a core write. A booking that cannot reach Google is still a saved booking.

**8. External surfaces have no ambient authority.** A route that resolves a link grants access to exactly the target of that link, resolved server-side. The slug never carries claims.

**9. The daily job is idempotent.** Running it twice on the same day produces the same result as running it once.

**10. Nothing sensitive crosses the customer boundary.** Access codes, activity entries, admin identities, and other customers' data are excluded at the query layer, not hidden in the template.

---

## 2. Technology stack

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Node 22 | Vercel default |
| Package manager | pnpm | Single package, no workspace |
| Framework | Next.js 15, App Router, TypeScript strict | |
| Database | Postgres on Neon | Free tier |
| ORM and migrations | Drizzle ORM, drizzle-kit | Schema in TypeScript, generated SQL migrations |
| Styling | Tailwind | |
| Unit tests | Vitest | |
| Integration tests | Vitest, separate config, real Postgres | |
| End-to-end tests | Playwright | |
| Email delivery | Resend | Free tier |
| Email templates | React Email | Rendered server-side |
| Object storage | Vercel Blob | Behind an interface, see §3 `src/services/storage.ts` |
| Calendar | `googleapis`, service account credentials | |
| Weather | Open-Meteo | No API key |
| Scheduling | Vercel Cron | One job, once per day |
| Auth | Hand-rolled magic link and session cookie | No auth library |

**On hand-rolling auth.** The project needs two unrelated access systems: an admin session and an opaque customer link. An auth library solves the first and does nothing for the second, while imposing a schema shape. The implementation is a token table, a hash, a cookie, and an expiry.

**On Vercel Cron limits.** Hobby allows one run per day, in UTC only, invoked anywhere within the scheduled hour, with a ten second function timeout. The daily job is designed against those constraints: it is scheduled in UTC, it checks the local hour and no-ops if it is wrong, it is idempotent, and it must complete well inside ten seconds. Moving to Pro later changes a cron expression and nothing else.

---

## 3. Repository structure

```
sittter/
├── AGENTS.md                          Standing orders. Read first, every session.
├── SESSION_LOG.md                     Running record.
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── eslint.config.mjs
├── vitest.config.ts                   Unit tests, src/core only
├── vitest.integration.config.ts       Integration tests, real database
├── playwright.config.ts
├── drizzle.config.ts
├── vercel.json                        Cron entry
├── .env.example
│
├── docs/
│   ├── spec.md
│   ├── dev-plan.md
│   ├── plan-summary.md
│   ├── user-journeys.md
│   ├── META-PLAN.md
│   └── phase-N-retro.md               One per completed phase
│
├── tasks/
│   ├── TEMPLATE.md
│   └── phase-N.md                     One per phase
│
├── logs/
│   └── phase-N.md                     Archived session entries
│
├── drizzle/                           Generated migrations. Never hand-edited.
│
├── scripts/
│   ├── demo.ts                        Prints priced booking, schedule, digest for hand review
│   └── spike/                         Pre-flight throwaway scripts
│
├── e2e/
│   ├── fixtures.ts
│   └── journey-N.spec.ts              One file per user journey
│
└── src/
    ├── core/                          PURE. No imports outside src/core and node built-ins.
    │   ├── types.ts                   All domain types. No database types.
    │   ├── dates.ts                   Calendar date arithmetic, inclusive ranges
    │   ├── status.ts                   deriveStatus()
    │   ├── pricing.ts                 priceBooking()
    │   ├── schedule.ts                generateVisits()
    │   ├── digest.ts                  buildDigestModel()
    │   ├── slug.ts                    generateSlug(), alphabet, reserved and blocked lists
    │   ├── presentation.ts            Internal status to customer-facing label
    │   ├── dates.test.ts
    │   ├── status.test.ts
    │   ├── pricing.test.ts
    │   ├── schedule.test.ts
    │   ├── digest.test.ts
    │   └── slug.test.ts
    │
    ├── db/
    │   ├── client.ts                  Drizzle client, single instance
    │   ├── schema.ts                  Full schema
    │   ├── seed.ts                    Development fixtures
    │   └── repositories/
    │       ├── businesses.ts
    │       ├── admins.ts
    │       ├── customers.ts
    │       ├── properties.ts
    │       ├── care-instructions.ts
    │       ├── bookings.ts
    │       ├── visits.ts
    │       ├── visit-logs.ts
    │       ├── photos.ts
    │       ├── activity.ts
    │       ├── links.ts
    │       ├── pricing.ts
    │       ├── weather.ts
    │       └── calendar-events.ts
    │
    ├── services/                      Orchestration. Reads repositories, calls the outside world.
    │   ├── auth.ts                    Magic link issue, consume, session create and verify
    │   ├── links.ts                   Slug allocation, resolution, revocation, rate limiting
    │   ├── bookings.ts                Create, update, confirm, cancel. Writes activity entries.
    │   ├── visits.ts                  Generation, regeneration, logging
    │   ├── storage.ts                 put, signedUrl, delete, list. The only file importing @vercel/blob
    │   ├── calendar.ts                Google Calendar sync and reconciliation
    │   ├── weather.ts                 Forecast read, observed backfill, geocoding
    │   ├── email.ts                   Send, log, retry. The only file importing resend
    │   └── digest.ts                  Assembles inputs, calls core, renders, sends, marks sent
    │
    ├── emails/
    │   ├── layout.tsx
    │   ├── daily-digest.tsx
    │   ├── booking-confirmed.tsx
    │   ├── dates-changed.tsx
    │   ├── booking-cancelled.tsx
    │   ├── intake-received.tsx
    │   └── magic-link.tsx
    │
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx                   Marketing or redirect to admin
    │   ├── (admin)/
    │   │   ├── layout.tsx             Session guard
    │   │   ├── home/page.tsx          Today, needs attention, filtered by acting admin
    │   │   ├── bookings/page.tsx      List with status and flag columns
    │   │   ├── bookings/[id]/page.tsx Booking detail, all sections
    │   │   ├── customers/page.tsx
    │   │   ├── customers/[id]/page.tsx
    │   │   ├── settings/page.tsx      Pricing defaults, copy blocks, calendar sharing, storage
    │   │   └── actions/               Server actions, one file per domain
    │   ├── signin/page.tsx
    │   ├── new/page.tsx               Public intake form
    │   ├── s/[slug]/page.tsx          Link resolution and dispatch
    │   └── api/
    │       ├── cron/daily/route.ts    The single scheduled job
    │       └── auth/callback/route.ts Magic link consumption
    │
    ├── components/
    └── lib/
        ├── env.ts                     Parsed and validated environment
        ├── session.ts                 Cookie read and write
        └── rate-limit.ts              Database-backed, no Redis
```

**The `src/core/` boundary is the most important line in this repository.** Nothing in `src/core/` may import from `src/db/`, `src/services/`, `src/app/`, or any package that performs input or output. This is enforced by lint rule and by an architectural rule in `AGENTS.md`.

---

## 4. Environment variables

Grouped by the phase that introduces them. Every one appears in `.env.example`.

**Phase 1 — persistence and auth**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `SESSION_SECRET` | HMAC key for session cookie signing |
| `APP_URL` | Absolute base URL, used to build links in emails |
| `RESEND_API_KEY` | Email delivery, first used for magic links |
| `EMAIL_FROM` | Verified sender address on the custom domain |

**Phase 3 — links**

| Variable | Purpose |
|---|---|
| `LINK_RATE_LIMIT_PER_MINUTE` | Slug resolution attempts per IP, default 30 |

**Phase 4 — photos**

| Variable | Purpose |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access, provisioned by Vercel |
| `PHOTO_SIGNED_URL_TTL_SECONDS` | Default 900 |

**Phase 5 — calendar**

| Variable | Purpose |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account identity |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | PEM key, newlines escaped |
| `GOOGLE_CALENDAR_ID` | Written after the calendar is created, or stored in the businesses table |

**Phase 6 — notifications**

| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Provisioned by Vercel, verified in the cron route handler |
| `DIGEST_LOCAL_HOUR` | Local hour the digest should send, default 7 |

**All phases**

| Variable | Purpose |
|---|---|
| `NODE_ENV` | |
| `APP_TIMEZONE` | Fixed to `America/New_York`, present so it is never hard-coded in logic |

---

## 5. Database schema

Postgres. Written here as DDL for clarity; implemented in `src/db/schema.ts` and materialized through generated migrations.

```sql
-- Enumerations -------------------------------------------------------------

CREATE TYPE cadence AS ENUM (
  'every_day', 'every_other_day', 'every_third_day',
  'once_at_start', 'once_at_end', 'as_needed', 'custom'
);

CREATE TYPE time_window AS ENUM (
  'morning', 'midday', 'afternoon', 'evening', 'anytime'
);

CREATE TYPE visit_outcome AS ENUM (
  'completed', 'partially_completed', 'skipped', 'could_not_complete'
);

CREATE TYPE pricing_component_type AS ENUM (
  'per_day', 'per_visit', 'flat', 'per_hour', 'custom'
);

CREATE TYPE activity_source AS ENUM (
  'text_message', 'in_person', 'email', 'phone', 'customer_form', 'app'
);

CREATE TYPE link_type AS ENUM (
  'customer_portal', 'booking_form', 'public_intake'
);

CREATE TYPE calendar_event_kind AS ENUM ('booking', 'visit');

-- Tenancy and identity -----------------------------------------------------

CREATE TABLE businesses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  contact_email       text NOT NULL,
  contact_phone       text,
  timezone            text NOT NULL DEFAULT 'America/New_York',
  google_calendar_id  text,
  copy_confirmation   text NOT NULL DEFAULT '',
  copy_what_to_leave  text NOT NULL DEFAULT '',
  copy_pricing        text NOT NULL DEFAULT '',
  copy_payment        text NOT NULL DEFAULT '',
  copy_changes        text NOT NULL DEFAULT '',
  digest_local_hour   integer NOT NULL DEFAULT 7,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email         text NOT NULL,
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz,
  UNIQUE (business_id, email)
);

CREATE TABLE magic_link_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Customers and properties -------------------------------------------------

CREATE TABLE customers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name         text NOT NULL,
  email        text,
  phone        text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customers_business_email_idx ON customers (business_id, lower(email));

CREATE TABLE properties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  nickname      text NOT NULL,
  address       text,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  geocoded_at   timestamptz,
  access_notes  text,          -- ADMIN ONLY. Never selected for customer surfaces.
  access_codes  text,          -- ADMIN ONLY. Never selected for customer surfaces.
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE care_instructions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  property_id       uuid REFERENCES properties(id) ON DELETE CASCADE,
  booking_id        uuid REFERENCES bookings(id) ON DELETE CASCADE,
  label             text NOT NULL,
  detail            text,
  cadence           cadence NOT NULL DEFAULT 'as_needed',
  cadence_custom    text,
  weather_relevant  boolean NOT NULL DEFAULT false,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_owner CHECK (
    (property_id IS NOT NULL AND booking_id IS NULL) OR
    (property_id IS NULL AND booking_id IS NOT NULL)
  )
);

-- Bookings -----------------------------------------------------------------

CREATE TABLE bookings (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id               uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  property_id               uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  start_date                date,
  end_date                  date,
  dates_approximate         boolean NOT NULL DEFAULT true,

  dates_firm_at             timestamptz,
  dates_firm_by             uuid REFERENCES admins(id),
  availability_checked_at   timestamptz,
  availability_checked_by   uuid REFERENCES admins(id),

  declined_at               timestamptz,
  declined_by               uuid REFERENCES admins(id),
  cancelled_at              timestamptz,
  cancelled_by              uuid REFERENCES admins(id),

  paid_at                   date,
  paid_method_note          text,

  pricing_snapshot_at       timestamptz,
  day_count_override        integer,
  visit_count_override      integer,

  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid REFERENCES admins(id),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT range_ordered CHECK (
    start_date IS NULL OR end_date IS NULL OR end_date >= start_date
  )
);

CREATE INDEX bookings_business_start_idx ON bookings (business_id, start_date);

CREATE TABLE pricing_components (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id   uuid REFERENCES bookings(id) ON DELETE CASCADE,  -- NULL = business default
  type         pricing_component_type NOT NULL,
  label        text NOT NULL,
  amount_cents integer NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE adhoc_line_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id   uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  label        text NOT NULL,
  amount_cents integer NOT NULL,   -- may be negative for a discount
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Visits -------------------------------------------------------------------

CREATE TABLE visits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id       uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  visit_date       date NOT NULL,
  window           time_window NOT NULL DEFAULT 'anytime',
  duration_minutes integer,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, visit_date)
);

CREATE TABLE visit_tasks (
  visit_id             uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  care_instruction_id  uuid NOT NULL REFERENCES care_instructions(id) ON DELETE CASCADE,
  PRIMARY KEY (visit_id, care_instruction_id)
);

CREATE TABLE visit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  visit_id     uuid NOT NULL UNIQUE REFERENCES visits(id) ON DELETE CASCADE,
  outcome      visit_outcome NOT NULL,
  note         text,
  logged_date  date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES admins(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  visit_log_id uuid NOT NULL REFERENCES visit_logs(id) ON DELETE CASCADE,
  storage_key  text NOT NULL,
  width        integer,
  height       integer,
  bytes        integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES admins(id)
);

-- Communication and access -------------------------------------------------

CREATE TABLE activity_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id   uuid REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id  uuid REFERENCES customers(id) ON DELETE CASCADE,
  note         text NOT NULL,
  source       activity_source NOT NULL,
  entry_date   date NOT NULL,
  actor_id     uuid REFERENCES admins(id),
  is_system    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT has_subject CHECK (booking_id IS NOT NULL OR customer_id IS NOT NULL)
);

CREATE TABLE links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  slug         text NOT NULL UNIQUE,   -- stored uppercase, resolved case-insensitively
  type         link_type NOT NULL,
  customer_id  uuid REFERENCES customers(id) ON DELETE CASCADE,
  booking_id   uuid REFERENCES bookings(id) ON DELETE CASCADE,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  hit_count    integer NOT NULL DEFAULT 0,
  last_hit_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rate_limit_hits (
  key         text NOT NULL,
  window_start timestamptz NOT NULL,
  count       integer NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

-- Integrations -------------------------------------------------------------

CREATE TABLE observed_weather (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  property_id        uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  observed_date      date NOT NULL,
  temp_max_f         numeric(5,1),
  temp_min_f         numeric(5,1),
  precipitation_in   numeric(5,2),
  summary            text NOT NULL,
  fetched_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, observed_date)
);

CREATE TABLE calendar_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind             calendar_event_kind NOT NULL,
  booking_id       uuid REFERENCES bookings(id) ON DELETE CASCADE,
  visit_id         uuid REFERENCES visits(id) ON DELETE CASCADE,
  google_event_id  text,
  dirty            boolean NOT NULL DEFAULT true,
  synced_at        timestamptz,
  last_error       text,
  CONSTRAINT has_target CHECK (booking_id IS NOT NULL OR visit_id IS NOT NULL)
);

CREATE TABLE email_sends (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  recipient    text NOT NULL,
  subject      text NOT NULL,
  provider_id  text,
  error        text,
  sent_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE digest_sends (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  send_date    date NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  recipients   integer NOT NULL,
  UNIQUE (business_id, send_date)
);
```

**Note on ordering:** `care_instructions` references `bookings`, which is declared after it. In the generated migration the foreign key is added after both tables exist. Drizzle handles this; the DDL above is grouped for readability, not execution order.

---

## 6. Core types

Defined in `src/core/types.ts`. These are the domain's vocabulary and are independent of database row shapes. Repositories map rows to these types.

```ts
// A calendar date with no time and no zone. Stored and passed as 'YYYY-MM-DD'.
export type CalendarDate = string & { readonly __brand: 'CalendarDate' };

export type Cadence =
  | 'every_day' | 'every_other_day' | 'every_third_day'
  | 'once_at_start' | 'once_at_end' | 'as_needed' | 'custom';

export type BookingStatus =
  | 'inquiry' | 'tentative' | 'confirmed' | 'in_progress'
  | 'complete' | 'closed' | 'declined' | 'cancelled';

export type CustomerFacingStatus =
  | 'requested' | 'waiting_on_you' | 'waiting_on_us' | 'confirmed'
  | 'in_progress' | 'complete' | 'cancelled';

export interface CareInstruction {
  id: string;
  label: string;
  detail: string | null;
  cadence: Cadence;
  cadenceCustom: string | null;
  weatherRelevant: boolean;
  sortOrder: number;
}

export interface PricingComponent {
  id: string;
  type: 'per_day' | 'per_visit' | 'flat' | 'per_hour' | 'custom';
  label: string;
  amountCents: number;
  sortOrder: number;
}

export interface AdhocLineItem {
  id: string;
  label: string;
  amountCents: number;
  sortOrder: number;
}

export interface BookingCore {
  id: string;
  startDate: CalendarDate | null;
  endDate: CalendarDate | null;
  datesApproximate: boolean;
  datesFirmAt: string | null;
  availabilityCheckedAt: string | null;
  declinedAt: string | null;
  cancelledAt: string | null;
  paidAt: CalendarDate | null;
  dayCountOverride: number | null;
  visitCountOverride: number | null;
}

export interface VisitCore {
  id: string;
  date: CalendarDate;
  window: 'morning' | 'midday' | 'afternoon' | 'evening' | 'anytime';
  durationMinutes: number | null;
  taskIds: string[];
}

// --- Pricing output -------------------------------------------------------

export interface LineItem {
  label: string;
  basis: string;            // e.g. "7 days at $5.00"
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  source: 'component' | 'adhoc';
}

export interface PricedBooking {
  lineItems: LineItem[];
  totalCents: number;
  dayCount: number;
  visitCount: number;
  dayCountWasOverridden: boolean;
  visitCountWasOverridden: boolean;
}

// --- Schedule output ------------------------------------------------------

export interface GeneratedVisit {
  date: CalendarDate;
  taskIds: string[];
}

export interface ScheduleResult {
  visits: GeneratedVisit[];
  skippedInstructions: { id: string; reason: string }[];
}

// --- Digest output --------------------------------------------------------

export interface DigestTimelineDay {
  date: CalendarDate;
  position: 'past' | 'today' | 'future';
  hasVisit: boolean;
  logged: boolean;
  outcome: string | null;
  summary: string | null;    // truncated visit note
}

export interface DigestBookingBlock {
  bookingId: string;
  propertyNickname: string;
  customerName: string;
  startDate: CalendarDate;
  endDate: CalendarDate;
  todayVisit: VisitCore | null;
  todayTasks: string[];
  timeline: DigestTimelineDay[];
  weather: DigestWeather | null;
}

export interface DigestWeather {
  highF: number;
  lowF: number;
  precipitationChance: number;
  expectedInches: number;
  derivedLine: string | null;   // e.g. "rain likely after 2pm"
}

export interface DigestAttentionItem {
  kind: 'unlogged_visit' | 'missing_dates_firm' | 'missing_availability_check' | 'starts_soon_unconfirmed';
  bookingId: string;
  label: string;
  href: string;
}

export interface DigestModel {
  date: CalendarDate;
  bookings: DigestBookingBlock[];
  attention: DigestAttentionItem[];
  isEmpty: boolean;
}
```

### 6.1 Documented default instance

The default pricing profile the business launches with, used as the demo fixture and as the seed value:

```ts
export const DEFAULT_PRICING_COMPONENTS: PricingComponent[] = [
  { id: 'default-per-day',   type: 'per_day',   label: 'Daily rate',  amountCents: 500, sortOrder: 0 },
  { id: 'default-per-visit', type: 'per_visit', label: 'Per visit',   amountCents: 600, sortOrder: 1 },
];
```

Worked example, which must appear as a unit test in `src/core/pricing.test.ts`. A seven day service range with four visits produces two line items and a total of 5900 cents: seven days at 500 cents is 3500, four visits at 600 cents is 2400.

---

## 7. Routes and actions

Next.js App Router. Mutations are server actions. Route handlers exist only where an external caller needs an HTTP endpoint.

### 7.1 Pages

| Path | Auth | Purpose |
|---|---|---|
| `/` | none | Redirect to `/home` when signed in, otherwise a minimal landing page |
| `/signin` | none | Email entry, issues a magic link |
| `/home` | session | Today's visits, needs-attention list filtered by acting admin |
| `/bookings` | session | Booking list with status and both confirmation flags visible |
| `/bookings/[id]` | session | Booking detail, all sections from spec §5.4 |
| `/customers` | session | Customer list |
| `/customers/[id]` | session | Customer detail, properties, care instructions, engagement history |
| `/settings` | session | Pricing defaults, copy blocks, calendar sharing, admin list, storage usage |
| `/new` | none | Public intake form |
| `/s/[slug]` | link | Resolves and dispatches to portal or booking form |

### 7.2 Route handlers

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/auth/callback` | token | Consumes a magic link token, creates a session, redirects |
| GET | `/api/cron/daily` | `CRON_SECRET` bearer | The single scheduled job |
| GET | `/api/photos/[id]` | session or link | Issues a redirect to a short-lived signed URL |

### 7.3 Server actions

Grouped by file under `src/app/(admin)/actions/`.

| Action | Purpose |
|---|---|
| `createBooking` | Fast capture. Creates customer and property if needed. |
| `updateBookingDates` | Start, end, approximate flag. Triggers calendar and visit reconciliation. |
| `setDatesFirm` | Sets or clears the flag with actor and timestamp. |
| `setAvailabilityChecked` | Sets or clears the flag with actor and timestamp. Isolated submission. |
| `declineBooking` / `cancelBooking` | Terminal transitions. |
| `markPaid` | Paid date and method note. |
| `upsertCareInstruction` / `deleteCareInstruction` | Property-level or booking-level override. |
| `regenerateVisits` | Explicit action. Warns on visits with logs. |
| `upsertVisit` / `deleteVisit` | Individual visit editing. |
| `logVisit` | Outcome, note, logged date. |
| `uploadPhoto` / `deletePhoto` | Photo lifecycle. |
| `addActivityEntry` | Manual out-of-band note. |
| `upsertPricingComponent` / `deletePricingComponent` | Business defaults and booking overrides. |
| `addAdhocLineItem` / `deleteAdhocLineItem` | Ad-hoc lines. |
| `overrideCounts` | Day count and visit count overrides. |
| `rotateCustomerLink` | Revokes and reissues. |
| `submitIntake` | Public, unauthenticated. Creates customer, property, booking. |
| `submitBookingForm` | Link-authenticated. Updates an existing booking. |
| `shareCalendarWith` | Adds an ACL rule by email address. |
| `updateBusinessSettings` | Copy blocks, digest hour, contact details. |

---

## 8. Performance targets

Acceptance criteria are written against these numbers.

| Target | Value | Why |
|---|---|---|
| Fast capture, human time | Under 30 seconds | The product fails if it is slower than remembering |
| `createBooking` action round trip | Under 500 ms p95 | Capture must not feel like waiting |
| Booking detail page, warm | Under 400 ms TTFB | Used one-handed in a driveway |
| Slug resolution | Under 200 ms | Customer's first impression |
| Daily job, 10 active bookings | Under 8 seconds wall clock | Hobby function timeout is 10 seconds |
| `buildDigestModel` pure call | Under 50 ms | Leaves the budget for input and output |
| Client-side photo compression, 4 MB source | Under 2 seconds on a mid-range phone | Upload must not feel broken |
| Compressed photo size | Under 400 KB | 1 GB free tier holds years of use |

---

## 9. Phase decomposition

### 9.0 Reasoning for the ordering

Pure logic comes first because pricing and visit scheduling are the parts that are expensive to get wrong and cheap to test, and because building them with no server and no database removes every source of friction from the hardest work. Persistence and admin authentication come second because every later surface reads from them. The admin surface comes third, before anything customer-facing, because the admins are the daily users and because the thirty-second capture flow is the interaction the whole product depends on. Links and customer surfaces come fourth, since they present data that must already exist. Visit logging and photos come fifth, as a distinct flow with its own storage concern. Calendar and notifications come after the data they publish, because an integration built against a moving schema gets built twice. Visual identity goes last as its own phase, per the framework's heuristic, because doing it before the flows settle means doing it twice.

### Phase 0 — Pure core

**Goal:** every non-trivial calculation in the product exists as a tested pure function before any infrastructure is written.

**What is built:**

- `src/core/types.ts` — the full type vocabulary from §6
- `src/core/dates.ts` — inclusive range expansion, day counting, day-of-range arithmetic, `America/New_York` calendar date handling with no timezone drift
- `src/core/status.ts` — `deriveStatus(booking, today)` implementing the table in spec §6.4, plus `toCustomerFacing(status, booking)`
- `src/core/pricing.ts` — `priceBooking({ components, adhocItems, dayCount, visitCount, totalDurationMinutes, overrides })` returning `PricedBooking`
- `src/core/schedule.ts` — `generateVisits({ startDate, endDate, instructions })` returning `ScheduleResult`, collapsing multiple instructions on the same date into one visit
- `src/core/digest.ts` — `buildDigestModel({ today, bookings, visits, logs, weather })` returning `DigestModel`
- `src/core/slug.ts` — alphabet, reserved list, blocked list, `generateSlug(random)` taking an injected random source
- `src/core/presentation.ts` — status label mapping and note truncation
- `scripts/demo.ts` — prints a priced booking, a generated schedule, and a rendered digest model for hand inspection

**What this phase does not do:** no database, no server, no HTTP, no React, no email templates.

**Review focus:** the demo output. Are the line item labels readable? Is the day count right at both ends of the range? Does an every-other-day cadence over an eight day range produce the visits you expect?

### Phase 1 — Persistence and admin authentication

**Goal:** the schema exists, repositories are the only path to it, and an admin can sign in.

**What is built:**

- `src/db/schema.ts` and the first generated migration
- `src/db/client.ts`, `src/db/seed.ts` with one business, two admins, two customers, and three bookings in different states
- `src/db/repositories/*.ts` for every table, each taking a business identifier
- `src/services/auth.ts` — magic link issue, consume, session creation, session verification
- `src/services/email.ts` — send, log to `email_sends`, retry once
- `src/emails/magic-link.tsx`
- `/signin`, `/api/auth/callback`, session cookie handling, `(admin)/layout.tsx` guard
- One stub page at `/home` that renders the signed-in admin's name

**What this phase does not do:** no booking user interface, no customer surfaces, no calendar, no photos.

**Review focus:** are route handlers thin? Is there any SQL outside `src/db/`? Does an expired token fail closed?

### Phase 2 — Admin surface

**Goal:** both admins can run the business end to end from a phone, with no customer-facing surface yet.

**What is built:**

- Fast capture screen and `createBooking`
- Booking list with status and both flags as columns, filterable
- Booking detail with all sections from spec §5.4
- The two confirmation actions as isolated submissions
- Care instruction editing, including booking-level overrides
- Visit generation on confirmation, visit list, individual visit editing
- Pricing section reading `src/core/pricing.ts`, with overrides and ad-hoc items
- Activity log with manual entries and automatic system entries
- Per-user action stamping throughout
- `/home` showing today and needs-attention, filtered by the acting admin

**What this phase does not do:** no photos, no customer portal, no links, no calendar, no digest.

**Review focus:** time the capture flow on a real phone against the thirty second target. **Also evaluate the open question in spec §10** about whether the isolated availability-check submission is worth its friction.

### Phase 3 — Links and customer surfaces

**Goal:** a customer can request service and see their own engagements without an account.

**What is built:**

- `src/services/links.ts` — slug allocation with collision retry, resolution, revocation, hit counting
- `src/lib/rate-limit.ts` — database-backed, no external dependency
- `/s/[slug]` resolution and dispatch
- `/new` public intake form and `submitIntake`
- Booking form link behavior and `submitBookingForm`
- Customer portal page with upcoming and past engagements, care details, costs, and copy blocks
- Copy-link actions across the admin surface using the native share sheet
- `rotateCustomerLink`

**What this phase does not do:** no photos in the portal yet, no emails beyond what Phase 1 built.

**Review focus:** query-level exclusion of access codes and activity entries. Confirm the customer portal query cannot return them, rather than confirming the template does not render them.

### Phase 4 — Visits and logging

**Goal:** the sitter can record what happened, with photos, and the customer can see it.

**What is built:**

- `src/services/storage.ts` — the only file importing the storage vendor
- Client-side compression before upload
- Visit log form with outcome, note, and photos
- `/api/photos/[id]` signed URL redirect, honoring both session and link authentication
- Photo delete
- Visit notes and photos in the customer portal
- Storage usage indicator in settings

**What this phase does not do:** no weather, no calendar, no digest.

**Review focus:** attempt to reach a photo without a valid session or link. Confirm signed URLs expire.

### Phase 5 — Calendar synchronization

**Goal:** the family calendar reflects the business without anyone maintaining it.

**What is built:**

- `src/services/calendar.ts` — service account authentication, calendar creation, ACL sharing
- `shareCalendarWith` and the settings user interface for it
- Event mapping per spec §5.12, including the tentative treatment
- Extended property tagging with booking and visit identifiers
- Reconciliation: a dirty flag on `calendar_events`, swept by the daily job
- Failure recording that never blocks a booking write

**What this phase does not do:** no digest yet, no weather.

**Prerequisite:** the pre-flight spike proving service account calendar creation and sharing must have passed.

**Review focus:** edit an event manually in Google, then change the booking, and confirm reconciliation does the right thing.

### Phase 6 — Notifications and the daily digest

**Goal:** both admins get one useful email each morning, and customers get the transactional emails they need.

**What is built:**

- `src/services/weather.ts` — geocoding on address save, forecast read, observed backfill
- Remaining email templates: daily digest, booking confirmed, dates changed, booking cancelled, intake received
- `src/services/digest.ts` — assemble, call `buildDigestModel`, render, send, record in `digest_sends`
- `/api/cron/daily` with `CRON_SECRET` verification, local hour check, and idempotency
- `vercel.json` cron entry
- Digest hour setting

**What this phase does not do:** no SMS, no push, no evening send.

**Review focus:** run the job twice and confirm one send. Run it at the wrong local hour and confirm a no-op. Time it against the eight second target.

### Phase 7 — Identity and launch

**Goal:** the product looks like something, and it is safe to point a domain at.

**What is built:**

- Visual design pass across all surfaces, with the customer-facing surfaces treated as the priority
- Business copy blocks written and loaded
- Domain configuration and email sender verification on the custom domain
- Rate limit tuning, link hygiene review, access code audit
- Database backup procedure documented
- Deploy runbook in `README.md`
- `docs/project-retro.md`

---

## 10. Dependency map

```
Phase 0  core (pure)
   │
   ├──────────────────────────────┐
   ▼                              │
Phase 1  schema, repositories,    │
         auth, email send         │
   │                              │
   ▼                              │
Phase 2  admin surface ◄──────────┘  (uses core/pricing, core/schedule, core/status)
   │
   ├────────────────┐
   ▼                ▼
Phase 3  links   Phase 4  visits and photos
   │                │
   └───────┬────────┘
           ▼
Phase 5  calendar        (needs bookings and visits from Phase 2)
           │
           ▼
Phase 6  digest          (needs core/digest, visit logs from Phase 4,
           │              weather, email from Phase 1)
           ▼
Phase 7  identity and launch
```

Phase 3 and Phase 4 are independent of each other and could be reordered. Phase 4 before Phase 3 would mean photos exist before any customer can see them, which is the less useful order.

---

## 11. Testing strategy

### 11.1 Commands

Every one of these must be literally runnable in the repository.

| Command | Scope |
|---|---|
| `pnpm test` | All Vitest unit tests |
| `pnpm test:unit` | `src/core/` only, no database |
| `pnpm test:integration` | Repositories and services against a real Postgres |
| `pnpm test:e2e` | Playwright against a running dev server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint across the repository |
| `pnpm demo` | Prints core output for hand inspection |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Load development fixtures |

### 11.2 What a good test asserts, by layer

**Core (`src/core/`).** Table-driven tests asserting on output content. A pricing test asserts the exact line item labels, quantities, and total in cents. A schedule test asserts the exact list of dates. A test that calls a function and asserts the result is defined is not a test and is not acceptable.

Specific cases that must be covered:

- Pricing: the worked example in §6.1; a booking with all five component types active; a negative ad-hoc item; an overridden day count; a zero-visit booking
- Schedule: a one day range; an even-length range with every-other-day; an odd-length range with every-other-day; two instructions producing one visit on a shared date; `as_needed` producing nothing
- Status: every row of the table in spec §6.4, plus the precedence of cancelled and declined over everything
- Dates: a range spanning a daylight saving transition, asserting the day count is unaffected
- Slug: alphabet membership, length, rejection of reserved words, rejection of blocked words, collision retry
- Digest: a booking mid-range with a mix of logged and unlogged past days

**Repositories (`src/db/`).** Integration tests against a real Postgres, asserting persisted state after the call, not the return value alone. Every repository function that writes has a test that reads the row back. Every read function has a test proving it does not return rows from another business.

**Services (`src/services/`).** Integration tests with the external client faked at the module boundary. Google, Open-Meteo, Resend, and the storage vendor are each faked once, in a shared fixture. Contract assumptions about their responses are captured as recorded fixtures, so a change in their shape fails a test rather than production.

Specific cases that must be covered:

- Links: a revoked slug does not resolve; an expired slug does not resolve; resolution is case-insensitive; rate limiting engages
- Storage: a signed URL expires; a deleted photo's key is gone
- Calendar: a failed sync marks dirty and does not roll back the booking write
- Digest: a second run on the same date sends nothing; a run at the wrong local hour sends nothing
- Customer surfaces: a portal query cannot return `access_codes`, `access_notes`, or activity entries

**End-to-end (`e2e/`).** One Playwright file per user journey in `docs/user-journeys.md`. Each test cites the journey step range it covers in a file header comment. These are the tests that catch integration gaps between surfaces.

### 11.3 The rule that outranks all of the above

A failing test is a blocker to document, never a test to weaken. If an acceptance criterion cannot be met, the session stops and the blocker goes in `SESSION_LOG.md`.

---

## 12. Pre-flight risk validation

Two assumptions carry the plan. Both are validated in throwaway scripts under `scripts/spike/` before the scaffold session, and the findings become the first `SESSION_LOG.md` entry.

**Spike 1 — Google service account calendar.** Prove that a service account can create a secondary calendar, insert an ACL rule granting a personal Gmail address access, and that the calendar then appears in that account's Google Calendar. Prove that an event written with extended properties can be read back and matched. If this fails, the calendar design in spec §5.12 changes shape and Phase 5 must be replanned.

**Spike 2 — Daily job inside the Hobby budget.** Prove that fetching weather for three properties, composing a digest, and sending two emails completes inside the ten second function timeout. If it does not, the job must be split or the plan moves to Vercel Pro.

Neither spike produces code that ships. Both produce a recorded finding.
