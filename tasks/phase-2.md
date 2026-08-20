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

## Tasks — all complete, compressed at the Phase 2 housekeeping session

Full bodies, acceptance criteria, and must-not-do lists are in the git history at commit `d76a6f4` and earlier. Session detail is in `logs/phase-2.md`.

### Task 2.1 — Admin shell, home, and the booking list ✓

**Output:** the admin shell with navigation, `/home` (today + needs attention), `/bookings` (filterable, both confirmation flags as columns), `/customers`, and the shared `StatusChip`, `FlagIndicator`, and formatters.
**Key decisions:** Needs-attention reuses `buildDigestModel` so the screen and the morning email cannot disagree. `StatusChip` takes a status, not a booking, so it cannot compute one. `formatCalendarDate` formats from the string's parts, never through a `Date`. **Three toolchain problems:** the unit glob covered only `src/core/` so a new component test silently ran zero tests; Playwright's `reuseExistingServer` adopted the developer's dev server on the wrong branch; and Next 16 permits one dev server per directory, so e2e moved to a production build on :3100.
**Session:** 2026-08-19 — `logs/phase-2.md`

---

### Task 2.2 — Fast capture ✓

**Output:** `/bookings/new`, `captureBooking`, and a partial `/bookings/[id]` — enough for step 1.1.7 to assert.
**Key decisions:** The only required field is a customer name. Validation runs in the service and returns a sentence; the `range_ordered` constraint is a backstop a user must never meet. The note is written before the system entry so it is genuinely first in the log. Spec §5.1's `admin capture` source has no enum value — Reference data resolved it to `app`. A new customer's property is nicknamed `Home`. **Two bugs of mine:** querying properties with a not-yet-created customer's empty id, and a hidden field rendered inside the wrong branch so the form submitted neither an id nor a name.
**Session:** 2026-08-19 — `logs/phase-2.md`

---

### Task 2.3 — Booking detail: header, dates, and care instructions ✓

**Output:** the dates section, care instructions with booking-level overrides, and property details including the admin-only access fields.
**Key decisions:** A booking-level override **shadows** the property instruction of the same label rather than appearing beside it, matched trimmed and case-insensitively. Ownership is not editable in place. A date change does **not** regenerate visits. No system entry is written when nothing changed. **I broke an architectural rule and fixed it in-session:** the service called `db().update()` directly, caught by running the phase gate's grep during the task — which is now the habit.
**Session:** 2026-08-19 — `logs/phase-2.md`

---

### Task 2.4 — The two confirmation actions ✓

**Output:** the two isolated toggles, terminal transitions, payment, and `TRANSITION_ENTRIES`.
**Key decisions:** The §10 isolation is enforced by a **signature** — `setAvailabilityChecked` takes a booking and a boolean, so a combined save is structurally impossible. Unsetting clears both instant and actor. A no-op toggle writes nothing. **No confirmation email is sent**, and an e2e test asserts zero `email_sends` rows, so it cannot be added by accident before Phase 3.
**Session:** 2026-08-19 — `logs/phase-2.md`

---

### Task 2.5 — Visits: generation and editing ✓

**Output:** generation on confirmation, regeneration with preservation, and individual visit editing.
**Key decisions:** Generation keys off the resulting derived status, not which flag was toggled, and no-ops when a schedule already exists. `planRegeneration` is separate from applying it so the warning can name the logged visits truthfully. Logged visits are preserved unconditionally. **A `'use server'` file may export only async functions** — one exported constant broke the whole detail page and failed thirteen specs in another journey.
**Session:** 2026-08-19 — `logs/phase-2.md`

---

### Task 2.6 — Pricing ✓

**Output:** the pricing section, count overrides, ad-hoc items, `/settings` defaults, and the confirmation snapshot.
**Key decisions:** The snapshot copies **components, not a total** — storing a total would satisfy 9.1.6 and break recalculation when a visit is added. Dollars are parsed from the string, never by multiplying a float. `summaryText` lives in the service so it is testable without a browser. **A confirmation assertion turned flaky** once confirming also generated visits and snapshotted pricing: a slow write and a wrong write look identical in a test report.
**Session:** 2026-08-19 — `logs/phase-2.md`

---

### Task 2.7 — Activity log ✓

**Output:** manual entries, customer detail screens, and `src/services/attribution.test.ts`.
**Key decisions:** The attribution audit **enumerates every exported action** across all seven modules rather than sampling, with a documented allowlist for the two reads. A second test produces all eleven Reference data system entries in one booking's lifetime and asserts each exact string. `entryDate` is when something happened, not when it was typed. **A flaky test was pointing at real waste:** `regenerateVisitsForBooking` repeated three round trips `planRegeneration` had already made.
**Session:** 2026-08-19 — `logs/phase-2.md`

---

## Phase completion checklist

- [x] All tasks above marked `[x]`
- [x] `pnpm test:unit` (220), `pnpm test:integration` (190), `pnpm test:e2e` (77) all pass with zero failures
- [x] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] **Review gate, by hand — TIME THE CAPTURE FLOW ON A REAL PHONE against the thirty second target.** **STILL OUTSTANDING.** `docs/META-PLAN.md` §6 calls this the single most important measurement in the project. A miss is a product finding, not a performance bug: do not optimize the round trip and call it fixed. The likely cause is too many fields or too many taps, and the fix belongs in `docs/spec.md` §5.1 first
- [x] **Review gate — the `docs/spec.md` §10 open question was EVALUATED AND SETTLED on 2026-08-20: the rule stands as written.** Recorded in `docs/spec.md` §10, and the "Under review" note in §5.5 replaced.
- [x] **Review gate:** route handlers and server actions are thin — `src/services/attribution.test.ts` asserts no action file imports `drizzle-orm` or calls `db()`.
- [x] **Review gate:** every surface reads status from `deriveStatus` — grepped; no status literal appears in any `.tsx` outside a `data-status` attribute.
- [x] **Review gate:** the acting admin is recorded on every state change — `src/services/attribution.test.ts` enumerates every exported action across all seven modules and asserts each calls `actingAdmin()`, with a documented allowlist for the two reads.
- [x] `SESSION_LOG.md` has a session entry for every session in this phase, written at the end of that session — all seven, unlike Phase 1
- [x] `docs/plan-summary.md` status line updated for Phase 2
- [x] `docs/user-journeys.md` reviewed, coverage table updated
- [x] Phase retrospective written to `docs/phase-2-retro.md`
- [x] Housekeeping session run — 2026-08-20
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
