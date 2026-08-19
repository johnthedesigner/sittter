# Phase 0 — Pure Core

> **Status:** Not started
> **Depends on:** Pre-flight spikes recorded in `SESSION_LOG.md`; scaffold session complete with type check, lint, and both test runners verifying cleanly
> **Reference:** `docs/dev-plan.md` § Phase 0 — Pure core

---

## Overview

Every non-trivial calculation in sittter is built here as a side-effect-free function, with heavy unit tests, before any infrastructure exists. That means calendar date arithmetic, booking status derivation, the pricing engine, visit schedule generation from cadences, digest model composition, and slug generation. The phase is done when `pnpm demo` prints a priced booking, a generated visit schedule, and a rendered digest model that a human can read and judge by hand.

**What this phase does not change:** there is no database, no server, no HTTP, no React, no email template, and no environment variable read in this phase. Nothing under `src/db/`, `src/services/`, `src/app/`, `src/emails/`, or `src/components/` is created or modified.

---

## Reference data

Resolved during planning. No task should invent these.

### Slug alphabet

Crockford base32. Thirty-two characters, digits and letters, with `I`, `L`, `O`, and `U` already absent from the set:

```
0123456789ABCDEFGHJKMNPQRSTVWXYZ
```

Slug length is 5. That gives 32^5 = 33,554,432 combinations. Slugs are generated uppercase, stored uppercase, and resolved case-insensitively.

### Reserved slugs

A generated slug matching any of these, case-insensitively, is regenerated:

```
about   admin   api     app     auth    health  help    home
login   logout  new     null    privacy robots  s       settings
signin  signout sitemap static  status  terms   true    undefined
```

### Blocked slugs

A generated slug matching a word in an offensive-word list is regenerated. Use the `obscenity` package's English dataset rather than vendoring a list into this repository. Filter the dataset at module load to entries that are exactly five characters and composable from the alphabet above; the rest cannot be produced and do not need checking.

### Cadence anchoring

Offsets are counted in days from the service range start date, inclusive.

| Cadence | Offsets produced |
|---|---|
| `every_day` | 0, 1, 2, 3, … through the end of the range |
| `every_other_day` | 0, 2, 4, 6, … |
| `every_third_day` | 0, 3, 6, 9, … |
| `once_at_start` | 0 only |
| `once_at_end` | The last day of the range only |
| `as_needed` | None |
| `custom` | None |

Two instructions producing the same date produce one visit carrying both task identifiers.

### Booking status derivation

Evaluated in this order. The first match wins.

| Order | Status | Condition |
|---|---|---|
| 1 | `cancelled` | `cancelledAt` is set |
| 2 | `declined` | `declinedAt` is set |
| 3 | `inquiry` | `startDate` or `endDate` is null |
| 4 | `tentative` | `datesFirmAt` is null or `availabilityCheckedAt` is null |
| 5 | `closed` | `endDate` is before today and `paidAt` is set |
| 6 | `complete` | `endDate` is before today |
| 7 | `in_progress` | today falls within the inclusive range |
| 8 | `confirmed` | otherwise |

### Customer-facing status mapping

| Internal status | Shown to customer |
|---|---|
| `inquiry` | Requested |
| `tentative`, `datesFirmAt` null | Waiting on you |
| `tentative`, `datesFirmAt` set | Waiting on us |
| `confirmed` | Confirmed |
| `in_progress` | In progress |
| `complete` | Complete |
| `closed` | Complete |
| `declined` | Cancelled |
| `cancelled` | Cancelled |

Internal status names are never rendered on a customer surface.

### Default pricing profile

```ts
[
  { type: 'per_day',   label: 'Daily rate', amountCents: 500 },
  { type: 'per_visit', label: 'Per visit',  amountCents: 600 },
]
```

### Pricing worked example

A seven day service range with four visits, priced with the default profile:

| Label | Basis | Quantity | Unit | Amount |
|---|---|---|---|---|
| Daily rate | 7 days at $5.00 | 7 | 500 | 3500 |
| Per visit | 4 visits at $6.00 | 4 | 600 | 2400 |
| **Total** | | | | **5900** |

This exact case is a required unit test.

### Enumerated values

