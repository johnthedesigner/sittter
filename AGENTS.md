# AGENTS.md — Standing Orders

**Read this file first. Every session. No exceptions.**

This file contains the invariants for this project — rules that do not change between sessions and must be respected regardless of what a task asks you to do. If a task instruction conflicts with a rule in this file, the rule wins. Stop and flag the conflict rather than resolving it silently.

---

## What to do at the start of every session

Read these three things, in this order, before writing any code:

**Step 1 — Read this file (`AGENTS.md`) in full.**

**Step 2 — Read `SESSION_LOG.md`.** Start with the **Current State block** near the top. It tells you the current phase, the next task ID and name, what is already built, and any open questions. Read individual session entries only if you need the reasoning behind a specific past decision.

**Step 3 — Read the entry for the next task only** from the current phase task file. The Current State block identifies it. Do not read the full task file.

If any of the above are missing, or the task is unclear, ask before proceeding.

---

## What to do at the end of every session

1. Verify every acceptance criterion in the task is checked off.
2. Run the relevant tests and confirm they pass:
   - `pnpm test:unit`
   - `pnpm test:integration` (from Phase 1 onward)
   - `pnpm test:e2e` (from Phase 2 onward, when the task touches a user surface)
3. Run `pnpm typecheck` and confirm zero errors.
4. Run `pnpm lint` and confirm zero errors.
5. Check that no architectural rule below has been violated.
6. Update `SESSION_LOG.md`:
   - Add a full session entry recording what was done, decisions made, and what was deliberately not done.
   - Replace the **Current State block** with the new current state.
7. Mark the task complete in the phase task file.
8. If this task established a reusable implementation pattern, add it to **Patterns established** below.
9. Commit with the task ID in the message, for example `Task 2.3 — booking detail pricing section`.
10. Do not start the next task. Stop and wait for instruction.

**At the end of a phase**, additionally:

11. All tasks marked `[x]` in the phase task file.
12. All test suites pass. Paste the output into the session log. Do not proceed with any red test.
13. `pnpm typecheck` passes with zero errors.
14. `pnpm lint` passes with zero errors.
15. `SESSION_LOG.md` Current State reflects phase completion.
16. Write a phase retrospective in `docs/phase-N-retro.md`.
17. Review and update `docs/user-journeys.md` per its maintenance rule.
18. Update the status line for the phase in `docs/plan-summary.md`.
19. Wait for instruction before starting the next phase.

If tests fail or an acceptance criterion cannot be met, document the blocker in `SESSION_LOG.md` and stop. Do not work around a failing test by weakening it, skipping it, or narrowing its assertion.

---

## Project reference documents

| Document | Purpose |
|---|---|
| `docs/spec.md` | Product specification. What the product does. |
| `docs/dev-plan.md` | Development plan. Phases, schema, contracts, test strategy. |
| `docs/user-journeys.md` | End-to-end behavior and test coverage mapping. |
| `docs/plan-summary.md` | Phase status at a glance. |
| `tasks/phase-N.md` | Task list for the current phase. Primary instruction source. |
| `SESSION_LOG.md` | Running record of completed work and decisions. |
| `docs/META-PLAN.md` | The human's orchestration guide. Not for you. |

---

## Repository structure

