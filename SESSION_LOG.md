# Session Log — sittter

## Current State

**Phase:** 2 — Admin surface — In progress, 5 of 7 tasks complete
**Next task:** 2.6 — Pricing

**What's built in Phase 2:** the admin shell, `/home`, `/bookings`, `/customers`, `/bookings/new`, and `/bookings/[id]` with header, confirmation, dates, care instructions, visits, property details, payment, terminal actions, and a read-only activity list.

**Tests:** 220 unit, 168 integration, 62 end-to-end.

**What Task 2.6 must know:**
- **The pricing snapshot is taken on transition to `Confirmed`,** alongside visit generation. `generateVisitsOnConfirmation` in `src/services/visits.ts` is the model: it keys off the RESULTING derived status rather than off which flag was toggled, because either confirmation action can complete it, and it no-ops when a schedule already exists so a flag toggled off and on does not rebuild something edited by hand.
- Both confirmation actions in `src/app/(admin)/actions/confirmation.ts` already call that hook; the pricing snapshot goes beside it.
- `priceBooking` in `src/core/pricing.ts` is the only engine. `listDefaultPricingComponents` and `listPricingComponentsForBooking` already exist, and a component with a null `bookingId` is a business default while one carrying a `bookingId` is a snapshot.
- `formatCents` in `src/components/format.ts` formats integer cents with integer arithmetic. **9.1.6 is the criterion that matters most:** raising the business default must not change a confirmed booking's total, which is what the snapshot is for.

**A schema fact worth knowing:** `visits` has no `created_by` column in `docs/dev-plan.md` §5, unlike `bookings`, `visit_logs`, and `photos`. Visit writes are attributed through the activity log rather than on the row. Adding a column would be a schema change the plan does not call for — recorded rather than done.

**A GAP FOR THE HUMAN — `/home` "filtered by the acting admin".** Unchanged.

**The §10 open question is live and evaluable.** See the Task 2.4 entry in `logs/` or the observation recorded there.

**Database:** one Neon project, two branches. `main` (`.env`, seeded); `test` (`.env.test`). Playwright runs a production build on **:3100** with `workers: 1`.

**Two Phase 2 review gates that are not code:** the **thirty-second capture measurement on a real phone**, and the **`docs/spec.md` §10 evaluation** — both performable now.

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11 on Vite 8.2.1, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2, Neon Postgres.

**Open questions in the spec:** the three deferred items in `docs/spec.md` §10 remain open and are not to be resolved during implementation.

---

## Session entries

## 2026-08-19 — Task 2.5: Visits — generation and editing

**What was done:**
- `src/services/visits.ts` — `planRegeneration`, `regenerateVisitsForBooking`, `generateVisitsOnConfirmation`, `addVisit`, `editVisit`, `removeVisit`
- `src/app/(admin)/actions/visits.ts`, `src/components/VisitsSection.tsx`, `src/components/visit-state.ts`
- `src/db/repositories/visits.ts` — `updateVisit`
- `src/services/visits.test.ts` — 14 tests; `e2e/journey-4.spec.ts` — 8 specs

**A runtime rule I broke, and why it was expensive to diagnose.**

`src/app/(admin)/actions/visits.ts` exported `EMPTY_VISIT_STATE`, a plain object, from a `'use server'` file. **A `'use server'` file may export only async functions.** It builds, it typechecks, and it fails at runtime — taking down every module that imports it. The booking detail page broke entirely, so **thirteen specs across a different journey** failed with "expected 1, received 0" for elements whose absence had nothing to do with them. The actual message, `A "use server" file can only export async functions, found object`, appeared only in the web server log, not in any test output.

Recorded in AGENTS.md Patterns established, with the audit command. `export interface` and `export type` are fine — they are erased before the rule applies.

**Decisions made:**

