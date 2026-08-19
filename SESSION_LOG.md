# Session Log — sittter

## Current State

**Phase:** 0 — Pure core — In progress, 4 of 6 tasks complete
**Next task:** 0.5 — Digest model composition
**What's built:** `src/core/types.ts`, `dates.ts`, `status.ts`, `presentation.ts`, `pricing.ts`, `schedule.ts`. 143 unit tests, all passing. Scaffold and tooling complete. No digest, no slug, no demo harness, no database.

**Available to Task 0.5:** every domain type from §6 plus `DEFAULT_PRICING_COMPONENTS`; `toCalendarDate`, `isValidCalendarDate`, `addDays`, `daysBetween` (inclusive), `expandRange`, `isWithinRange`, `compareDates`, `todayIn`; `deriveStatus`; `toCustomerFacingStatus`, `toCustomerFacingLabel`, `CUSTOMER_FACING_LABELS`, `truncateNote`; `priceBooking`; `generateVisits`.

**Note for Task 0.5:** `truncateNote` already exists from Task 0.2 and defaults to 60 characters, which is the digest timeline's truncation rule — do not write a second one. The `DigestModel`, `DigestBookingBlock`, `DigestTimelineDay`, `DigestWeather`, and `DigestAttentionItem` types are already defined in `types.ts`.

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2.

**Open questions:** Three deferred items in `docs/spec.md` §10, not to be resolved during implementation. The Phase 5 calendar-onboarding question was resolved by the human on 2026-08-19. Two items still need a human decision, neither blocking Phase 0: **the Vercel cron schedule** (before Phase 6) and **the TypeScript 6 pin** (whenever typescript-eslint supports TS 7).

---

## Session entries

## 2026-08-19 — Task 0.4: Visit schedule generation

**What was done:**
- `src/core/schedule.ts` — `generateVisits({ startDate, endDate, instructions })` returning `ScheduleResult`
- `src/core/schedule.test.ts` — 24 tests

**Decisions made:**

- **The three stepping cadences are one branch, not three.** `every_day`, `every_other_day`, and `every_third_day` differ only by a step of 1, 2, or 3, held in a lookup. Writing them separately would have meant three near-identical loops and three places to get the `< dayCount` bound wrong.
- **Collapsing is done with a `Map` keyed by date**, so two instructions landing on the same day accumulate into one visit's `taskIds`. The sitter makes one trip and does both things; two visit rows for one trip would be wrong in the schedule and wrong in per-visit pricing.
- **Instructions are processed in `sortOrder`,** so `taskIds` on a collapsed visit read in the same order the instructions do on screen. The input array is copied before sorting; there is a test that the caller's array is untouched.
- **`startDate` and `endDate` are required, not nullable.** A booking without dates cannot be scheduled, and making the type enforce that pushes the guard to the caller rather than hiding an empty result. An *inverted* range still yields no visits rather than throwing, matching `expandRange` — a range being edited is a normal state.
- **`as_needed` and `custom` are reported, not silently dropped.** Each produces a `skippedInstructions` entry with a sentence explaining that visits are added by hand, so a surface can say so rather than leaving someone wondering why their instruction produced nothing.

**A restructure to remove unreachable code rather than document it.**

The first version filtered `as_needed` and `custom` with an early `continue`, which made the final `return []` in `offsetsFor` permanently unreachable — coverage flagged it at line 69. Documenting it as defensive, as was done for the genuine type-system guards in `dates.ts`, would have been the easy answer and the wrong one: those guards are unreachable because a brand makes them so, whereas this was unreachable because of how the loop happened to be written. Removing the `continue` lets one path serve every cadence, with the skip reason recorded alongside a naturally empty offset list. `schedule.ts` went from 97.29% to 100% statements, and the branch is gone rather than excused.

**Not done:**
- **No regeneration or preservation logic.** What happens to existing visits when a schedule is regenerated is Phase 2 service work, per the must-not-do list.
- **No time windows assigned.** `GeneratedVisit` carries only `date` and `taskIds`; the service layer defaults to `anytime`. There is a test asserting the returned object has exactly those two keys, so a window cannot creep in unnoticed.
- **Nothing from Tasks 0.5 or 0.6** — no digest, slug, or demo harness.
- **Nothing created under `src/db/`, `src/services/`, or `src/app/`.**