```
sittter/
├── AGENTS.md
├── SESSION_LOG.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── eslint.config.mjs
├── vitest.config.ts                   Unit tests, src/core only
├── vitest.integration.config.ts       Integration tests, real database
├── playwright.config.ts
├── drizzle.config.ts
├── vercel.json                        Cron entry
├── .env.example
│
├── docs/
├── tasks/
├── logs/
├── drizzle/                           Generated migrations. Never hand-edited.
├── scripts/
│   ├── demo.ts
│   └── spike/
├── e2e/
│
└── src/
    ├── core/                          PURE. No imports outside src/core and node built-ins.
    │   ├── types.ts
    │   ├── dates.ts
    │   ├── status.ts
    │   ├── pricing.ts
    │   ├── schedule.ts
    │   ├── digest.ts
    │   ├── slug.ts
    │   └── presentation.ts
    │
    ├── db/
    │   ├── client.ts
    │   ├── schema.ts
    │   ├── seed.ts
    │   └── repositories/
    │       ├── businesses.ts
    │       ├── admins.ts
    │       ├── customers.ts
    │       ├── properties.ts
    │       ├── care-instructions.ts
    │       ├── bookings.ts
    │       ├── visits.ts
    │       ├── visit-logs.ts
    │       ├── photos.ts
    │       ├── activity.ts
    │       ├── links.ts
    │       ├── pricing.ts
    │       ├── weather.ts
    │       └── calendar-events.ts
    │
    ├── services/
    │   ├── auth.ts
    │   ├── links.ts
    │   ├── bookings.ts
    │   ├── visits.ts
    │   ├── storage.ts
    │   ├── calendar.ts
    │   ├── weather.ts
    │   ├── email.ts
    │   └── digest.ts
    │
    ├── emails/
    ├── app/
    │   ├── (admin)/
    │   │   ├── layout.tsx
    │   │   ├── home/page.tsx
    │   │   ├── bookings/page.tsx
    │   │   ├── bookings/[id]/page.tsx
    │   │   ├── customers/page.tsx
    │   │   ├── customers/[id]/page.tsx
    │   │   ├── settings/page.tsx
    │   │   └── actions/
    │   ├── signin/page.tsx
    │   ├── new/page.tsx
    │   ├── s/[slug]/page.tsx
    │   └── api/
    │       ├── cron/daily/route.ts
    │       ├── auth/callback/route.ts
    │       └── photos/[id]/route.ts
    │
    ├── components/
    └── lib/
        ├── env.ts
        ├── session.ts
        └── rate-limit.ts
```

Use these exact paths everywhere: in task files, in session log entries, and in commit messages.

---

## Architectural rules

### `src/core/` is pure and imports nothing that performs input or output

Every module under `src/core/` must be free of side effects. No database access, no `fetch`, no file system access, no logging, no `Date.now()`, no `Math.random()`, no environment variable reads. A function that needs the current date takes it as an argument. A function that needs randomness takes a random source as an argument.

`src/core/` may import only from `src/core/` and from Node built-ins that perform no input or output.

If you find yourself importing `src/db/`, `src/services/`, `drizzle-orm`, `next`, `react`, or any client library into a file under `src/core/`, stop and flag it. The logic you are writing belongs in `src/services/` instead, and the pure part of it belongs in `src/core/`.

This is the most important boundary in the repository. It is enforced by an ESLint `no-restricted-imports` rule. Do not disable that rule, do not add an exception to it, and do not weaken the tests in `src/core/*.test.ts` to accommodate a violation.

### Booking status is derived, never stored

There is no `status` column on `bookings` and there never will be. `deriveStatus()` in `src/core/status.ts` is the single source of truth, computing status from the confirmation flags, the service range, the cancellation and decline timestamps, and today's date.

Every surface that displays a status calls that function. No surface computes it inline, caches it, or persists it.

If a task asks you to add a status column, an enum default, or a cached status field for query performance, stop and flag it.

### Value representation is fixed

**Money is integer cents.** Every currency value is an integer number of cents, in TypeScript, in Postgres, in transport, and in email templates. No floating point arithmetic touches a currency value. Formatting to dollars happens only at the point of display.

**Calendar dates are `date`, not `timestamp`.** A service range, a visit date, a logged date, a paid date, and an observed weather date are calendar dates in `America/New_York`. They have no time component and no timezone. They are represented as `'YYYY-MM-DD'` strings in `src/core/` and as `date` columns in Postgres.

Timestamps with a zone are for events that happened at an instant: `created_at`, `dates_firm_at`, `synced_at`.

If you find yourself converting a calendar date through a `Date` object and back, stop and flag it. That round trip is where timezone bugs come from, and `src/core/dates.ts` exists to avoid it.

### Migrations are the only way to change the schema

The schema is defined in `src/db/schema.ts`. Changes are applied by generating a migration with `pnpm db:generate`, reviewing the generated SQL, and committing it in `drizzle/`.

Never hand-edit a file in `drizzle/`. Never run a `push` command against any database. Never apply a schema change by executing SQL directly.

If a migration generates SQL that looks wrong, stop and flag it rather than editing the output.

### Every database query is scoped by business

Every repository function under `src/db/repositories/` takes a business identifier as an argument and filters on it. There is exactly one business in V1. The discipline is not optional, because retrofitting it later means auditing every query.