- **Generation keys off the resulting derived status, not off which flag was toggled.** Either confirmation action can be the one that completes it, so both call the same hook and the hook asks `deriveStatus` what happened.
- **Generation no-ops when a schedule already exists.** A flag toggled off and on again must not rebuild a schedule someone has since edited by hand. Tested with a hand-added visit surviving that round trip.
- **`planRegeneration` is separate from applying it.** Journey step 4.3.4 requires a warning that NAMES the logged visits at stake; computing the plan first is what makes that warning truthful rather than a guess.
- **Logged visits are preserved unconditionally.** A visit someone has written up records what actually happened, and a cadence change must not be able to erase it. Unlogged visits the cadences no longer produce are removed.
- **Deleting a logged visit requires an explicit second confirmation; an unlogged one does not.** Steps 4.3.2 and 4.3.3, enforced in the service rather than only in the UI.
- **Skipped instructions surface the reason `src/core/schedule.ts` already gives**, rather than a second explanation written here.

**Not done:**
- **No visit logging** — outcome, note, and photos are Phase 4. `hasLog` is read to decide whether deleting needs a confirmation, and nothing writes one.
- **No pricing snapshot on confirmation** — Task 2.6 adds it beside visit generation.
- **No `created_by` column added to `visits`.** The plan's schema does not have one; attribution is through the activity log.

**Verification:**

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 220 tests |
| `pnpm test:integration` | PASS — 168 tests |
| `pnpm test:e2e` | PASS — 62 tests |
| `pnpm build` / `typecheck` / `lint` / `prettier` | PASS |
| Drizzle query builder outside `src/db/` | none |
| Second scheduler anywhere | none — `src/core/schedule.ts` only |

---

## 2026-08-19 — Task 2.4: The two confirmation actions

**What was done:**
- `src/services/bookings.ts` — `setDatesFirm`, `setAvailabilityChecked`, `declineBooking`, `cancelBooking`, `markPaid`, and `TRANSITION_ENTRIES`
- `src/app/(admin)/actions/confirmation.ts`
- `src/components/ConfirmationSection.tsx` — the two toggles, payment, terminal actions
- `src/services/confirmation.test.ts` — 15 tests; 10 more e2e specs; `switchAdmin` and `countEmailSends` fixtures

**The §10 rule, built as specified and not relaxed.**

`docs/spec.md` §5.5 requires that toggling "Checked the family calendar" is its own submission and is never combined with another change. That is enforced by a **signature**, not by discipline: `setAvailabilityChecked` takes a business, an admin, a booking, a boolean, and two instants. There is no argument through which a date change or an instruction edit could ride along, so a combined save is structurally impossible. The two controls are separate `<form>` elements with a visible separator between them, and an e2e test asserts the availability form's only fields are `bookingId` and `value`.

**Decisions made:**

- **Unsetting a flag clears both the instant and the actor.** A flag that remembered who set it after being cleared would attribute a state nobody is in.
- **A no-op toggle writes nothing.** Setting a flag that is already set returns early rather than writing a duplicate activity entry.
- **`TRANSITION_ENTRIES` holds the exact system entry text in one place** rather than at each call site, so the remaining tasks cannot each invent their own phrasing.
- **`paidAt` is written as a calendar date**, not an instant — the day payment was received is what someone reconciling a bank statement is looking for.
- **No confirmation email is sent.** §5.5 describes one carrying a portal link; links are Phase 3. There is an e2e test asserting that confirming a booking writes **zero** `email_sends` rows, so this cannot be added by accident later without going red.

**A test that was racing rather than failing.** The mark-paid spec reloaded the page immediately after clicking, which raced the server action — the form came back with old values for a reason unrelated to persistence. Fixed by waiting for the activity entry to appear before reloading. Worth recording because the symptom looks exactly like a write that did not happen.

**Not done:**
- **No visit generation and no pricing snapshot on confirmation** — Tasks 2.5 and 2.6 own those, and this task's transition is what will trigger them.
- **No manual activity entry** — Task 2.7.
- **The §10 question was not resolved.** An observation for the human is recorded in Current State.

