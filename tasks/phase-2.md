# Phase 2 — Admin surface

> **Status:** Not started
> **Depends on:** Phase 1 complete (all tasks `[x]`, all suites passing, gate closed 2026-08-19)
> **Reference:** `docs/dev-plan.md` § Phase 2 — Admin surface; `docs/spec.md` §5.1, §5.4–§5.8

---

## A note on task count

`docs/META-PLAN.md` §3 asks for four to six tasks and says to **say so rather than compress** if a phase needs more. **This phase needs seven.**

Phase 2 is the largest in the plan. `docs/dev-plan.md` lists ten distinct deliverables, spanning six sections of the spec and three user journeys. Folding visits, pricing, and the activity log into one "booking detail" task would produce a task nobody could review and a session nobody could finish — and each of those three reads a different `src/core/` module and has its own failure modes. Seven tasks, each independently verifiable, is the honest shape.

---

## Overview

Both admins can run the business end to end from a phone. Fast capture, the booking list with both confirmation flags visible as columns, the full booking detail screen, care instruction editing with booking-level overrides, visit generation and editing, the pricing section, and the activity log with automatic system entries.

This is the phase where `src/core/` stops being a library with tests and becomes the thing the product runs on. Every calculation is already written and proved; this phase wires it to a screen.

**What this phase does not change:** no photos, no customer portal, no links or slug resolution, no calendar synchronization, no digest, no weather. Nothing under `src/core/` is modified — it is complete and is consumed, not extended.

**Explicitly deferred, and easy to pull in by mistake:** `docs/spec.md` §5.5 says that on transition to `Confirmed` the customer receives an email containing their **portal link**. Links do not exist until Phase 3. **The confirmation email is Phase 3 work**, and Task 2.4 must not send it. The state transition happens here; the notification does not.

**Done means:** an admin captures a booking on a phone in under thirty seconds, another admin opens it, the two of them set the two confirmation flags independently, and the booking becomes `Confirmed` with visits generated and a price computed — all of it attributed, and all of it visible on the list without opening anything.

---

## Reference data

Resolved during planning. No task should invent these.

### Care instruction cadence labels

The stored value is the `cadence` enum from `src/core/types.ts`. These are the words on screen, from `docs/spec.md` §5.4.

| Stored | Shown |
|---|---|
| `every_day` | `Every day` |
| `every_other_day` | `Every other day` |
| `every_third_day` | `Every third day` |
| `once_at_start` | `Once at the start` |
| `once_at_end` | `Once at the end` |
| `as_needed` | `As needed` |
| `custom` | `Custom` |

`Custom` stores free text in `cadence_custom` and does not participate in visit generation — `src/core/schedule.ts` already returns it in `skippedInstructions` with a reason. Show that reason rather than writing a second one.

### Internal status labels, admin-facing

Admins see internal status names; customers never do. `src/core/presentation.ts` maps for the customer side only, and Phase 2 has no customer surface.

| Status | Shown |
|---|---|
| `inquiry` | `Inquiry` |
| `tentative` | `Tentative` |
| `confirmed` | `Confirmed` |
| `in_progress` | `In progress` |
| `complete` | `Complete` |
| `closed` | `Closed` |
| `declined` | `Declined` |
| `cancelled` | `Cancelled` |

### Confirmation flag copy

From `docs/spec.md` §5.5. Both are plain-language and neither mentions "status".

| Element | String |
|---|---|
| First toggle label | `Customer's dates are firm` |
| Second toggle label | `Checked the family calendar` |
| Attribution format, once set | `Checked by {admin first name}, {Mon D}` — e.g. `Checked by Kate, Aug 4` |
| Booking list column headers | `Dates firm` and `Calendar checked` |

### Activity entry sources

The `activity_source` enum, with its on-screen label.

| Stored | Shown |
|---|---|
| `text_message` | `Text message` |
| `in_person` | `In person` |
| `email` | `Email` |
| `phone` | `Phone` |
| `customer_form` | `Customer form` |
| `app` | `In the app` |

The capture note in §5.1 is written with source `app` and `is_system` false. System entries are written with source `app` and `is_system` true.

### System activity entries

Written automatically. Each is one sentence, past tense, naming the acting admin. `is_system` is true so a surface can style them apart from what a human typed.