**Verification:**

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 143 tests, 5 files, 251 ms |
| `pnpm test:integration` | PASS — zero tests, exit 0 |
| `pnpm test:e2e` | PASS — zero tests, exit 0 |
| `pnpm typecheck` | PASS — zero errors |
| `pnpm lint` | PASS — zero errors |
| `prettier --check .` | PASS |
| Coverage, `schedule.ts` | 100% statements, branches, and functions |
| Coverage, all of `src/core/` | 99% statements, 97.69% branches, 100% functions |

Every row of the cadence anchoring table has a test asserting the exact dates produced, not merely the count.

---

## 2026-08-19 — Task 0.3: Pricing engine

**What was done:**
- `src/core/pricing.ts` — `priceBooking(input)` returning `PricedBooking`, plus the `PricingInput` shape
- `src/core/types.ts` — added `DEFAULT_PRICING_COMPONENTS`, deferred from Task 0.1
- `src/core/pricing.test.ts` — 31 tests

**Decisions made:**

- **`DEFAULT_PRICING_COMPONENTS` went into `types.ts`, not `pricing.ts`.** `docs/dev-plan.md` §6 opens "Defined in `src/core/types.ts`" and §6.1 sits under it. Following the document literally beat the instinct to file it with the engine.
- **`priceBooking` takes `{ booking, visits, components, adhocItems }`** rather than loose counts. The counts and both overrides already live on `BookingCore`, and passing the booking keeps the override flags impossible to forget.
- **A component that does not apply produces no line item.** Zero days, zero visits, or no recorded durations means the row is omitted, not emitted at zero. Required by the acceptance criteria for `per_visit`, and applied consistently to `per_day` and `per_hour` — "0 visits at $6.00 — $0.00" is noise on something a customer reads. `flat` and `custom` always have quantity 1 and so are never suppressed.
- **Ad-hoc items are never suppressed, including negative ones.** A discount or a correction is a deliberate entry; hiding it would be worse than showing it.
- **Ordering is components by `sortOrder`, then ad-hoc by `sortOrder`.** The task fixes component ordering but says nothing about where ad-hoc items sit. They go last because they adjust a computed price, and an invoice reads the adjustment after the thing it adjusts. Both arrays are copied before sorting, so the caller's arrays are not mutated — there is a test for this.
- **`per_hour` multiplies before dividing, then rounds once.** `Math.round((minutes * unit) / 60)`. The product is an exact integer; rounding immediately means no float is ever held as money. `quantity` carries fractional hours, which is a count rather than a currency value and is allowed to be fractional.
- **An override does not change the minutes a `per_hour` component sees.** Overrides adjust billed counts; the summed durations are what actually happened. Tested.

**A tension worth naming, and why it is not a violation.**

AGENTS.md says formatting to dollars "happens only at the point of display", and this module produces `basis` strings containing "$5.00". That is not a breach: `docs/dev-plan.md` §6 defines `basis` as exactly that display artifact, with the same example. The rule's substance — that no floating point arithmetic touches a currency value — is preserved. `formatDollars` uses `Math.floor(cents / 100)` and `cents % 100` on integers and never divides into a float, which is also why 1999 cents renders "$19.99" rather than "$19.990000000000002". There is a test asserting exactly that.

**Not done:**
- **No currency formatting for display beyond `basis`.** The must-not-do list forbids it; a surface formats `amountCents` itself.
- **No snapshot logic.** When a price is frozen is Phase 2 service concern.
- **Nothing from Tasks 0.4 through 0.6** — no scheduling, digest, slug, or demo harness.
- **Nothing created under `src/db/`, `src/services/`, or `src/app/`.**

**Verification:**

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 119 tests, 4 files, 250 ms |
| `pnpm test:integration` | PASS — zero tests, exit 0 |
| `pnpm test:e2e` | PASS — zero tests, exit 0 |
| `pnpm typecheck` | PASS — zero errors |
| `pnpm lint` | PASS — zero errors |
| `prettier --check .` | PASS |
| Coverage, `pricing.ts` | 100% statements, 96.77% branches, 100% functions |
| Coverage, all of `src/core/` | 98.78% statements, 97.45% branches, 100% functions |

The worked example is asserted field by field: two line items, `'7 days at $5.00'` at quantity 7 and unit 500 for 3500, `'4 visits at $6.00'` at quantity 4 and unit 600 for 2400, total 5900.