Route handlers, server actions, and pages never construct queries directly. All database access goes through `src/db/repositories/`. There is no SQL and no Drizzle query builder call outside that directory.

If you find yourself writing a query in `src/app/` or `src/services/`, stop and flag it. Add a repository function instead.

### Customer surfaces exclude sensitive data at the query layer

The customer portal, the public intake form, and the booking form must never receive `properties.access_codes`, `properties.access_notes`, any row from `activity_entries`, any admin name, or any data belonging to another customer.

This is enforced by selecting explicit columns in the repository functions that serve those surfaces, not by omitting fields from a template. A repository function serving a customer surface names every column it returns.

If you find yourself writing `select()` with no column list in a code path that reaches a customer surface, stop and flag it.

### Each external vendor is imported in exactly one file

| Vendor | The only file that may import it |
|---|---|
| `@vercel/blob` | `src/services/storage.ts` |
| `resend` | `src/services/email.ts` |
| `googleapis` | `src/services/calendar.ts` |
| Open-Meteo HTTP calls | `src/services/weather.ts` |

Everything else calls those modules through their own interfaces. This is what makes the vendors testable with a single fake and replaceable without a refactor.

If a task needs vendor functionality that is not yet exposed by the service module, extend the service module. Do not import the vendor a second time.

### Integrations fail soft and never block a write

Calendar synchronization, weather retrieval, and email delivery must never prevent a core write from succeeding. A booking that cannot reach Google Calendar is still a saved, confirmed booking.

Failures are recorded — in `calendar_events.last_error`, in `email_sends.error` — and retried by the daily job.

If you find yourself putting a calendar call, a weather call, or an email send inside the same transaction as a booking write, stop and flag it.

### Links carry no claims and are resolved server-side

A slug is a five-character opaque lookup key, nothing more. It is not a signed token, it does not encode an identifier, and it does not carry permissions. Access is determined by reading the `links` row server-side and checking `revoked_at` and `expires_at`.

Never put a signed payload, an encoded identifier, or a JWT in a customer-facing URL. Signed payloads cannot be revoked, and revocation is a requirement.

A slug that does not resolve returns the same response whether it never existed, expired, or was revoked.

### The daily job is idempotent and hour-checked

`src/app/api/cron/daily/route.ts` must be safe to run any number of times on the same day. It verifies the `CRON_SECRET` bearer token, checks that the current local hour matches the business's configured digest hour and returns without acting if it does not, and records its send in `digest_sends` so a second run in the same hour sends nothing.

It must complete inside eight seconds with ten active bookings, because the Vercel Hobby function timeout is ten seconds.

If a task would add work to this job that pushes it past that budget, stop and flag it rather than raising the timeout.

### Open questions in the spec are not yours to close

`docs/spec.md` §10 lists questions that were deliberately deferred, each with a review trigger. Build them as specified. Do not resolve them, do not implement a variant you judge better, and do not soften a rule because you encountered its friction while implementing it.

The one most likely to tempt you: §5.5 requires that toggling "Checked the family calendar" be its own isolated submission, not batched with other edits. That is intentional friction and it is under review by the human. Implement it exactly as written.

If you believe an open question should be resolved differently, write the observation in `SESSION_LOG.md` under decisions and stop. Do not change behavior.

### No placeholders, no TODOs, no debug logging in committed code

A committed file contains no `TODO`, no `FIXME`, no `console.log` in a production path, and no placeholder copy such as "Lorem ipsum" or "Coming soon" on any user-facing surface.

Work that is deliberately deferred is recorded in `SESSION_LOG.md`, not in a comment in the code. A user-facing string that has not been written yet is a blocker, not a placeholder.

---

## Patterns established

*This section is empty at the start of the project and is appended to during development. Do not write entries here in advance.*

An entry earns its place when a task discovers something non-obvious: a library API that differs from what you would assume, a test-harness behavior that silently does the wrong thing, or a build or configuration incantation with a non-obvious failure mode. Always include the error message or symptom, because that is what makes the entry findable next time.

Format for each entry:

### [Pattern name]

[What the gotcha is, in one or two sentences.]

```ts
// correct

// wrong — [the exact error message or symptom this produces]
```

Established because: [the concrete failure that motivated it].

---

### typescript-eslint refuses to load against TypeScript 7