| Trigger | Entry |
|---|---|
| Booking created | `{Admin} created this booking.` |
| Dates changed | `{Admin} changed the dates to {start}–{end}.` |
| Dates firm set | `{Admin} marked the customer's dates firm.` |
| Dates firm cleared | `{Admin} cleared the dates-firm flag.` |
| Availability checked set | `{Admin} checked the family calendar.` |
| Availability checked cleared | `{Admin} cleared the calendar check.` |
| Visits regenerated | `{Admin} regenerated the visits.` |
| Marked paid | `{Admin} marked this booking paid.` |
| Declined | `{Admin} declined this booking.` |
| Cancelled | `{Admin} cancelled this booking.` |
| Count overridden | `{Admin} set the {day\|visit} count to {n}.` |

### Per-user action stamping

**Every state-changing action records the acting admin.** `docs/spec.md` §6.2 calls this the accountability mechanism that replaces permissions, and there is no role model to fall back on.

The acting admin comes from `requireAdmin()` in `src/app/(admin)/layout.tsx`. Columns already exist: `bookings.created_by`, `dates_firm_by`, `availability_checked_by`, `declined_by`, `cancelled_by`, `visit_logs.created_by`, `photos.created_by`, `activity_entries.actor_id`.

This is a criterion on **every** task below that writes, not a task of its own.

### The thirty-second target

`docs/spec.md` §5.1: an admin who has used the app before completes fast capture in under thirty seconds — a new customer name, a date range, and a one-line note.

Measured **on a real phone, by hand, with a stopwatch**, at the phase review gate. Not assertable by a test. `docs/META-PLAN.md` §6 calls it the single most important measurement in the project, and a miss is a **product finding**: the fix belongs in `docs/spec.md` §5.1 before it belongs in code.

---

## Tasks

### Task 2.1 — Admin shell, home, and the booking list

> **Status:** `[x]` Complete
> **Session:** 2026-08-19 — see `SESSION_LOG.md`
> **Depends on:** none

**What this task implements:**
The navigation shell every admin screen sits in, the home screen, and the booking list with both confirmation flags as columns. After this task an admin can see the state of the business without opening anything.

**Files to create or modify:**
- `src/app/(admin)/layout.tsx` — extend the existing guard with navigation and a persistent "New booking" action
- `src/app/(admin)/home/page.tsx` — replace the Phase 1 stub: today's visits, needs-attention, filtered by the acting admin
- `src/app/(admin)/bookings/page.tsx` — the list, filterable
- `src/components/` — status chip, flag indicator, and whatever the list rows need
- `src/db/repositories/bookings.ts` — add the list read this screen needs
- `e2e/journey-1.spec.ts` — steps 1.1.1 and 1.3.2

**Journey steps enabled:** 1.1.1, 1.3.2.

**Acceptance criteria:**
- [x] The booking list shows, per booking: customer name, property nickname, service range, status, and **both confirmation flags as separate columns**
- [x] An admin can tell from the list alone which of the two flags is missing, without opening the booking (spec §5.5)
- [x] Status is read from `deriveStatus` — `grep` finds no second status computation anywhere in `src/app/`
- [x] Status labels match the Reference data table exactly
- [x] The list is filterable by status, and the filter survives a page reload
- [x] `/home` shows today's visits and a needs-attention list
- [x] `/home` renders correctly against the seeded database, whose three bookings are `confirmed`, `tentative`, and `inquiry`
- [x] Every screen is usable one-handed on a 390px-wide viewport with no horizontal scrolling
- [x] A "New booking" action is reachable from the home screen without scrolling
- [x] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [x] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [x] `docs/user-journeys.md` coverage table updated
- [x] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- Does not build the capture form — that is Task 2.2
- Does not build the booking detail screen — that is Task 2.3
- Does not compute status inline anywhere; `deriveStatus` is the only source
- Does not add a `status` column, an enum default, or a cached status field, for query performance or any other reason

---

### Task 2.2 — Fast capture

> **Status:** `[x]` Complete
> **Session:** 2026-08-19 — see `SESSION_LOG.md`
> **Depends on:** Task 2.1

**What this task implements:**
The capture screen and `createBooking`. This is the task the product's central premise rests on, and the one measured against the thirty-second target.

**Files to create or modify:**
- `src/app/(admin)/bookings/new/page.tsx` — the capture form
- `src/app/(admin)/actions/bookings.ts` — `createBooking`
- `src/services/bookings.ts` — creation, including customer and property when they do not exist
- `src/db/repositories/customers.ts`, `properties.ts` — search reads the combobox needs
- `src/services/bookings.test.ts`
- `e2e/journey-1.spec.ts` — steps 1.1.2 through 1.1.7

**Journey steps enabled:** 1.1.2, 1.1.3, 1.1.4, 1.1.5, 1.1.6, 1.1.7.