- **Time windows:** `morning`, `midday`, `afternoon`, `evening`, `anytime`
- **Visit outcomes:** `completed`, `partially_completed`, `skipped`, `could_not_complete`
- **Activity sources:** `text_message`, `in_person`, `email`, `phone`, `customer_form`, `app`
- **Pricing component types:** `per_day`, `per_visit`, `flat`, `per_hour`, `custom`

### Digest note truncation

Timeline summaries truncate a visit note to a maximum of 60 characters, cutting at the last whole word that fits, and appending the single character `…`. A note of 60 characters or fewer is shown whole with no ellipsis.

---

## Tasks

### Task 0.1 — Domain types and calendar date arithmetic

> **Status:** `[x]` Complete
> **Session:** 2026-08-19 — see `SESSION_LOG.md`
> **Depends on:** none

**What this task implements:**
The complete type vocabulary for the domain, and a set of calendar date functions that operate on `'YYYY-MM-DD'` strings without ever constructing a `Date` object for arithmetic. Everything later in this phase depends on both.

**Files to create or modify:**
- `src/core/types.ts` — all types from `docs/dev-plan.md` §6, including the `CalendarDate` branded string type
- `src/core/dates.ts` — `toCalendarDate`, `isValidCalendarDate`, `addDays`, `daysBetween`, `expandRange`, `isWithinRange`, `compareDates`, `todayIn`
- `src/core/dates.test.ts` — tests for the above

**Journey steps enabled:** none — no user-facing surface.

**Acceptance criteria:**
- [x] `expandRange('2026-08-01', '2026-08-07')` returns exactly seven date strings, inclusive of both ends
- [x] `daysBetween('2026-08-01', '2026-08-07')` returns 7, counting inclusively, matching the per-day pricing basis
- [x] `addDays('2026-08-31', 1)` returns `'2026-09-01'`
- [x] `expandRange('2026-03-07', '2026-03-09')` returns exactly three dates, unaffected by the daylight saving transition inside that span
- [x] `expandRange('2026-11-01', '2026-11-01')` returns exactly one date
- [x] `expandRange` with an end date before the start date returns an empty array rather than throwing
- [x] `isValidCalendarDate('2026-02-30')` returns false
- [x] `todayIn(timezone, now)` takes an explicit instant as an argument and reads no clock
- [x] No function in `src/core/dates.ts` calls `Date.now()`, `new Date()` with no argument, or reads a timezone from the environment
- [x] Tests pass: `pnpm test:unit`
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [x] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- Does not implement status derivation, pricing, scheduling, or digests — those are Tasks 0.2 through 0.5
- Does not add a date library dependency; this is arithmetic on `'YYYY-MM-DD'` strings
- Does not create anything under `src/db/`, `src/services/`, or `src/app/`

---

### Task 0.2 — Status derivation and customer-facing presentation

> **Status:** `[x]` Complete
> **Session:** 2026-08-19 — see `SESSION_LOG.md`
> **Depends on:** Task 0.1

**What this task implements:**
The single function that decides what a booking is called, and the mapping that translates it into the language a customer sees. Every surface in the product will read from these.

**Files to create or modify:**
- `src/core/status.ts` — `deriveStatus(booking, today)`
- `src/core/presentation.ts` — `toCustomerFacingStatus(status, booking)`, `truncateNote(note, maxLength)`
- `src/core/status.test.ts` — tests for derivation
- `src/core/presentation.test.ts` — tests for mapping and truncation

**Journey steps enabled:** none — no user-facing surface.

**Acceptance criteria:**
- [x] Every row of the derivation table in Reference data has at least one test asserting the exact resulting status
- [x] A cancelled booking with both confirmation flags set and dates in the future derives `cancelled`, proving precedence
- [x] A declined booking with a past end date and a paid date derives `declined`, proving precedence
- [x] A booking with a start date but no end date derives `inquiry`
- [x] A booking whose range includes today, with both flags set, derives `in_progress`
- [x] A booking whose end date is yesterday, with both flags set and no paid date, derives `complete`
- [x] Every row of the customer-facing mapping table has a test asserting the exact label
- [x] `truncateNote` on a 60-character note returns it unchanged with no ellipsis
- [x] `truncateNote` on a 90-character note returns at most 60 characters plus `…`, cut at a word boundary
- [x] `deriveStatus` takes today as an argument and reads no clock
- [x] Tests pass: `pnpm test:unit`
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [x] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- Does not add a `status` field to any type as stored data; status is computed on demand
- Does not implement pricing or scheduling — those are Tasks 0.3 and 0.4
- Does not create anything under `src/db/`, `src/services/`, or `src/app/`

