# Session Log — sittter

## Current State

**Phase:** 2 — Admin surface — In progress, 2 of 7 tasks complete
**Next task:** 2.3 — Booking detail: header, dates, and care instructions

**What's built in Phase 2:** the admin shell, `/home`, `/bookings` (filterable, both flags as columns), `/customers`, `/bookings/new` (fast capture), and a **partial** `/bookings/[id]`.

**Tests:** 220 unit, 119 integration, 32 end-to-end.

**`/bookings/[id]` is deliberately partial.** Journey step 1.1.7 requires the detail screen to load after capture and show the derived status and the note, so Task 2.2 built the header and the activity list. **Task 2.3 owns the rest** — the dates section and care instructions — and extends this page rather than creating it. Task 2.7 adds manual activity entry; the list is read-only today.

**What Task 2.3 can rely on:**
- `captureBooking`, `validateCapture`, and `CaptureError` in `src/services/bookings.ts`. `validateCapture` returns a sentence a person can act on, or null; the database's `range_ordered` constraint is a backstop that a user must never be the one to discover.
- The `actingAdmin()` helper in `src/app/(admin)/actions/bookings.ts` resolves the acting admin for a server action, where `requireAdmin()`'s redirect semantics are wrong.
- `ACTIVITY_SOURCE_LABELS` in `src/components/activity.ts`, `ActivitySource` in `src/core/types.ts`.
- `searchCustomersByName`, `listCustomersForCapture` on the customers repository.

**A resolved reference-data detail:** `docs/spec.md` §5.1 says the capture note is written with source `admin capture`. There is no such value in the `activity_source` enum. `tasks/phase-2.md` Reference data resolves it to `app` with `is_system` false, which is what was built.

**An unspecified default that was chosen:** a brand-new customer gets a property nicknamed **`Home`** (`DEFAULT_PROPERTY_NICKNAME`). `properties.nickname` is NOT NULL and nothing specifies what a captured property should be called. Renameable in Task 2.3.

**A GAP FOR THE HUMAN — `/home` "filtered by the acting admin".** Unchanged from Task 2.1. `docs/dev-plan.md` describes the home screen that way; nothing in `docs/spec.md` defines that filter, there is no assignment model, and §5.11 says the equivalent digest content is "identical for every recipient". The screen shows the same content to every admin.

**Database:** one Neon project, two branches. `main` (`.env`, seeded) for development; `test` (`.env.test`) for integration and e2e. Playwright runs a production build on **:3100** with `workers: 1` and never reuses a server.

**Open decisions the human owns.** Recommendations in `docs/phase-0-retro.md`: the `src/core/` import rule versus `obscenity`; the Vercel cron schedule; the TypeScript 6 pin; `docs/spec.md` §5.12 and two-step calendar onboarding; the `photos/[id]/route.ts` discrepancy. Plus the `/home` filtering gap.

**Two Phase 2 review gates that are not code:** the **thirty-second capture measurement on a real phone** — *the surface it measures now exists at `/bookings/new`, so this can be done any time* — and the **`docs/spec.md` §10 evaluation** (Task 2.4).

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11 on Vite 8.2.1, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2, Neon Postgres.

**Open questions in the spec:** the three deferred items in `docs/spec.md` §10 remain open and are not to be resolved during implementation.

---

## Session entries

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