**Acceptance criteria:**
- [x] The customer field is focused on load (step 1.1.2)
- [x] Typing a name matching no existing customer offers to create one; selecting it creates a customer with a name and nothing else, and that record is valid in that state
- [x] A customer with exactly one property has it auto-selected; a customer with more gets a list plus "New property"
- [x] **The only required field is a customer name.** Saving with everything else empty succeeds
- [x] Saving with no dates produces a booking deriving `inquiry`; saving with dates produces one deriving `tentative`
- [x] Entering both dates turns "Dates are approximate" on automatically (step 1.1.5)
- [x] An end date preceding the start date is rejected before the write, with a message naming the problem
- [x] The note is written to the activity log as the **first** entry, source `app`, `is_system` false
- [x] A `{Admin} created this booking.` system entry is written, attributed to the acting admin
- [x] `bookings.created_by` is set to the acting admin
- [x] Save returns to the booking detail screen (step 1.1.7)
- [x] The whole form is reachable and completable one-handed at 390px wide
- [x] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [x] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [x] `docs/user-journeys.md` coverage table updated
- [x] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- Does not require a property, a date, or a note; a customer name is the only required field
- Does not geocode the address — that is Phase 6 weather work
- Does not create a link or send any email
- Does not optimize the round trip in place of reducing fields and taps; if the target is missed, that is a product finding for `docs/spec.md` §5.1

---

### Task 2.3 — Booking detail: header, dates, and care instructions

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Task 2.2

**What this task implements:**
The booking detail screen's first three sections, and care instruction editing including booking-level overrides.

**Files to create or modify:**
- `src/app/(admin)/bookings/[id]/page.tsx` — header, dates, care instructions
- `src/app/(admin)/actions/bookings.ts` — `updateBookingDates`
- `src/app/(admin)/actions/care-instructions.ts` — `upsertCareInstruction`, `deleteCareInstruction`
- `src/services/bookings.ts` — date changes with activity entries
- `e2e/journey-1.spec.ts` — steps 1.2.1 through 1.2.5

**Journey steps enabled:** 1.2.1, 1.2.2, 1.2.3, 1.2.4, 1.2.5.

**Acceptance criteria:**
- [ ] The header shows customer name, property nickname, service range, status chip, and both flag indicators (spec §5.4)
- [ ] An instruction added from the booking attaches to the **property** by default (step 1.2.2)
- [ ] The "This booking only" toggle makes it a booking-level override instead, and the property's own instruction is left untouched
- [ ] A booking-level override **shadows** the property instruction of the same label rather than appearing alongside it
- [ ] Cadence options render the Reference data labels exactly, and `Custom` stores free text in `cadence_custom`
- [ ] `weatherRelevant` is settable and persists (step 1.2.3)
- [ ] The property address is editable from the booking and persists (step 1.2.4)
- [ ] **The access code field is visibly labelled admin-only on screen** (step 1.2.5)
- [ ] Changing dates writes a `{Admin} changed the dates to {start}–{end}.` system entry
- [ ] An end date preceding the start date is rejected, and the database check constraint is never the thing that reports it to a user
- [ ] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] `docs/user-journeys.md` coverage table updated
- [ ] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- Does not build the confirmation toggles — that is Task 2.4
- Does not build visits, pricing, or activity sections — those are Tasks 2.5, 2.6, 2.7
- Does not regenerate visits on a date change; that is Task 2.5's explicit action
- Does not display access codes on anything but an admin screen

---

### Task 2.4 — The two confirmation actions

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Task 2.3

**What this task implements:**
The two independent confirmation toggles, their attribution, and the transition to `Confirmed`. **This is the task carrying the open question in `docs/spec.md` §10.**

**Files to create or modify:**
- `src/app/(admin)/bookings/[id]/page.tsx` — the confirmation section
- `src/app/(admin)/actions/bookings.ts` — `setDatesFirm`, `setAvailabilityChecked`, `declineBooking`, `cancelBooking`, `markPaid`
- `src/services/bookings.ts` — transitions with activity entries
- `e2e/journey-1.spec.ts` — steps 1.3.1 through 1.3.5

**Journey steps enabled:** 1.3.1, 1.3.2, 1.3.3, 1.3.4, 1.3.5.