---

### Task 0.3 — Pricing engine

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Task 0.1

**What this task implements:**
`priceBooking()`, which turns a set of pricing components, ad-hoc line items, and counts into an itemized list and a total in integer cents.

**Files to create or modify:**
- `src/core/pricing.ts` — `priceBooking(input)` returning `PricedBooking`
- `src/core/pricing.test.ts` — tests

**Journey steps enabled:** none — no user-facing surface.

**Acceptance criteria:**
- [ ] The worked example in Reference data produces exactly two line items and a total of 5900, with the stated labels, quantities, and unit amounts
- [ ] All five component types active on one booking produce five line items in `sortOrder` order
- [ ] A `per_day` component prices against the day count, which counts every calendar day in the service range inclusively, including days with no visit
- [ ] A `per_hour` component prices against the summed visit durations in minutes, and produces no line item when every duration is null
- [ ] A `day_count_override` of 6 against a 7 day range produces a 6 day line item, and `dayCountWasOverridden` is true
- [ ] A `visit_count_override` behaves equivalently
- [ ] An ad-hoc line item with a negative amount reduces the total
- [ ] A booking with zero visits and a `per_visit` component produces no `per_visit` line item, not a zero-amount one
- [ ] Every returned amount is an integer; no test value is a floating point number
- [ ] `basis` strings are human-readable and match the format in the worked example
- [ ] Tests pass: `pnpm test:unit`
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- Does not format currency for display; formatting happens at the display layer
- Does not decide when a snapshot is taken; that is Phase 2 service logic
- Does not implement scheduling — that is Task 0.4
- Does not create anything under `src/db/`, `src/services/`, or `src/app/`

---

### Task 0.4 — Visit schedule generation

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Task 0.1

**What this task implements:**
`generateVisits()`, which turns a service range and a set of care instructions into a list of dated visits, collapsing instructions that fall on the same date into one visit.

**Files to create or modify:**
- `src/core/schedule.ts` — `generateVisits({ startDate, endDate, instructions })` returning `ScheduleResult`
- `src/core/schedule.test.ts` — tests

**Journey steps enabled:** none — no user-facing surface.

**Acceptance criteria:**
- [ ] `every_day` over a 7 day range produces 7 visits
- [ ] `every_other_day` over an 8 day range produces 4 visits, on offsets 0, 2, 4, 6
- [ ] `every_other_day` over a 7 day range produces 4 visits, on offsets 0, 2, 4, 6
- [ ] `every_third_day` over a 7 day range produces 3 visits, on offsets 0, 3, 6
- [ ] `once_at_start` produces exactly one visit on the start date
- [ ] `once_at_end` produces exactly one visit on the end date
- [ ] `as_needed` and `custom` produce no visits and appear in `skippedInstructions` with a stated reason
- [ ] A daily cat instruction and an every-other-day plant instruction over a 7 day range produce 7 visits, of which 4 carry both task identifiers and 3 carry one
- [ ] A single-day range with `once_at_start` and `once_at_end` produces exactly one visit carrying both task identifiers
- [ ] Returned visits are sorted ascending by date with no duplicate dates
- [ ] An empty instruction list produces zero visits and does not throw
- [ ] Tests pass: `pnpm test:unit`
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- Does not decide what happens to existing visits on regeneration; that preservation logic is Phase 2 service work
- Does not assign time windows; generated visits default to `anytime` at the service layer
- Does not create anything under `src/db/`, `src/services/`, or `src/app/`

---

### Task 0.5 — Digest model composition

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Tasks 0.1, 0.2

**What this task implements:**
`buildDigestModel()`, which assembles the daily email's content as a data structure. Rendering to HTML happens in Phase 6; this task decides what the email says.

**Files to create or modify:**
- `src/core/digest.ts` — `buildDigestModel(input)` returning `DigestModel`
- `src/core/digest.test.ts` — tests

**Journey steps enabled:** none — no user-facing surface.