---

## 2026-08-19 — Task 0.2: Status derivation and customer-facing presentation

**What was done:**
- `src/core/status.ts` — `deriveStatus(booking, today)`
- `src/core/presentation.ts` — `toCustomerFacingStatus`, `toCustomerFacingLabel`, `CUSTOMER_FACING_LABELS`, `truncateNote`
- `src/core/status.test.ts` — 24 tests
- `src/core/presentation.test.ts` — 23 tests

**Decisions made:**

- **`deriveStatus` is written as eight sequential branches, one per row of the derivation table, in the table's order.** It would be shorter as a lookup or a set of combined conditions, and that would be worse: the order *is* the specification. It encodes precedence the individual conditions do not carry — a cancelled booking is cancelled even with both flags set and a future range, and a declined booking is declined even when paid. Each branch carries a comment naming what it decides so that a later reader does not "simplify" two adjacent branches that happen to agree today.
- **`CUSTOMER_FACING_LABELS` and `toCustomerFacingLabel` were added.** The task names only `toCustomerFacingStatus`, but the acceptance criterion requires a test asserting the exact *label* for every row, and the label strings had to live somewhere. They live in one place so that changing "Waiting on you" changes it everywhere, and so no surface spells the words a second time.
- **`toCustomerFacingStatus` takes the booking as a required argument, not an optional one.** Only `tentative` needs it, to split on `datesFirmAt` into "Waiting on you" versus "Waiting on us". Making it optional would make it easy to omit silently and point the finger at the wrong party.
- **`truncateNote` defaults to 60 and takes `maxLength` as an argument** rather than hard-coding the reference-data value, so the digest can pass its own without a second function.

**A bug found by a test, and the ordering that found it.**

The first implementation of `truncateNote` sliced to `maxLength`, found the last space, and cut there — which silently dropped a whole word whenever the note happened to break exactly on a word boundary. `truncateNote('one two three...', 7)` returned `'one…'` when `'one two'` fits in seven characters exactly. The test was written from the specification ("the last whole word that fits") before the edge case was considered, so it failed and named the problem. Fixed by checking whether the character just past the window is a space, in which case the window already ends on a complete word.

Two later failures in the same test were the reverse — my *expected* strings were wrong, not the code. Both were resolved by computing the correct boundary and confirming the implementation's answer was right, rather than pasting the received value into the assertion. Worth recording because pasting the received value is the failure mode this project's review gate is designed to catch, and it is indistinguishable from a fix unless you check.

**Not done:**
- **No status is stored anywhere.** `deriveStatus` computes on demand; no type gained a status field.
- **`DEFAULT_PRICING_COMPONENTS` still not written.** It belongs to Task 0.3.
- **Nothing from Tasks 0.3 through 0.6** — no pricing, scheduling, digest, slug, or demo harness.
- **Nothing created under `src/db/`, `src/services/`, or `src/app/`.**

**Verification:**

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 88 tests, 3 files, 230 ms |
| `pnpm test:integration` | PASS — zero tests, exit 0 |
| `pnpm test:e2e` | PASS — zero tests, exit 0 |
| `pnpm typecheck` | PASS — zero errors |
| `pnpm lint` | PASS — zero errors |
| `prettier --check .` | PASS |
| Coverage, `status.ts` | 100% statements, branches, functions |
| Coverage, `presentation.ts` | 100% statements, branches, functions |
| Coverage, all of `src/core/` | 98.26% statements, 97.7% branches, 100% functions |

---

## 2026-08-19 — Task 0.1: Domain types and calendar date arithmetic

**What was done:**
- `src/core/types.ts` — every type from `docs/dev-plan.md` §6, including the branded `CalendarDate`. Two enumerations were extracted to named aliases (`TimeWindow`, `PricingComponentType`) because §6 spells the same unions inline in more than one place and later tasks need to name them.
- `src/core/dates.ts` — `toCalendarDate`, `isValidCalendarDate`, `addDays`, `daysBetween`, `expandRange`, `isWithinRange`, `compareDates`, `todayIn`.
- `src/core/dates.test.ts` — 41 tests. Every acceptance criterion in the task has a test that names it.

**Decisions made:**