**Acceptance criteria:**
- [ ] Both toggles use the Reference data labels exactly, and neither mentions "status"
- [ ] The two toggles are **visually and physically separated** on screen (spec §5.5)
- [ ] **"Checked the family calendar" is its own submission.** Toggling it cannot be batched with any other change, and a test proves a combined save is not possible
- [ ] Setting either flag records the acting admin and a timestamp; unsetting clears both and writes an activity entry
- [ ] Each flag displays its actor and date once set, in the format `Checked by Kate, Aug 4`
- [ ] **Any admin may set or unset either flag** — there is no role restriction, and a test has a second admin toggle the flag the first did not (steps 1.3.3, 1.3.4)
- [ ] A booking derives `Confirmed` only when both flags are set **and** the range has both dates
- [ ] Setting only one flag leaves the booking `Tentative`, and the list shows one set and one unset (step 1.3.2)
- [ ] `declineBooking` and `cancelBooking` are terminal, and `deriveStatus` reports them ahead of everything else
- [ ] `markPaid` records a paid date and method note, and a booking past its end date with a paid date derives `closed`
- [ ] Every transition writes its Reference data system entry, attributed
- [ ] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] `docs/user-journeys.md` coverage table updated
- [ ] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- **Does not relax the isolated-submission rule, and does not resolve the §10 open question.** Build it exactly as specified. If the friction is real, record the observation in `SESSION_LOG.md` and leave the behaviour alone — the human decides at the phase gate
- **Does not send the confirmation email.** Spec §5.5 describes one carrying a portal link; links are Phase 3 and so is that email
- Does not generate visits or snapshot pricing here — Tasks 2.5 and 2.6 own those, and this task's transition is what triggers them
- Does not add a role model or restrict either flag to a particular admin

---

### Task 2.5 — Visits: generation and editing

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Task 2.4

**What this task implements:**
Visit generation on confirmation, the visit list, and individual visit editing — including the preservation rules that Phase 0 deliberately left to the service layer.

**Files to create or modify:**
- `src/app/(admin)/bookings/[id]/page.tsx` — the visits section
- `src/app/(admin)/actions/visits.ts` — `regenerateVisits`, `upsertVisit`, `deleteVisit`
- `src/services/visits.ts` — generation, regeneration, and preservation
- `src/services/visits.test.ts`
- `e2e/journey-1.spec.ts` — step 1.3.6; `e2e/journey-4.spec.ts` — steps 4.3.1 through 4.3.4

**Journey steps enabled:** 1.3.6, 4.3.1, 4.3.2, 4.3.3, 4.3.4.

**Acceptance criteria:**
- [ ] Visits are generated on transition to `Confirmed`, using `generateVisits` from `src/core/schedule.ts` — no second scheduling implementation exists
- [ ] A date carrying two instructions produces **one** visit with both tasks (step 1.3.6)
- [ ] Generated visits default to time window `anytime`
- [ ] Instructions returned in `skippedInstructions` are surfaced with the reason `src/core/schedule.ts` already provides
- [ ] An admin can add a visit on a date not generated (step 4.3.1)
- [ ] Deleting an upcoming visit with no log requires no confirmation (step 4.3.2)
- [ ] Deleting a visit **that has a log** requires an explicit confirmation first (step 4.3.3)
- [ ] **Regeneration preserves logged visits**, and the warning names them before proceeding (step 4.3.4)
- [ ] Regeneration is an explicit action, never a side effect of editing dates
- [ ] Every visit write records the acting admin
- [ ] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] `docs/user-journeys.md` coverage table updated
- [ ] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- Does not reimplement cadence expansion; `src/core/schedule.ts` is the only scheduler
- Does not implement visit **logging** — outcome, note, photos are Phase 4
- Does not silently drop a logged visit under any circumstance
- Does not regenerate as a side effect of a date change

---

### Task 2.6 — Pricing

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Task 2.5

**What this task implements:**
The pricing section, reading `src/core/pricing.ts`, with component overrides, ad-hoc line items, count overrides, and the snapshot taken on confirmation.

**Files to create or modify:**
- `src/app/(admin)/bookings/[id]/page.tsx` — the pricing section
- `src/app/(admin)/actions/pricing.ts` — `upsertPricingComponent`, `deletePricingComponent`, `addAdhocLineItem`, `deleteAdhocLineItem`, `overrideCounts`
- `src/app/(admin)/settings/page.tsx` — business default pricing components
- `src/services/bookings.ts` — the pricing snapshot on confirmation
- `e2e/journey-9.spec.ts` — steps 9.1.1 through 9.1.7

**Journey steps enabled:** 9.1.1, 9.1.2, 9.1.3, 9.1.4, 9.1.5, 9.1.6, 9.1.7.