**Verification:**

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 220 tests |
| `pnpm test:integration` | PASS — 154 tests |
| `pnpm test:e2e` | PASS — 54 tests |
| `pnpm build` | PASS |
| `pnpm typecheck` / `pnpm lint` / `prettier --check` | PASS |
| Drizzle query builder outside `src/db/` | none |
| `sendEmail` anywhere in Phase 2 | none |

---

## 2026-08-19 — Task 2.3: Booking detail — header, dates, and care instructions

**What was done:**
- `src/services/care-instructions.ts` — `resolveEffectiveInstructions`, upsert, delete
- `src/services/bookings.ts` — `changeBookingDates`, `updatePropertyDetails`
- `src/db/repositories/care-instructions.ts` — `updateCareInstruction`
- `src/app/(admin)/actions/care-instructions.ts`, and date and property actions
- `src/components/BookingSections.tsx`, `src/components/cadence.ts`
- `src/services/care-instructions.test.ts` (12), `src/services/dates.test.ts` (8), 12 more e2e specs

**An architectural rule I broke and fixed within the session.**

The first version of `src/services/care-instructions.ts` called `db().update(careInstructions)` directly, to update an instruction in place. AGENTS.md is explicit: there is no SQL and no Drizzle query builder call outside `src/db/repositories/`. It typechecked, it would have worked, and it would have been the first crack in the boundary that Phase 1 spent a whole task establishing. Caught by running the grep that the phase review gate asks for, rather than by noticing while writing it. `updateCareInstruction` now exists on the repository and the service calls it. **The lesson is that the gate greps are worth running per task, not per phase.**

**Decisions made:**

- **A booking-level override shadows the property instruction of the same label rather than appearing beside it.** Otherwise a sitter reads two conflicting rules for one task and has to guess. Matching is trimmed and case-insensitive, because "Cats" and "cats " are the same instruction to everyone except a string comparison.
- **Ownership is not editable in place.** An instruction cannot be moved between a property and a booking by updating it, because that silently turns a standing arrangement into a one-off or the reverse. Toggling "This booking only" writes a new record, which is visible.
- **A date change does NOT regenerate visits.** `docs/dev-plan.md` §7.3 makes `regenerateVisits` its own action, and Task 2.5 builds it that way. A date change silently rebuilding a schedule could discard logged visits without anyone choosing to.
- **No system entry is written when the dates did not actually change.** Saving the form unchanged should not fill the activity log with noise. Tested.
- **The admin-only fields sit inside a labelled `fieldset`, not merely near a note.** Journey step 1.2.5 asks for the field to be visibly labelled admin-only; the label is how an admin knows a garage code is safe to type there.
- **`resolveEffectiveInstructions` lives in the service layer, not `src/core/`,** because this phase does not modify `src/core/`. It is pure, so moving it later costs nothing. Recorded as a judgement call rather than a conclusion.

**Not done:**
- **The confirmation toggles** — Task 2.4, which also carries the §10 open question.
- **Visits, pricing, manual activity entry** — Tasks 2.5, 2.6, 2.7.
- **No visit regeneration on a date change**, deliberately.
- **No customer-facing read of access codes or notes** exists anywhere; the repository functions that serve customer surfaces still name their columns.

**Verification:**

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 220 tests |
| `pnpm test:integration` | PASS — 139 tests |
| `pnpm test:e2e` | PASS — 44 tests |
| `pnpm build` | PASS |
| `pnpm typecheck` | PASS — zero errors |
| `pnpm lint` | PASS — zero errors |
| `prettier --check .` | PASS |
| Drizzle query builder outside `src/db/` | none |

---

## 2026-08-19 — Task 2.2: Fast capture

