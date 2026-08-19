# Session Log — sittter

## Current State

**Phase:** 0 — Pure core — Not started
**Next task:** 0.1 — Domain types and calendar date arithmetic
**What's built:** Scaffold only. No application code — every directory under `src/` is empty. Structure, configuration, and tooling per `docs/dev-plan.md` §3, plus two throwaway pre-flight scripts under `scripts/spike/`. No database, no schema, no migrations.

**Gate status before Task 0.1: both gates closed. Task 0.1 may begin.**

1. ~~Pre-flight spikes~~ — complete, both assumptions hold.
2. ~~Scaffold session~~ — complete. `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, and `prettier --check` all pass. The `src/core/` boundary rule was proved to fire before being trusted.

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned — see below), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2.

**Open questions:** Three deferred items in `docs/spec.md` §10, each with a review trigger, not to be resolved during implementation. The Phase 5 calendar-onboarding question raised by Spike 1 was resolved by the human on 2026-08-19. Two new items need a human decision before the phases that depend on them — **the Vercel cron schedule (Phase 6)** and **the TypeScript 6 pin (any phase)** — both recorded in the scaffold entry below. Neither blocks Phase 0.

---

## Session entries

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
