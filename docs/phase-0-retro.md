# Phase 0 retrospective — Pure core

**Completed:** 2026-08-19
**Sessions:** 8 (pre-flight spikes, scaffold, Tasks 0.1 through 0.6)
**Output:** 7 modules under `src/core/`, 206 unit tests, a demo harness, and a toolchain that enforces the phase's central rule.

---

## What the phase produced

| Module | What it decides |
|---|---|
| `types.ts` | The domain vocabulary, including the branded `CalendarDate` and `DEFAULT_PRICING_COMPONENTS` |
| `dates.ts` | Calendar date arithmetic on `'YYYY-MM-DD'` strings |
| `status.ts` | `deriveStatus` — what a booking is called |
| `presentation.ts` | Customer-facing labels and note truncation |
| `pricing.ts` | `priceBooking` — an itemized total in integer cents |
| `schedule.ts` | `generateVisits` — cadences into dated visits |
| `digest.ts` | `buildDigestModel` — what the daily email says |
| `slug.ts` | `generateSlug` and the reserved and blocked checks |

Coverage across `src/core/`: 99.29% statements, 98.37% branches, 100% functions.

---

## What worked

**Proving a guard before trusting it.** The `no-restricted-imports` rule was made to fail on a deliberate `src/core/violation.ts` before any code depended on it, and re-proved after every configuration change. That was not ceremony: pinning TypeScript from 7 to 6 mid-scaffold silently disabled the entire lint layer, and the re-proof is what caught it. The same discipline was applied to the runtime purity tests — each was made to fail on a deliberately inserted `Date.now()` before being kept. A guard never seen to fail is indistinguishable from one that cannot fail.

**Writing tests from the specification rather than from the implementation.** `truncateNote` had a real defect — a note breaking exactly on a word boundary lost its last whole word — and it was caught because the test was written from the sentence "the last whole word that fits" before the edge case had been considered. Three later assertion failures were the reverse: wrong expected values, not wrong code. Each was resolved by computing the correct answer independently and confirming the implementation agreed, never by pasting the received value into the assertion. That distinction is invisible in a green test suite, which is exactly why the review gate asks about it.

**Ordering code to match the specification's shape.** `deriveStatus` is eight sequential branches in the derivation table's order, each commented with what it decides. Shorter formulations exist. They would have lost the precedence that the ordering encodes, and made it easy for a later reader to collapse two branches that happen to agree today.

**The demo harness earned its place immediately.** Reading it by hand surfaced two defects in the script that no test would have caught: a misaligned total column, and a day offset computed by slicing digits off a date string, which would have been silently wrong the first time a range crossed a month boundary. A phase with no visual output needs an artifact a human can look at, and this is why.

---

## What was harder than expected

**The toolchain fought the plan more than the code did.** Four of the scaffold's six deviations were forced by version drift the plan could not have anticipated: TypeScript 7 breaking `typescript-eslint`, `baseUrl` becoming an error, pnpm moving build-script approval out of `package.json`, and all three test runners exiting non-zero on an empty glob. None were interesting; together they were most of the scaffold session. Worth expecting again at the Phase 1 boundary, where Drizzle and Neon arrive.

**`obscenity` does not expose what the reference data assumed.** The plan said to filter the dataset "to entries that are exactly five characters". The dataset stores parsed patterns with wildcards, not plain words, so there is nothing to filter. The working approach — build a `RegExpMatcher` once and test candidates — is the package's intended API and rejects 0.171% of random slugs, so retries are negligible. The reference data should be corrected before anyone reads it as gospel in Phase 3.

**One architectural rule needs reconciling, and it is not a code problem.** `src/core/slug.ts` imports `obscenity`. AGENTS.md says `src/core/` "may import only from `src/core/` and from Node built-ins", which reads against that; the task file requires the check in that file and forbids vendoring a word list, so there is no third option. `obscenity` performs no input or output, which is what the rule's own heading asks for. Flagged rather than resolved — see below.

---

## Decisions the human still owns

Carried forward in `SESSION_LOG.md` Current State. None block Phase 1.

1. **The `src/core/` import rule versus `obscenity`.** The rule's heading says "imports nothing that performs input or output"; its body says "only `src/core/` and Node built-ins". Those are different rules and the difference now matters. Recommendation: amend the body to match the heading, so pure computational packages are permitted and I/O-performing ones remain forbidden. Until then the import stands as a documented, deliberate exception rather than a precedent.
2. **The Vercel cron schedule**, before Phase 6. AGENTS.md describes an hour-checking job, which implies more-than-daily invocation; Vercel Hobby allows one run per day. A fixed daily UTC cron also drifts an hour against `America/New_York` across the DST boundary.
3. **The TypeScript 6 pin**, whenever `typescript-eslint` supports TS 7.
4. **`docs/spec.md` §5.12 and the two-step calendar onboarding**, from the Spike 1 finding, before Phase 5.
5. **A documentation discrepancy:** AGENTS.md lists `src/app/api/photos/[id]/route.ts`; `docs/dev-plan.md` §3 does not.

---

## What to carry into Phase 1

- **Prove each new guard before trusting it.** Phase 1 introduces the rule that no SQL exists outside `src/db/repositories/`. Write something that violates it and watch the check fail, exactly as was done for `src/core/`.
- **Expect a toolchain session, not just a code session.** Budget for Drizzle, Neon, and migrations behaving differently from the plan's assumptions, and record the deviations rather than absorbing them.
- **Keep the demo habit.** Phase 1 ends with one stub page rendering a signed-in admin's name. That is its equivalent of the demo harness, and it should be looked at rather than merely passing.
- **`passWithNoTests` is now a liability.** It was necessary to satisfy the scaffold gate with empty globs. From Phase 1 on, the integration glob will match real files, and a glob broken by a rename would pass silently instead of failing. Consider removing it from `vitest.integration.config.ts` once that suite has its first test.