**What was done:**
- `src/services/bookings.ts` — `captureBooking`, `validateCapture`, `CaptureError`
- `src/app/(admin)/actions/bookings.ts` — `createBooking`, `loadPropertiesForCustomer`
- `src/components/CaptureForm.tsx` — the client form
- `src/app/(admin)/bookings/new/page.tsx`, and a partial `src/app/(admin)/bookings/[id]/page.tsx`
- `src/components/activity.ts`, `ActivitySource` in `src/core/types.ts`
- `src/services/bookings.test.ts` — 19 tests; `e2e/journey-1.spec.ts` — 10 more specs

**Decisions made:**

- **Validation happens in the service and returns a sentence, not an exception.** The `range_ordered` check constraint exists in the database, but a constraint violation is not an error message — a user must never be the one who discovers it. `validateCapture` runs before anything is written, and a test asserts that a rejected capture leaves no customer, property, or booking behind.
- **The note is written before the system entry**, so it is genuinely first in the log's history. `docs/spec.md` §5.1 says the note is the first entry, even though "created this booking" is what logically happened first. The test asserts the ordering by `created_at` rather than by position in a query result.
- **A server action needs its own admin resolution.** `requireAdmin()` redirects, which is right for a page and wrong for an action. `actingAdmin()` does the same lookup with action semantics.
- **The capture form is a client component and the rest of the surface is not.** Three behaviours require it — focus on load, offering to create an unmatched name, and turning "approximate" on when dates are entered — and each exists to serve the thirty-second target rather than to be interactive for its own sake.
- **`DEFAULT_PROPERTY_NICKNAME` is `'Home'`.** `properties.nickname` is NOT NULL and nothing specifies what a captured property should be called. Recorded rather than left implicit.

**A reference-data mismatch resolved during planning, and worth repeating:** `docs/spec.md` §5.1 says the note carries source `admin capture`. The `activity_source` enum has no such value. The Reference data in `tasks/phase-2.md` resolved it to `app`, which is what was built — this is exactly the kind of thing Reference data exists to settle before a task has to invent it.

**Two bugs of my own, both found by tests rather than by reading:**

1. **`loadPropertiesForCustomer` was called with an empty id.** A customer chosen via "create new" has no id yet, and querying for one sent `''` where a uuid was expected. It surfaced as an opaque failed-query log line, not as a validation error.
2. **The hidden `newCustomerName` input was rendered inside the "no customer chosen" branch.** The moment "create new" was tapped, the field vanished — so the form submitted neither an id nor a name, and the server correctly reported that a customer name was required for a form that plainly had one. Both hidden fields now live outside the branch, with a comment saying why.

**Not done:**
- **The dates section and care instructions** — Task 2.3, which extends `/bookings/[id]` rather than creating it.
- **Confirmation toggles, visits, pricing, manual activity entry** — Tasks 2.4 through 2.7.
- **No geocoding**, no link, no email.
- **The thirty-second target has not been measured.** It is a hand measurement on a real phone at the phase gate; the surface it measures now exists.

**Verification:**

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 220 tests |
| `pnpm test:integration` | PASS — 119 tests |
| `pnpm test:e2e` | PASS — 32 tests |
| `pnpm build` | PASS |
| `pnpm typecheck` | PASS — zero errors |
| `pnpm lint` | PASS — zero errors |
| `prettier --check .` | PASS |

---

## 2026-08-19 — Task 2.1: Admin shell, home, and the booking list

**What was done:**
- `src/app/(admin)/layout.tsx` — navigation, the acting admin, and the persistent "New booking" action
- `src/app/(admin)/home/page.tsx` — today and needs-attention, replacing the Phase 1 stub
- `src/app/(admin)/bookings/page.tsx` — the filterable list with both flags as columns
- `src/app/(admin)/customers/page.tsx` — the customer list
- `src/services/home.ts` — home model assembly
- `src/components/` — `StatusChip`, `FlagIndicator`, `status.ts`, `format.ts`, `format.test.ts`
- Repository reads for lists and bulk loads
- `e2e/journey-1.spec.ts` — 11 specs; `e2e/journey-8.spec.ts` updated