**Acceptance criteria:**
- [ ] A booking mid-range produces a timeline covering every date in the service range, with each day marked `past`, `today`, or `future`
- [ ] Past days with a visit log show a truncated summary; past days with a visit but no log show `logged: false`; past days with no visit show `hasVisit: false`
- [ ] Future days carry no summary and no outcome
- [ ] An unlogged visit on a past date produces an `unlogged_visit` attention item
- [ ] A booking missing `datesFirmAt` produces a `missing_dates_firm` attention item
- [ ] A booking missing `availabilityCheckedAt` produces a `missing_availability_check` attention item
- [ ] A booking starting within 7 days that is not confirmed produces a `starts_soon_unconfirmed` attention item
- [ ] Weather appears on a booking block only when at least one of its care instructions is `weatherRelevant`
- [ ] A model with no bookings and no attention items has `isEmpty: true`
- [ ] A model with no bookings but one attention item has `isEmpty: false`
- [ ] `buildDigestModel` takes today as an argument and reads no clock
- [ ] Tests pass: `pnpm test:unit`
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- Does not render HTML or produce an email subject line — that is Phase 6
- Does not fetch weather; weather arrives as an argument
- Does not decide whether to send; that is Phase 6 service logic
- Does not create anything under `src/db/`, `src/services/`, or `src/app/`

---

### Task 0.6 — Slug generation and the demo harness

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Tasks 0.1 through 0.5

**What this task implements:**
Slug generation with its reserved and blocked word checks, and the demo script that makes the whole phase inspectable by a human. These are bundled because each is small and neither depends on the other.

**Files to create or modify:**
- `src/core/slug.ts` — `ALPHABET`, `SLUG_LENGTH`, `RESERVED`, `generateSlug(random)`, `isReserved(slug)`, `isBlocked(slug)`, `normalizeSlug(input)`
- `src/core/slug.test.ts` — tests
- `scripts/demo.ts` — prints a priced booking, a generated schedule, and a digest model
- `package.json` — adds the `demo` script

**Journey steps enabled:** none — no user-facing surface.

**Acceptance criteria:**
- [ ] `generateSlug` produces a 5-character string drawn only from the alphabet in Reference data
- [ ] `generateSlug` takes a random source as an argument and does not call `Math.random()`
- [ ] Given a seeded random source that would produce a reserved word, `generateSlug` retries and returns a different, valid slug
- [ ] Given a seeded random source that would produce a blocked word, `generateSlug` retries and returns a different, valid slug
- [ ] `normalizeSlug('ab3k9')` and `normalizeSlug('AB3K9')` return the same value
- [ ] `normalizeSlug` on a string containing a character outside the alphabet returns null
- [ ] `pnpm demo` runs to completion and prints, in order: an itemized priced booking matching the worked example, a generated visit schedule for a 7 day range with two instructions of different cadences, and a digest model for a mid-booking day rendered as readable text
- [ ] `pnpm demo` reads no environment variable, opens no network connection, and writes no file
- [ ] Tests pass: `pnpm test:unit`
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- Does not implement link storage, resolution, expiry, revocation, or rate limiting — that is Phase 3
- Does not vendor an offensive-word list into the repository; use the `obscenity` package
- Does not create anything under `src/db/`, `src/services/`, or `src/app/`

---

## Phase completion checklist

- [ ] All tasks above marked `[x]`
- [ ] `pnpm test:unit` passes with zero failures
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] `pnpm demo` output read by a human and judged correct, not merely non-throwing
- [ ] ESLint's restricted-import rule for `src/core/` is active and demonstrably fails on a deliberate violation
- [ ] `SESSION_LOG.md` has a complete entry for every session in this phase
- [ ] `docs/plan-summary.md` status line updated for Phase 0
- [ ] `docs/user-journeys.md` reviewed per its maintenance rule
- [ ] Phase retrospective written to `docs/phase-0-retro.md`
- [ ] Housekeeping session run
- [ ] `tasks/phase-1.md` generated, reviewed, and committed

*Note: `pnpm test:integration` and `pnpm test:e2e` are expected to exit cleanly with zero tests in this phase. That is a pass, not a skip.*

---

## Completed task log

<!--
### Task 0.X — [Task name] ✓
**Output:** [One sentence: what was built.]
**Key decisions:** [Any non-obvious choices.]
**Session:** [Date / SESSION_LOG pointer]
-->