**Acceptance criteria:**
- [ ] Line items come from `priceBooking` in `src/core/pricing.ts` — no second pricing implementation exists
- [ ] A confirmed booking shows the **snapshotted** components with computed day and visit counts (step 9.1.1)
- [ ] **Raising the business default rate does not change a confirmed booking's total** (step 9.1.6) — this is what the snapshot is for
- [ ] Overriding the day count downward recalculates the total **without changing the dates** (step 9.1.2)
- [ ] An ad-hoc item with a positive amount raises the total; one with a negative amount lowers it (steps 9.1.3, 9.1.4)
- [ ] "Copy summary" places a plain-text itemized summary on the clipboard (step 9.1.5)
- [ ] Marking paid with a method note produces a status reading `Closed` once the range is past (step 9.1.7)
- [ ] Every displayed amount is formatted from integer cents at the point of display; **no currency value is held as a float anywhere**
- [ ] A count override writes its Reference data system entry, attributed
- [ ] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] `docs/user-journeys.md` coverage table updated
- [ ] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- Does not reimplement pricing arithmetic; `src/core/pricing.ts` is the only engine
- Does not store a computed total as a column; the snapshot is of the **components**, not the answer
- Does not perform arithmetic on a dollar value; formatting happens only at display
- Does not build an invoice, a payment flow, or a receipt

---

### Task 2.7 — Activity log

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Task 2.6

**What this task implements:**
The activity log — manual out-of-band entries and the automatic system entries every earlier task has been writing. Last because it is where their attribution is verified in one place.

**Files to create or modify:**
- `src/app/(admin)/bookings/[id]/page.tsx` — the activity section
- `src/app/(admin)/actions/activity.ts` — `addActivityEntry`
- `src/app/(admin)/customers/page.tsx`, `customers/[id]/page.tsx` — customer screens with their activity
- `src/services/bookings.ts` — confirm every transition writes its entry
- `e2e/journey-1.spec.ts` — step 1.2.6

**Journey steps enabled:** 1.2.6.

**Acceptance criteria:**
- [ ] A manual entry records a note, a source from the Reference data list, and a date (step 1.2.6)
- [ ] Source labels render exactly as the Reference data table gives them
- [ ] An entry dated in the past sorts by its **entry date**, not its creation time
- [ ] System entries are marked `is_system` true and are visually distinguishable from typed ones
- [ ] **Every system entry in the Reference data table has a test asserting its exact text**, for a transition that produces it
- [ ] Every entry, manual or system, records `actor_id`
- [ ] **A full audit: every state-changing action in `src/app/(admin)/actions/` records the acting admin.** Enumerate them and assert it, rather than sampling
- [ ] The customer detail screen shows that customer's activity, and no other customer's
- [ ] **Activity entries appear on no customer-facing surface** — there is none in this phase, and `src/db/repositories/activity.ts` still has no customer-facing read
- [ ] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] `docs/user-journeys.md` coverage table updated
- [ ] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- Does not add a customer-facing read to `src/db/repositories/activity.ts`
- Does not let a system entry be edited or deleted by a human
- Does not build the customer portal — Phase 3

---

## Phase completion checklist

- [ ] All tasks above marked `[x]`
- [ ] `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e` all pass with zero failures
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] **Review gate, by hand — TIME THE CAPTURE FLOW ON A REAL PHONE against the thirty second target.** `docs/META-PLAN.md` §6 calls this the single most important measurement in the project. A miss is a product finding, not a performance bug: do not optimize the round trip and call it fixed. The likely cause is too many fields or too many taps, and the fix belongs in `docs/spec.md` §5.1 first
- [ ] **Review gate, by hand — EVALUATE THE `docs/spec.md` §10 OPEN QUESTION** about the isolated availability-check submission. There is live use now. Does an admin have to submit twice for a single mental action? Would relaxing it make availability checking feel incidental? **Record the decision in the spec rather than leaving it open**
- [ ] **Review gate:** are route handlers and server actions thin — no inline SQL, no business logic belonging in `src/services/`?
- [ ] **Review gate:** does every surface read status from `deriveStatus`, or does any compute it inline? Grep
- [ ] **Review gate:** is the acting admin recorded on every state change, price override and date edit included?
- [ ] `SESSION_LOG.md` has a **session entry for every session in this phase, written at the end of that session** — not reconstructed afterwards. This was missed in Phase 1 and is recorded in `AGENTS.md` Patterns established
- [ ] `docs/plan-summary.md` status line updated for Phase 2
- [ ] `docs/user-journeys.md` reviewed, coverage table updated, deferrals revisited
- [ ] Phase retrospective written to `docs/phase-2-retro.md`
- [ ] Housekeeping session run
- [ ] `tasks/phase-3.md` generated, reviewed, and committed

---

## Completed task log

*(Tasks are compressed to this format once complete. Full details live in the session log.)*

<!--
### Task 2.X — [Task name] ✓
**Output:** [One sentence: what was built.]
**Key decisions:** [Any non-obvious choices.]
**Session:** [Date / logs pointer]
-->