**Decisions made:**

- **"Needs attention" reuses `buildDigestModel` rather than reimplementing the rule.** `docs/spec.md` §5.11 defines the three attention conditions for the digest, and `src/core/digest.ts` already computes them with tests. Writing a second definition for the home screen would guarantee that the screen and the morning email eventually disagree. `src/services/home.ts` assembles the inputs and passes `weather: null`, which `buildDigestModel` already handles.
- **`StatusChip` takes a status, not a booking.** There is no way for it to compute one itself, so `deriveStatus` stays the only source. Grep confirms the only calls are in `bookings/page.tsx` and `services/home.ts`.
- **The status filter lives in the URL, as links rather than a client control.** It survives a reload and the back button, which is what the criterion asks for, and it needs no client JavaScript.
- **`formatCalendarDate` formats from the string's parts, never through a `Date`.** A `Date`-based formatter renders `2026-08-17` as Aug 16 west of UTC — the exact bug `src/core/dates.ts` exists to avoid — and the display layer must not reintroduce it. There is a test saying so.
- **Filtering active bookings is done in `src/services/home.ts`, not in `src/core/digest.ts`.** The digest module's doc comment explicitly leaves that to the caller because deciding what belongs in a digest is service logic. This is that caller.

**A gap flagged, not resolved:** `docs/dev-plan.md` describes `/home` as "filtered by the acting admin". Nothing in `docs/spec.md` defines what that filter is, there is no assignment model, and §5.11 says the equivalent digest content is identical for every recipient. Recorded in Current State; the screen shows the same content to every admin.

**Three toolchain problems, each recorded because each cost real time:**

1. **The unit test glob covered only `src/core/`,** so `src/components/format.test.ts` silently ran zero tests — the suite reported 206 passing and never mentioned the new file. Extended to `src/{core,components}/**`.
2. **Playwright adopted the developer's dev server.** `reuseExistingServer` latched onto `pnpm dev` on :3000, which reads `.env` — the *main* branch — while fixtures mint tokens in the *test* branch. Every spec failed as an invalid magic link, which looks exactly like an authentication bug. E2E now runs on :3100 with `reuseExistingServer: false`.
3. **Next 16 allows one dev server per directory** and exits if one is running, so the fix in (2) could not use `next dev`. E2E now runs `pnpm build && next start -p 3100`, which is a more faithful target anyway.

Also: `workers: 1`, because `fullyParallel: false` only serializes within a file while separate spec files still race on the one shared database — surfacing as "Database is not empty" and foreign key violations unrelated to the code under test.

**Not done:**
- **No capture form** — Task 2.2. `/bookings/new` is linked but does not exist yet.
- **No booking detail screen** — Task 2.3. The list links to `/bookings/[id]`, which does not exist yet.
- **No customer detail screen** — Task 2.7.
- **No status is stored, cached, or defaulted anywhere.**

**Verification:**

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 220 tests, 8 files |
| `pnpm test:integration` | PASS — 100 tests |
| `pnpm test:e2e` | PASS — 22 tests |
| `pnpm build` | PASS |
| `pnpm typecheck` | PASS — zero errors |
| `pnpm lint` | PASS — zero errors |
| `prettier --check .` | PASS |
| `src/core/` boundary rule on a deliberate violation | 3 errors — still fires |

---

Phase 0 session entries archived to `logs/phase-0.md`.
Phase 1 session entries archived to `logs/phase-1.md` — **reconstructed from commit messages at housekeeping; see the note at the top of that file.**

---

*Entries are added newest-first, directly beneath the "Session entries" heading. Each entry uses this format:*

```
## YYYY-MM-DD — Task N.X: [Name]

**What was done:**
- [Specific changes, by file]

**Decisions made:**
- [Non-obvious choice and why]

**Not done:**
- [Anything deliberately deferred, and where it went instead]

**Verification:**
- [Command → result, with counts and timings]

---
```
