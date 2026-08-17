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

*This file is version-controlled. Changes to it require a commit with a clear message explaining why the rule changed.*
