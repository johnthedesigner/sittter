# Session Log — sittter

## Current State

**Phase:** 2 — Admin surface — In progress, 1 of 7 tasks complete
**Next task:** 2.2 — Fast capture

**What's built in Phase 2:** the admin shell with navigation and a persistent "New booking" action, `/home` (today + needs attention), `/bookings` (filterable list with both confirmation flags as columns), `/customers`, and the shared `StatusChip`, `FlagIndicator`, and formatters.

**Tests:** 220 unit, 100 integration, 22 end-to-end.

**A GAP FOR THE HUMAN — `/home` "filtered by the acting admin".** `docs/dev-plan.md` Phase 2 describes the home screen that way. The phrase has no definition in `docs/spec.md`, there is no assignment or ownership model to filter on, and §6.2 says all admins have identical capabilities. `docs/spec.md` §5.11 says the equivalent digest content is "identical for every recipient". **Not resolved:** the screen shows the same content to every admin. If filtering was meant to be something specific, it needs defining in the spec before a later task assumes otherwise.

**What Task 2.2 can rely on:**
- `requireAdmin()` in `src/app/(admin)/layout.tsx` returns `{ businessId, admin }` — the acting admin every write must record.
- `toBookingCore(row)` in `src/services/home.ts` maps a database row to the pure layer's `BookingCore`. Reuse it rather than writing a second mapper.
- `listBookingSummaries`, `getBookingSummary`, `listVisitsForBookings`, `listVisitsOnDate`, `listVisitLogsForVisits`, `listCareInstructionsForProperties` were added to the repositories.
- `formatCalendarDate`, `formatRange`, `formatCents`, `formatAttribution` in `src/components/format.ts`, and `ADMIN_STATUS_LABELS` in `src/components/status.ts`.

**Two config changes Task 2.2 inherits:**
- **The unit test glob now covers `src/{core,components}/**`.** META-PLAN §2 scoped it to `src/core/` before components existed; pure display helpers fell into neither suite. The `src/core/` boundary is unaffected — it is enforced by ESLint on the source, not by which runner executes a test.
- **`pnpm test:e2e` runs a production build on port 3100, never reusing a server.** A developer's own `pnpm dev` on :3000 reads `.env` — the *main* branch — and Playwright silently adopting it made every fixture-minted sign-in token invalid. Next 16 also refuses a second dev server per directory, so `next start` is used rather than `next dev`. First run includes a build; subsequent runs are ~40s.

**Database:** one Neon project, two branches. `main` (`.env`, seeded) for development; `test` (`.env.test`) for integration and e2e. Playwright runs `workers: 1` because every spec truncates and reseeds that one branch.

**Open decisions the human owns.** Recommendations in `docs/phase-0-retro.md`: the `src/core/` import rule versus `obscenity`; the Vercel cron schedule; the TypeScript 6 pin; `docs/spec.md` §5.12 and two-step calendar onboarding; and the `photos/[id]/route.ts` discrepancy. Plus the `/home` filtering gap above.

**Two Phase 2 review gates that are not code:** the **thirty-second capture measurement on a real phone** (Task 2.2 builds what it measures) and the **`docs/spec.md` §10 evaluation** of the isolated availability-check submission (Task 2.4).

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11 on Vite 8.2.1, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2, Neon Postgres.

**Open questions in the spec:** the three deferred items in `docs/spec.md` §10 remain open and are not to be resolved during implementation.

---

## Session entries

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