- **No `Date` object appears in the calendar arithmetic.** `addDays`, `daysBetween`, `expandRange`, `isWithinRange`, and `compareDates` convert to an integer day number, do integer arithmetic, and convert back, using Howard Hinnant's `days_from_civil` / `civil_from_days`. This is what makes the daylight saving criteria pass by construction rather than by luck: no instant is ever constructed, so there is no 23 or 25 hour day to trip over. It also satisfies the AGENTS.md rule against round-tripping a calendar date through a `Date`.
- **`todayIn` is the sole exception, and uses `Intl`, not field arithmetic.** Converting a real instant to a calendar date genuinely requires zone rules — only the zone database knows the offset in effect at that instant, and that offset is exactly what decides which day it is. It takes the instant as an argument and reads no clock.
- **`daysBetween` counts inclusively.** `2026-08-01` to `2026-08-07` is 7. The task fixes this, and it is the per-day pricing basis. Documented at the function, because 7 rather than 6 is the kind of thing a later reader will assume is a bug.
- **`daysBetween` returns 0 for an inverted range**, matching `expandRange` returning `[]` for the same input. The task specifies the array behavior but not the count; consistency between them seemed more valuable than an exception, and a range not yet filled in is a normal state rather than an error.
- **The brand is not exported.** `toCalendarDate` is the only way to make a `CalendarDate`, so an unvalidated string cannot reach the domain.
- **`DEFAULT_PRICING_COMPONENTS` from §6.1 was deliberately not written.** It is a constant belonging to pricing, and this task's must-not-do list excludes pricing. It belongs to Task 0.3.

**A note on the purity test, because it required backing out of a first attempt.**

The first version of the purity check read `dates.ts` as text and asserted the source contained no `Date.now(`. It needed `node:fs`, which the `src/core/` boundary rule correctly forbids — including in test files. Rather than add an exception to that rule, which AGENTS.md names as the most serious failure available in this project, the test was rewritten to replace `Date.now` and `Math.random` with throwing stubs at runtime and then exercise every exported function.

That guard was then proved to fire, on the same principle applied to the lint rule during the scaffold: a temporary `Date.now()` was inserted into `addDays`, the test went red with `Error: src/core/dates.ts read the clock`, and the change was reverted. A guard never seen to fail is indistinguishable from one that cannot.

**Not done:**
- **Nothing from Tasks 0.2 through 0.6.** No status derivation, pricing, schedule generation, digest composition, slug generation, or demo harness.
- **No date library added.** The must-not-do list forbids it and the arithmetic did not need one.
- **Nothing created under `src/db/`, `src/services/`, or `src/app/`.**
- **Two defensive `throw` paths are uncovered** — the guards in `toDayNumber` and `todayIn`. Both are unreachable through the public API because `CalendarDate` is branded, and testing them would mean casting a bad value past the type system to reach a line that exists only in case someone does. Recorded rather than papered over with a cast.

**Verification:**

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 41 tests, 1 file, 186 ms |
| `pnpm test:integration` | PASS — zero tests, exit 0 |
| `pnpm test:e2e` | PASS — zero tests, exit 0 |
| `pnpm typecheck` | PASS — zero errors |
| `pnpm lint` | PASS — zero errors |
| `prettier --check .` | PASS |
| Coverage, `src/core/dates.ts` | 97.4% statements, 95.83% branches, 100% functions |
| Purity guard against a deliberate `Date.now()` | Red, as designed, then reverted |

---

## 2026-08-19 — Scaffold session

Per `docs/META-PLAN.md` §2. Structure, configuration, and tooling only. No application code was written; `find src -type f` returns nothing but `.gitkeep` files.

