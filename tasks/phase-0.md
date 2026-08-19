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

## Tasks — all complete, compressed at the Phase 0 housekeeping session

Full bodies, acceptance criteria, and must-not-do lists are in the git history at commit `54ed85a` and earlier. Session detail is in `logs/phase-0.md`.

### Task 0.1 — Domain types and calendar date arithmetic ✓

**Output:** `src/core/types.ts` (the full §6 vocabulary, including the branded `CalendarDate`) and `src/core/dates.ts` (`toCalendarDate`, `isValidCalendarDate`, `addDays`, `daysBetween`, `expandRange`, `isWithinRange`, `compareDates`, `todayIn`), with 41 tests.
**Key decisions:** No `Date` object appears in the calendar arithmetic — integer day numbers via Hinnant's `days_from_civil`, which makes the daylight-saving criteria pass by construction. `todayIn` is the sole exception and uses `Intl`, because only the zone database knows the offset at an instant. `daysBetween` counts inclusively (7, not 6) as the per-day pricing basis, and returns 0 for an inverted range to agree with `expandRange`. The brand is not exported, so `toCalendarDate` is the only way to make one.
**Session:** 2026-08-19 — `logs/phase-0.md`

---

### Task 0.2 — Status derivation and customer-facing presentation ✓

**Output:** `src/core/status.ts` (`deriveStatus`) and `src/core/presentation.ts` (`toCustomerFacingStatus`, `toCustomerFacingLabel`, `CUSTOMER_FACING_LABELS`, `truncateNote`), with 47 tests.
**Key decisions:** `deriveStatus` is eight sequential branches in the derivation table's order — the order *is* the specification, carrying precedence the individual conditions do not. `CUSTOMER_FACING_LABELS` was added beyond the named API because the criteria assert exact labels and the strings needed one home. `toCustomerFacingStatus` takes the booking as a required argument so pointing at the wrong party cannot happen silently. `truncateNote` had a real defect caught by a spec-first test: a note breaking exactly on a word boundary lost its last whole word.
**Session:** 2026-08-19 — `logs/phase-0.md`

---

### Task 0.3 — Pricing engine ✓

**Output:** `src/core/pricing.ts` (`priceBooking`) plus `DEFAULT_PRICING_COMPONENTS` in `types.ts`, with 31 tests. The worked example is asserted field by field at 5900 cents.
**Key decisions:** A component that does not apply produces no line item rather than a zero-amount one. Ad-hoc items are never suppressed, negative ones included. `per_hour` multiplies in integer cents before dividing and rounds once, so no float is ever held as money; `formatDollars` uses integer division and modulo. `basis` strings contain dollars, which reads against the AGENTS.md display rule but is exactly what `docs/dev-plan.md` §6 defines — recorded rather than silently resolved.
**Session:** 2026-08-19 — `logs/phase-0.md`

---

### Task 0.4 — Visit schedule generation ✓

**Output:** `src/core/schedule.ts` (`generateVisits`), with 24 tests. Every row of the cadence anchoring table has a test asserting the exact dates, not merely the count.
**Key decisions:** The three stepping cadences are one branch parameterized by step, not three near-identical loops. Collapsing uses a `Map` keyed by date, so two instructions on one day become one visit carrying both task identifiers. Coverage flagged an unreachable `return` created by an early `continue`; the `continue` was removed so one path serves every cadence, rather than documenting dead code as defensive.
**Session:** 2026-08-19 — `logs/phase-0.md`

---

### Task 0.5 — Digest model composition ✓

**Output:** `src/core/digest.ts` (`buildDigestModel`), with 37 tests.
**Key decisions:** A booking produces a block only when it has both dates, which is what makes the "no bookings but one attention item" criterion reachable — an inquiry-stage booking contributes attention items and no block. A future day never carries an outcome or summary even when a log exists for it. Filtering to active bookings is the caller's job and the doc comment says so, rather than inventing a policy the must-not-do list assigns to Phase 6. A test asserts the model's keys and that its serialization contains no markup, so rendering cannot leak in later.
**Session:** 2026-08-19 — `logs/phase-0.md`

---

### Task 0.6 — Slug generation and the demo harness ✓

**Output:** `src/core/slug.ts` (`ALPHABET`, `SLUG_LENGTH`, `RESERVED`, `generateSlug`, `isReserved`, `isBlocked`, `normalizeSlug`) with 26 tests, and `scripts/demo.ts`.
**Key decisions:** `RandomSource` is injected, making "suppose the source would produce a reserved word" a deterministic test. `normalizeSlug` does not fold `I`/`O` onto `1`/`0` — that mapping has not been adopted here and would silently merge two links. **Flagged, not resolved:** `slug.ts` imports `obscenity`, which reads against the AGENTS.md sentence limiting `src/core/` to itself and Node built-ins; the task required the check here and forbade vendoring a list, and `obscenity` performs no I/O. **Reference data correction:** the dataset stores parsed patterns, not words, so it cannot be "filtered to five-character entries" — a `RegExpMatcher` is used instead, rejecting 0.171% of random slugs.
**Session:** 2026-08-19 — `logs/phase-0.md`

---

## Phase completion checklist

- [x] All tasks above marked `[x]`
- [x] `pnpm test:unit` passes with zero failures — 206 tests, 7 files
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [x] `pnpm demo` output read by a **human** and judged correct, not merely non-throwing — read and accepted 2026-08-19.
- [x] ESLint's restricted-import rule for `src/core/` is active and demonstrably fails on a deliberate violation — proved during the scaffold session and re-proved after every config change
- [x] `SESSION_LOG.md` has a complete entry for every session in this phase
- [x] `docs/plan-summary.md` status line updated for Phase 0
- [x] `docs/user-journeys.md` reviewed per its maintenance rule — 2026-08-19, after `tasks/phase-1.md` was generated. Phase 0 enabled no journey steps. Phase 1 enables Journey 8 only, which is already described in full; no journey needed adding or extending, no deferral became testable, no step's behavior changed. The coverage table is populated per the per-task rule as Task 1.5 completes.
- [x] Phase retrospective written to `docs/phase-0-retro.md`
- [x] Housekeeping session run — 2026-08-19, `docs/META-PLAN.md` §8
- [x] `tasks/phase-1.md` generated, reviewed, and committed — 2026-08-19, `docs/META-PLAN.md` §3, a dedicated planning session that wrote the task file and no application code

*Note: `pnpm test:integration` and `pnpm test:e2e` are expected to exit cleanly with zero tests in this phase. That is a pass, not a skip.*

---

## Completed task log

Compressed entries live under **Tasks** above, in order. This section is kept
as the template for future phases.

<!--
### Task N.X — [Task name] ✓
**Output:** [One sentence: what was built.]
**Key decisions:** [Any non-obvious choices.]
**Session:** [Date / logs pointer]
-->