`typescript` resolves to 7.x by default. `@typescript-eslint` 8.x will not run against it, and the failure takes down the WHOLE lint run — including the `src/core/` boundary rule — rather than degrading.

```
// wrong — pnpm lint dies before checking anything:
//   Error: typescript-eslint does not support TS 7.0.
//   Please see ... to run typescript-eslint using the TS 6 API.
"typescript": "^7.0.2"

// correct, until typescript-eslint ships TS 7 support
"typescript": "6.0.3"
```

Established because: the boundary rule appeared to pass for several minutes while it was in fact not running at all. The lint rule outranks the compiler version. Re-prove the rule fires after ANY toolchain change.

### A PEM private key in an env file needs literal backslash-n, and unquoted values do not expand

`dotenv` expands `\n` only inside double quotes. A Google service account key pasted unquoted keeps its escapes literal and fails to parse, and the error names nothing that leads back to the cause.

```ts
// wrong — createPrivateKey throws:
//   error:1E08010C:DECODER routines::unsupported
// .env:  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMII...

// correct — quote it, or normalize at the consumer
key.replace(/\\n/g, '\n')
```

Established because: the pre-flight spike lost a cycle to a decoder error that mentions neither the key nor the env file. `src/services/calendar.ts` will need the same normalization in Phase 5.

### pnpm 11 reads build-script approval from pnpm-workspace.yaml, not package.json

The `pnpm.onlyBuiltDependencies` field in `package.json` is ignored. Without approval, esbuild never unpacks, and every `pnpm test:unit` fails inside a pre-flight `pnpm install` — the error names `pnpm install`, not esbuild and not vitest.

```yaml
# correct — pnpm-workspace.yaml
allowBuilds:
  esbuild: true
  unrs-resolver: true

# wrong — silently ignored, then:
#   [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.25.12 ...
#   [ERROR] Command failed with exit code 1: pnpm install
```

Established because: `pnpm typecheck` failed with a stack trace inside pnpm's own bundle, which reads like a broken toolchain rather than a missing two-line config.

### All three test runners exit non-zero on an empty glob

`vitest` and `playwright` treat "no tests" as failure. A phase that legitimately has no tests yet cannot pass its gate without opting out.

```
// wrong — exit 1 during the scaffold gate:
//   No test files found, exiting with code 1
//   Error: No tests found

// correct
passWithNoTests: true          // vitest config
playwright test --pass-with-no-tests
```

Established because: the scaffold gate requires each runner to exit cleanly with zero tests. **This is now a liability:** once a glob matches real files, one broken by a rename passes silently instead of failing. Remove it from a config as soon as that suite has its first test.

### The src/core/ boundary applies to test files too, and that is correct

`src/core/**/*.ts` matches `*.test.ts`. A test that reads its own module's source with `node:fs` is rejected.

```ts
// wrong — the rule fires on the test file itself
import { readFileSync } from 'node:fs'

// correct — assert purity at runtime instead
const dateCtor = globalThis.Date as unknown as { now: () => number }
dateCtor.now = () => { throw new Error('read the clock') }
```

Established because: the first purity test for `dates.ts` needed `node:fs`. Adding a test-file exception to the boundary rule was the tempting fix and would have been the most serious failure available in this project. Reached through a binding so the assertion does not itself trip `no-restricted-properties`.

### obscenity stores parsed patterns, not words

`englishDataset` cannot be enumerated into a word list — `originalWord` is not reachable from `build()`, and the patterns carry wildcards and optional characters. Match candidates against it rather than filtering it.

```ts
// wrong — yields nothing; there are no plain words to filter
[...englishDataset.containers].filter((c) => c.originalWord?.length === 5)

// correct
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
})
matcher.hasMatch(candidate)
```

Established because: `tasks/phase-0.md` Reference data instructs filtering the dataset to five-character entries, which is not possible. The matcher rejects 0.171% of random slugs, so retrying on a hit is cheap. The recommended transformers catch leet-speak, which matters because the slug alphabet contains digits.

### Prove a guard fails before trusting it

Every check added in Phase 0 — the lint boundary rule, and each module's runtime purity test — was made to fail on a deliberate violation before being kept, then the violation was reverted.

```ts
// the discipline, applied to each new guard:
// 1. write the check
// 2. break the thing it guards on purpose
// 3. watch it go red, and read the message
// 4. revert
```