**What was done:**
- Full directory tree from `docs/dev-plan.md` §3, with `.gitkeep` in each empty directory so git tracks them
- `package.json` — pnpm project, all 14 required scripts, runtime and development dependencies as listed in META-PLAN §2 step 2
- `tsconfig.json` — strict, `noUncheckedIndexedAccess`, `@/*` → `src/*`
- `eslint.config.mjs` — one flat config for the whole repository, carrying the `src/core/` boundary rule
- `.prettierrc`, `.prettierignore`
- `vitest.config.ts` (unit, `src/core/**/*.test.ts`, v8 coverage), `vitest.integration.config.ts` (`src/{db,services}/**/*.test.ts`)
- `playwright.config.ts` — `e2e/`, base URL `http://localhost:3000`
- `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `drizzle.config.ts`, `vercel.json`
- `.env.example` — every variable from `docs/dev-plan.md` §4, grouped by phase, each commented
- `README.md`
- `.gitignore` extended with `next-env.d.ts` and build info files

**The boundary rule was proved before being trusted.** A temporary `src/core/violation.ts` importing `react` and `@/db/client` and calling `Date.now()` and `Math.random()` produced four errors and a non-zero exit. It was re-proved after every subsequent config change, then deleted. The rule covers more than the prompt required: the forbidden import list, plus `no-restricted-properties` on `Date.now` and `Math.random` and `no-restricted-globals` on `process`, because AGENTS.md forbids reading a clock, randomness, or the environment from `src/core/` and an import rule alone would not catch those.

**Decisions made — each forced, none discretionary:**

- **TypeScript pinned to 6.0.3.** TS 7.0.2 resolves by default, and `typescript-eslint` 8.67 refuses to load against it: *"typescript-eslint does not support TS 7.0."* That would have left the `src/core/` boundary unenforced, which AGENTS.md treats as the most serious failure available in this project. The lint rule outranks the compiler version. **Needs a human decision eventually** — revisit when typescript-eslint ships TS 7 support; there is no urgency.
- **`baseUrl` omitted from tsconfig.** Deprecated in TS 6 and a hard error under default settings. `paths` resolves relative to the tsconfig without it.
- **Tailwind pinned to 3.4.19.** META-PLAN §2 lists `postcss` and `autoprefixer`, and `docs/dev-plan.md` §3 lists `tailwind.config.ts` — that is the v3 shape. Tailwind 4 replaces all three with a CSS-first config and no config file, which would contradict the documented structure. Flagged rather than resolved.
- **`passWithNoTests` on both Vitest configs and `--pass-with-no-tests` on Playwright.** Step 12 requires each runner to exit cleanly with zero tests; all three exit 1 on an empty glob otherwise. Tradeoff, recorded because it will matter later: once Phase 0 has tests, a glob broken by a rename would pass silently rather than fail.
- **Prettier ignores `AGENTS.md`, `SESSION_LOG.md`, `docs/`, `tasks/`, `logs/`.** It reflows markdown tables and wrapping, and `--list-different` showed it would rewrite all seven planning documents on first run. Those are authored prose maintained by hand; churning them would bury real edits in diff noise.
- **`pnpm-workspace.yaml` with `allowBuilds`.** pnpm 11 no longer reads build-script approval from `package.json`'s `onlyBuiltDependencies`. Until this was right, esbuild never unpacked and every `pnpm test:unit` failed inside a pre-flight `pnpm install` rather than in the test runner — the error named `pnpm install`, not esbuild, and not vitest.
- **`src/app/api/photos/[id]/` created.** Listed in the AGENTS.md repository structure but absent from `docs/dev-plan.md` §3. AGENTS.md wins by its own conflict rule, and Phase 4 needs the route. **The two documents should be reconciled.**
- **`vercel.json` cron set to `0 11 * * *` (daily, ~07:00 America/New_York during EDT).** See below — this one needs a decision.

**Needs a human decision before Phase 6 — the cron schedule.**

AGENTS.md describes the daily job as one that "checks that the current local hour matches the business's configured digest hour and returns without acting if it does not." That design implies the job is invoked more often than once a day — otherwise the hour check has nothing to guard. But **Vercel Hobby restricts cron to one invocation per day**, and Hobby is the plan this project targets (Spike 2 exists to fit its function timeout).

A fixed daily UTC cron also drifts an hour against `America/New_York` across the DST boundary, so a digest configured for 07:00 local will fire at 08:00 local for part of the year. The schedule is currently set to a single daily run that is correct during EDT. Resolving this properly is a Phase 6 planning decision — hourly invocation on Pro, accepting the DST drift, or two seasonal schedules. Not resolved here.

**Not done:**
- **No application code.** Not a single `.ts` file under `src/`. No `src/app/layout.tsx` or `page.tsx`, so `pnpm build` was deliberately not run — it has nothing to build, and building was not among step 12's verifications.
- **No `pnpm db:generate` or database connection.** Phase 1.
- **`docs/spec.md` §5.12 not reconciled** with the two-step calendar onboarding finding. Phase 5 planning.
- **Task 0.1 not started.** META-PLAN §2 ends "Do not proceed to Phase 0 task work."

**Verification** — run separately, each reported on its own:

| Command | Result |
|---|---|
| `pnpm typecheck` | PASS, zero errors |
| `pnpm lint` | PASS, zero errors |
| `pnpm test:unit` | PASS, zero tests, exit 0 |
| `pnpm test:integration` | PASS, zero tests, exit 0 |
| `pnpm test:e2e` | PASS, zero tests, exit 0, Chromium 151.0.7922.34 installed |
| `prettier --check .` | PASS |
| `src/core/` boundary rule on a deliberate violation | 4 errors, exit 1 — **rule fires** |
| Spike scripts still run after reformat | PASS, 628 ms dry run |

---

## 2026-08-19 — Pre-flight risk validation: Spikes 1 and 2

Per `docs/dev-plan.md` §12 and `docs/META-PLAN.md` §1. No application code. Both assumptions hold.

**What was done:**
- `scripts/spike/env.mjs` — minimal `.env` reader, no dependencies
- `scripts/spike/google-calendar.mjs` — Spike 1, Google service account calendar
- `scripts/spike/daily-job-budget.mjs` — Spike 2, daily job timing
- `.gitignore`, `logs/`, `scripts/spike/`, `git init` on `main` — the repository did not exist before this session
- `.env.local` template created; credentials were ultimately supplied in `.env` (both gitignored)

### Spike 1 — Google service account calendar: ASSUMPTION HOLDS

A service account with domain-wide delegation **disabled** can own a calendar and share it with an ordinary Gmail account. All five checks pass. The scripted ones:

| Check | Result |
|---|---|
| JWT-bearer token exchange, no delegation | PASS |
| `calendar.calendars.insert` creates a secondary calendar | PASS |
| `calendar.acl.insert` grants a Gmail address `reader` | PASS |
| `extendedProperties.private` written, then matched via `privateExtendedProperty` | PASS — 1 event, marker survived the round trip |

The extended-properties round trip is the load-bearing one: it is what keeps sync reconcilable after a manual edit in Google, which the Phase 5 design depends on.

**The two hand checks, and the finding that matters:**

Sharing is **not one step**. Neither manual check passed on its own.

- **Step 3 — Google Calendar.** The calendar did **not** appear automatically after `acl.insert`. An invitation email arrived separately; after accepting it, the calendar appeared immediately across all of that account's devices.
- **Step 4 — Apple Calendar on iPhone.** The Google account was *already* connected on the device and the calendar still did not appear. It was listed at `calendar.google.com/calendar/syncselect` but **unchecked**. Enabling it there and saving made it visible in both Google Calendar and Apple Calendar.

**Consequence for Phase 5 — flagged, not resolved.** Adding a family member takes three steps, only the first of which the app controls:

1. An admin triggers `acl.insert` from the settings screen.
2. The recipient accepts an emailed invitation.
3. The recipient enables the calendar at `syncselect` for it to reach iOS.

The settings screen in `docs/spec.md` §5.12 is currently designed as though step 1 were sufficient. Without copy setting expectations for steps 2 and 3, the predictable failure is a family member reporting the calendar "doesn't work" while the app shows the share as successful — and step 3 in particular is invisible, since the calendar is present in Google but silently absent from the phone.

Per the AGENTS.md rule *"Open questions in the spec are not yours to close"*, this is recorded and left open. It is a Phase 5 planning decision for the human, taken with this finding in hand. It does not block Phase 0.

**Resolved by the human, 2026-08-19 — V1 supports Google Calendar only.**

The supported clients for Phase 5 are Google Calendar on the web and the Google Calendar app. Apple Calendar on iOS is explicitly **not** a supported surface in V1. Making it smoother is deferred and may be revisited later.

Rationale: step 3 is Apple-specific. Google Calendar picked the shared calendar up across all of the recipient's devices immediately on accepting the invitation, with no visit to `syncselect`. Scoping to Google removes the invisible failure mode entirely rather than papering over it with copy.

What this does *not* remove is step 2. The calendar did not appear under *Other calendars* until the emailed invitation was accepted. Onboarding a family member on the supported path is therefore **two steps**: an admin shares from the settings screen, and the recipient accepts an emailed invitation. `docs/spec.md` §5.12 currently reads as though the first were sufficient, and should be reconciled when Phase 5 is planned.

Anyone who does connect the calendar to Apple Calendar will still need the `syncselect` step. That is now a known limitation rather than a defect.

**Incidental obstacles, recorded because they will recur when provisioning production credentials:**

- Creating the GCP project under a Google Workspace organization was blocked: `constraints/iam.disableServiceAccountKeyCreation` is enforced by default on newly created organizations, and "Parent Resource" is mandatory once an account belongs to an org. Resolved by creating the project under a consumer Gmail account, which belongs to no organization. The alternative — an `orgpolicy.policyAdmin` override scoped to one project — was deliberately not taken for a throwaway spike.
- The Calendar API is off by default. First run failed `403 SERVICE_DISABLED`. Enabling it at the console fixed it; propagation was not instant.

### Spike 2 — Daily job inside the Hobby budget: ASSUMPTION HOLDS LOCALLY

Three Open-Meteo coordinate pairs with `past_days=1`, trivial composition, two Resend sends, all parallel where production would parallelize.

| Stage | Time |
|---|---|
| Weather, 3 properties | 641 ms |
| Composition | 0 ms |
| Email, 2 sends | 235 ms |
| **Total** | **879 ms** against an 8,000 ms target |

Headroom against the 10,000 ms Hobby timeout: **9,121 ms**. The job is nowhere near the limit. No split is needed and there is no case for moving to Vercel Pro on these grounds.

**Caveat, stated plainly so Phase 6 is not planned against the wrong number.** This measured API latency from a developer machine. It did **not** measure a cold-started Vercel serverless function, which is what the assumption is actually about — a cold start adds runtime boot and module load, and runs from Vercel's region. The margin is wide enough that a cold start is very unlikely to consume it, but that is a judgement, not a measurement. If Phase 6 later runs close to budget, this is the first thing to re-measure properly.

**Decisions made:**
- **Raw REST, zero dependencies, plain `.mjs`.** The spike session runs before the scaffold, so there is no `package.json` to install `googleapis`, `resend`, or `tsx` into, and `docs/META-PLAN.md` §1 forbids creating project structure. Raw REST also tests the HTTP contract that Phase 5 and Phase 6 depend on, rather than an SDK's behavior over it.
- **`env.mjs` expands `\n` inside a PEM whether or not the value was quoted.** An unquoted key with literal `\n` is how it is usually pasted, and untreated it fails as `error:1E08010C:DECODER routines::unsupported`, which names nothing leading back to the cause. `src/services/calendar.ts` will need the same normalization in Phase 5. Candidate for AGENTS.md Patterns established once that file exists.
- **A real `process.env` value overrides the file** in `env.mjs`, so a run can be varied without editing credentials.
- **Two emails sent to the same address.** Resend's shared `onboarding@resend.dev` sender only delivers to the address owning the API key until a domain is verified. The first run measured one send, which was not faithful to an assumption specifying two; it was re-run with the recipient duplicated.
- **The spike calendar is left in place**, deletable via `--cleanup`, because steps 3 and 4 required it to persist.

**Not done:**
- **No cold-start measurement on a real Vercel function.** See the Spike 2 caveat.
- **The Phase 5 onboarding consequence was not resolved.** Deliberately left open per AGENTS.md.
- **No scaffold work.** `docs/META-PLAN.md` §1 ends with "Do not proceed to scaffold work."
- **No application code, no `package.json`, no project structure.**

**Verification:**
- `node scripts/spike/google-calendar.mjs` → all scripted steps PASS; calendar `309c4a80…@group.calendar.google.com` created, ACL rule `user:jlivornese@gmail.com` role `reader`, event `h333aqtas5gvrt45dofa71slk4` matched by marker
- Hand checks for steps 3 and 4 → both pass only after the extra recipient-side actions described above
- `node scripts/spike/daily-job-budget.mjs` → 879 ms total, both Resend sends accepted (ids `ebdcbbbc…`, `f80d2d6c…`)
- Private key parses as RSA 2048-bit after PEM normalization
- `git status` clean; `.env` and `.env.local` confirmed untracked via `git check-ignore`
- Type check, lint, and test suites **not run — they do not exist yet.** The scaffold session creates them.

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