Established because: pinning TypeScript silently disabled the entire lint layer mid-scaffold, and only re-proving the rule caught it. A guard never seen to fail is indistinguishable from one that cannot fail.

### Nothing outside Next.js loads a .env file

`next dev` and `next build` read `.env` automatically. `drizzle-kit`, `tsx`, `vitest`, and Playwright do not, and a missing variable surfaces far from its cause.

```ts
// correct — drizzle.config.ts, src/db/seed.ts
import 'dotenv/config'

// correct — vitest.integration.config.ts, playwright.config.ts
const testEnv = loadEnv({ path: '.env.test' }).parsed ?? {}

// wrong — DATABASE_URL is undefined, and the error names pnpm install:
//   [ERR_PNPM_IGNORED_BUILDS] ... [ERROR] Command failed: pnpm install
```

Established because: `drizzle.config.ts` had been reading `process.env.DATABASE_URL` as `undefined` from the moment it was written, and the failure looked like a driver problem.

### Ignore the whole .env family, not the variants that exist today

`.gitignore` listed `.env` and `.env.local`. `.env.test` was created months later, holds a live Neon connection string, and was one `git add -A` from being committed.

```
# correct
.env
.env.*
!.env.example

# wrong — only covers what existed when it was written
.env
.env.local
```

Established because: a credential was caught by luck rather than by rule. Verify with `git check-ignore -v .env.test`.

### Vite 8 uses oxc, not esbuild, and ignores the old key silently

Vite 8 replaced esbuild for transforms. An `esbuild: {...}` block in a Vitest config has no effect and produces no warning, so a wrong guess looks like the option not working.

```ts
// correct
oxc: { jsx: { runtime: 'automatic' } }

// wrong — silently ignored, and .tsx keeps failing as:
//   Failed to parse source for import analysis because the content
//   contains invalid JS syntax. ... make sure to not set jsx to preserve.
esbuild: { jsx: 'automatic' }
```

Established because: two attempts at a JSX override appeared to do nothing. Note `pnpm build` also rewrites `tsconfig.json`'s `jsx` to `react-jsx` — so tests pass for anyone who has built, and fail on a fresh clone that has not.

### Anything a test asserts on must live in a module with no framework imports

Importing a constant from a React server component pulls its whole import graph into the test process.

```ts
// wrong — Playwright fails before any test runs:
//   Cannot find module '.../node_modules/next/navigation'
import { COPY } from '../src/app/signin/page'

// correct — src/app/signin/copy.ts imports nothing
import { SIGN_IN_COPY } from '../src/app/signin/copy'
```

Established because: copy strings living beside the markup that renders them made the sign-in journey untestable. The copy is better off in its own module regardless.

### An end-to-end test cannot follow a real magic link, and should not try

Only the SHA-256 hash is stored, so there is no way to recover a plaintext token from the database — which is the property the design is aiming for. Reading a real inbox would be slow, flaky, and would send mail on every run.

```ts
// correct — e2e/fixtures.ts plays the role the email plays
const token = randomBytes(32).toString('base64url')
await createMagicLinkToken(businessId, { adminId, tokenHash: hashToken(token), expiresAt })

// and playwright.config.ts starts the server with a key that cannot authenticate,
// so exercising the real form sends nothing:
env: { ...testEnv, RESEND_API_KEY: 'e2e-no-real-sends' }
```

Established because: journey step 8.1.2 exercises the real sign-in form. Without the override, every `pnpm test:e2e` would send a real email. The resulting 401s in the log are the fail-soft rule holding, not a fault.

### Write the session log entry at the end of the session, not at housekeeping

`AGENTS.md` requires both a session entry and a replaced Current State block. Replacing only the Current State loses the reasoning, and the loss is invisible until someone looks for it.

```
// what happened across all five Phase 1 tasks:
//   Current State replaced        ✓
//   session entry added           ✗  — five times, unnoticed
//   gate item ticked anyway       ✗
```

Established because: Phase 1's entries had to be reconstructed from commit messages at housekeeping, and `logs/phase-1.md` now carries a note saying so. Detailed commit messages made the reconstruction faithful — but the gate item claiming a complete entry for every session had already been ticked in error.

---

*This file is version-controlled. Changes to it require a commit with a clear message explaining why the rule changed.*

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
