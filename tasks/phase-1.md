# Phase 1 — Persistence and admin authentication

> **Status:** Not started
> **Depends on:** Phase 0 complete (all tasks marked `[x]`, all tests passing, gate closed 2026-08-19)
> **Reference:** `docs/dev-plan.md` § Phase 1 — Persistence and admin authentication

---

## Overview

The schema exists, repositories become the only path to the database, and an admin can sign in with a magic link. Email sending is built here because magic links need it, which puts the email service and its send log in place before any feature depends on them. The phase ends with one stub page rendering the signed-in admin's name, proving the whole chain from cookie to database works.

**What this phase does not change:** no booking interface, no customer surfaces, no links or slug resolution, no calendar, no photos, no weather, no digest. Nothing under `src/core/` is modified — it is complete and is consumed, not extended. `src/app/` gains only `/signin`, `/api/auth/callback`, the `(admin)` layout guard, and `/home`.

**Done means:** an admin enters their email on a real page, receives a real email, follows the link, lands on `/home`, sees their own name, closes the browser, returns, and is still signed in. Every one of those steps is covered by a test.

---

## Reference data

Resolved during planning. No task should invent these.

### Environment variables introduced

From `docs/dev-plan.md` §4. All five are already present in `.env.example`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `SESSION_SECRET` | HMAC key for session cookie signing |
| `APP_URL` | Absolute base URL, no trailing slash, used to build links in emails |
| `RESEND_API_KEY` | Email delivery |
| `EMAIL_FROM` | Verified sender address |

`APP_TIMEZONE` and `NODE_ENV` already exist and are unchanged.

### Token and session parameters

| Value | Setting | Why |
|---|---|---|
| Magic link token lifetime | 15 minutes | Short. An email sitting in an inbox is the exposure. |
| Magic link token | 32 random bytes, base64url | Generated with `node:crypto` `randomBytes`. Never `Math.random()`. |
| Token storage | SHA-256 hash in `magic_link_tokens.token_hash` | The plaintext token exists only in the emailed URL. A database leak must not yield working links. |
| Token reuse | Single use — `consumed_at` set on first successful consumption | Journey step 8.1.4. |
| Session lifetime | 90 days | Spec §6.2: "Sessions are long-lived so that a phone stays signed in." Journey step 8.1.6. |
| Session token | 32 random bytes, base64url, SHA-256 hashed in `sessions.token_hash` | Same reasoning as above. |
| Cookie name | `sittter_session` | |
| Cookie attributes | `httpOnly`, `secure`, `sameSite: 'lax'`, `path: '/'`, `maxAge` 90 days | `secure` is set in all environments; local development runs over `http://localhost`, which browsers exempt. `lax` rather than `strict` so following the emailed link carries the cookie. |

### Sign-in copy

Exact strings. No placeholder text reaches a surface.

| Surface | String |
|---|---|
| Sign-in page heading | `Sign in` |
| Sign-in page email label | `Email address` |
| Sign-in submit button | `Send me a link` |
| Post-submit message — **always shown, registered or not** | `If that address belongs to an admin, a sign-in link is on its way. It expires in 15 minutes.` |
| Invalid or expired link page | `That sign-in link is no longer valid. Links expire after 15 minutes and can only be used once.` |
| Invalid link page action | `Request a new link` |

The post-submit message is deliberately identical whether or not the address is registered. Journey step 8.1.5 requires that an unregistered address produce the same response and no email.

### Magic link email

| Field | Value |
|---|---|
| `email_sends.kind` | `magic_link` |
| Subject | `Your sittter sign-in link` |
| Body — first line | `Tap the button below to sign in. The link expires in 15 minutes and works once.` |
| Button label | `Sign in to sittter` |
| Footer | `If you didn't ask for this, you can ignore it — nothing will happen.` |

### Seed fixture

`docs/dev-plan.md` § Phase 1 specifies one business, two admins, two customers, and three bookings in different states. The three states are chosen to exercise `deriveStatus` across its branches:

| Booking | Shape | Derives |
|---|---|---|
| 1 | Both flags set, range starts in 5 days | `confirmed` |
| 2 | `datesFirmAt` set, `availabilityCheckedAt` null, range in 3 weeks | `tentative` |
| 3 | No start or end date | `inquiry` |

Seed data is deterministic: fixed identifiers, fixed dates relative to a date passed into the seed function, never `Date.now()` inside the fixture definitions.

### Repository conventions

Every repository function takes `businessId` as its **first** argument, without exception, including single-row reads by primary key. `docs/dev-plan.md` §5 and AGENTS.md both make this non-negotiable, and a uniform position makes a violation visible on sight rather than requiring the signature to be read.

---

## Tasks

### Task 1.1 — Schema, client, and the first migration

> **Status:** `[x]` Complete
> **Session:** 2026-08-19 — see `SESSION_LOG.md`
> **Depends on:** none

**What this task implements:**
Every table from `docs/dev-plan.md` §5 as Drizzle definitions, the database client, and the first generated migration reviewed and committed. After this task the database exists and is empty.

**Files to create or modify:**
- `src/db/schema.ts` — all 21 tables from `docs/dev-plan.md` §5
- `src/db/client.ts` — a single Drizzle client instance over `@neondatabase/serverless`
- `src/lib/env.ts` — parsed and validated environment, using `zod`, failing loudly at startup on a missing variable
- `drizzle/` — the generated migration, reviewed, never hand-edited
- `.env.example` — no change expected; confirm it already covers this task's variables

**Journey steps enabled:** none — no user-facing surface.

**Acceptance criteria:**
- [x] Every table in `docs/dev-plan.md` §5 exists in `src/db/schema.ts` with matching column names, types, nullability, defaults, and unique constraints
- [x] Every money column is an integer type; no `numeric`, `real`, or `float` column holds a currency value
- [x] Every calendar date column is `date`; every instant column is `timestamptz`. Specifically: `bookings.start_date`, `bookings.end_date`, `bookings.paid_at`, `visits.date`, `visit_logs.logged_date`, `observed_weather.observed_date`, and `digest_sends.send_date` are `date`, while `created_at`, `dates_firm_at`, and `synced_at` are `timestamptz`
- [x] `pnpm db:generate` produces a migration, and the generated SQL is read and confirmed to match the schema before committing
- [x] `pnpm db:migrate` applies cleanly to an empty database
- [x] Applying the migration twice is safe — the second run reports nothing to apply rather than failing
- [x] `src/lib/env.ts` throws a named error listing the missing variable when `DATABASE_URL` is absent, rather than failing later with a connection error
- [x] No file in `drizzle/` has been hand-edited
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [x] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- Does not write any repository function — that is Task 1.2
- Does not run any `push` command against any database, in any environment
- Does not hand-edit generated SQL; if the output looks wrong, stop and flag it
- Does not add a `status` column to `bookings`, now or ever
- Does not seed any data — that is Task 1.2

---

### Task 1.2 — Repositories and the seed fixture

> **Status:** `[x]` Complete
> **Session:** 2026-08-19 — see `SESSION_LOG.md`
> **Depends on:** Task 1.1

**What this task implements:**
A repository module per table, each function scoped by business, plus a deterministic seed fixture. After this task the database is the only thing that holds state and repositories are the only way to reach it.

**Files to create or modify:**
- `src/db/repositories/*.ts` — one module per table group, per the structure in `AGENTS.md`
- `src/db/seed.ts` — one business, two admins, two customers, three bookings per Reference data
- `src/db/repositories/*.test.ts` — integration tests against a real database
- `vitest.integration.config.ts` — remove `passWithNoTests`; this suite now has tests, and a glob broken by a rename must fail rather than pass silently

**Journey steps enabled:** none — no user-facing surface.

**Acceptance criteria:**
- [x] Every repository function takes `businessId` as its first argument, including single-row reads by primary key
- [x] Every write function has a test that reads the row back and asserts the persisted values, not merely the return value
- [x] Every read function has a test that seeds a **second** business and asserts the function does not return its rows
- [x] A repository serving a customer surface names every column it returns; `select()` with no column list does not appear in any function reachable from the customer portal, the intake form, or the booking form
- [x] `pnpm db:seed` runs against an empty database and produces exactly one business, two admins, two customers, and three bookings
- [x] `pnpm db:seed` is idempotent, or fails loudly on a non-empty database — state which, and test it
- [x] The three seeded bookings derive `confirmed`, `tentative`, and `inquiry` respectively when passed to `deriveStatus` with the seed's reference date
- [x] `grep` for `drizzle-orm` outside `src/db/` returns nothing but `drizzle.config.ts`
- [x] `passWithNoTests` removed from `vitest.integration.config.ts`, and `pnpm test:integration` fails if the glob matches nothing
- [x] Tests pass: `pnpm test:unit`, `pnpm test:integration`
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [x] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- Does not write any service, route handler, or page
- Does not put business logic in a repository; a repository reads and writes rows
- Does not import `drizzle-orm` anywhere outside `src/db/`
- Does not use `Date.now()` inside a seed fixture definition; the seed takes a reference date as an argument

---

### Task 1.3 — The email service and its send log

> **Status:** `[x]` Complete
> **Session:** 2026-08-19 — see `SESSION_LOG.md`
> **Depends on:** Task 1.2

**What this task implements:**
`src/services/email.ts` — the only file in the repository that imports `resend` — with logging to `email_sends` and one retry. Built before authentication because the magic link depends on it.

**Files to create or modify:**
- `src/services/email.ts` — `send`, logging, retry-once
- `src/emails/layout.tsx` — shared email shell
- `src/emails/magic-link.tsx` — per the Reference data copy
- `src/services/email.test.ts` — integration tests with Resend faked at the module boundary
- ~~`e2e/fixtures.ts`~~ → `src/services/testing/resend-fake.ts` — the shared vendor fake. `e2e/` is Playwright's directory and a Vitest module mock does not belong there; `e2e/fixtures.ts` is created in Task 1.5 when Playwright actually needs it. Writing it empty now would be a placeholder, which AGENTS.md forbids.

**Journey steps enabled:** none directly — this is what makes 8.1.2 possible in Task 1.4.

**Acceptance criteria:**
- [x] `src/services/email.ts` is the only file importing `resend`; `grep` confirms it
- [x] A successful send writes an `email_sends` row with `kind`, `recipient`, `subject`, and the provider's identifier
- [x] A failed send writes an `email_sends` row with `error` populated and `provider_id` null
- [x] A failed send is retried exactly once, and a test asserts the provider was called twice
- [x] A send that fails twice does **not** throw to its caller; it returns a result the caller can inspect
- [x] The magic link email renders with every string from the Reference data table, asserted exactly
- [x] The rendered email contains an absolute URL built from `APP_URL`, with no trailing double slash
- [x] The Resend fake is defined once, in a shared fixture, not inline per test
- [x] Tests pass: `pnpm test:unit`, `pnpm test:integration`
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [x] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- Does not import `resend` anywhere else, now or later
- Does not send a real email from a test
- Does not write any other email template — the remaining templates belong to Phases 2 through 6
- Does not implement the retry as an unbounded loop; exactly one retry

---

### Task 1.4 — Magic link issue and consume

> **Status:** `[x]` Complete
> **Session:** 2026-08-19 — see `SESSION_LOG.md`
> **Depends on:** Task 1.3

**What this task implements:**
`src/services/auth.ts` — issuing a magic link, consuming it, creating a session, and verifying a session. This is the security-critical task of the phase and every failure mode is tested explicitly.

**Files to create or modify:**
- `src/services/auth.ts` — `issueMagicLink`, `consumeMagicLink`, `createSession`, `verifySession`, `destroySession`
- `src/lib/session.ts` — cookie read and write, per the Reference data attributes
- `src/services/auth.test.ts` — integration tests

**Journey steps enabled:** none directly — 8.1.2 through 8.1.5 become testable end to end in Task 1.5.

**Acceptance criteria:**
- [x] Tokens are generated with `node:crypto` `randomBytes`, 32 bytes, base64url encoded; `Math.random()` appears nowhere in the auth path
- [x] Only a SHA-256 hash is stored; a test asserts the plaintext token does not appear in any column of `magic_link_tokens` or `sessions`
- [x] An expired token fails closed — a test advances past 15 minutes and asserts consumption fails
- [x] A consumed token fails on second use — a test consumes twice and asserts the second attempt fails (journey step 8.1.4)
- [x] A token for an email that is not a registered admin is never issued, and `issueMagicLink` returns the same result shape as a successful issue so the caller cannot leak the difference (journey step 8.1.5)
- [x] A token belonging to a deleted admin fails closed rather than throwing
- [x] A tampered token — a valid-looking string that hashes to nothing stored — fails closed
- [x] `verifySession` rejects an expired session, and a test asserts it
- [x] The session cookie is `httpOnly`, `secure`, and `sameSite: 'lax'`, asserted in a test rather than read off the source
- [x] `consumeMagicLink` sets `admins.last_seen_at`
- [x] Every function takes the current instant as an argument rather than reading a clock, so expiry is testable without waiting
- [x] Tests pass: `pnpm test:unit`, `pnpm test:integration`
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [x] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- Does not build any page or route handler — that is Task 1.5
- Does not put a signed payload, an encoded identifier, or a JWT in the link; the token is an opaque lookup key resolved server-side
- Does not reveal, in any return value or error, whether an email address is registered
- Does not write SQL or call the Drizzle query builder; all database access goes through `src/db/repositories/`

---

### Task 1.5 — Sign-in surface and the session guard

> **Status:** `[x]` Complete
> **Session:** 2026-08-19 — see `SESSION_LOG.md`
> **Depends on:** Task 1.4

**What this task implements:**
The pages and route handler that make signing in real, the layout guard that protects admin routes, and one stub page rendering the signed-in admin's name. This is the task that proves the chain from cookie to database.

**Files to create or modify:**
- `src/app/signin/page.tsx` — the sign-in form, per the Reference data copy
- `src/app/(admin)/actions/auth.ts` — the server action that requests a link
- `src/app/api/auth/callback/route.ts` — consumes the token, sets the cookie, redirects
- `src/app/(admin)/layout.tsx` — session guard, redirecting to `/signin` when absent or expired
- `src/app/(admin)/home/page.tsx` — the stub, rendering the signed-in admin's name
- `src/app/layout.tsx`, `src/app/page.tsx` — root shell and a redirect to `/home`
- `e2e/journey-8.spec.ts` — Journey 8, citing step range 8.1.1–8.1.6 in a header comment
- `docs/user-journeys.md` — coverage table updated

**Journey steps enabled:** 8.1.1, 8.1.2, 8.1.3, 8.1.4, 8.1.5, 8.1.6.

**Acceptance criteria:**
- [x] 8.1.1 — visiting the app signed out loads the sign-in page
- [x] 8.1.2 — submitting a registered email shows the exact Reference data message and does not confirm registration
- [x] 8.1.3 — following the emailed link creates a session and loads `/home`, which renders the signed-in admin's **name**, taken from the database rather than the cookie
- [x] 8.1.4 — following the same link a second time shows the invalid-link page with its exact copy
- [x] 8.1.5 — submitting an unregistered email shows the **same** message as 8.1.2, and a test asserts no `email_sends` row was written
- [x] 8.1.6 — a request carrying a valid session cookie loads `/home` without a new sign-in
- [x] Visiting any `(admin)` route without a session redirects to `/signin`, asserted for `/home` specifically
- [x] Visiting an `(admin)` route with an expired session redirects to `/signin` rather than erroring
- [x] The route handler and server action are thin: no SQL, no Drizzle call, no business logic that belongs in `src/services/`
- [x] Every user-facing string matches the Reference data exactly; no placeholder copy appears on any surface
- [x] `pnpm build` succeeds
- [x] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [x] `docs/user-journeys.md` coverage table updated with the Journey 8 row
- [x] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- Does not build any booking, customer, or settings interface; `/home` renders a name and nothing else
- Does not style beyond what is needed to read the page; the visual design pass is Phase 7
- Does not write SQL or call the Drizzle query builder outside `src/db/repositories/`
- Does not add a "remember me" option, a password fallback, or a second authentication method
- Does not reveal whether an email address is registered, on any surface or in any status code

---

## Phase completion checklist

- [x] All tasks above marked `[x]`
- [x] `pnpm test:unit` passes with zero failures — 206 tests
- [x] `pnpm test:integration` passes with zero failures — 100 tests
- [x] `pnpm test:e2e` passes with zero failures — 11 tests
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [x] **Review gate:** no SQL or Drizzle query builder call outside `src/db/` — grepped, none. The only `@/db/` imports in `src/app/` are repository calls, which is the permitted path.
- [x] **Review gate:** every repository function takes a business identifier — 70 of 71; the exception is `createBusiness`, which creates the business, documented in `businesses.ts` alongside `getOnlyBusiness`.
- [x] **Review gate:** an expired magic link token fails closed — asserted at one millisecond before expiry, exactly at expiry, and after, plus end to end through the UI.
- [x] **Review gate:** a consumed token fails on second use — asserted in integration and again in `e2e/journey-8.spec.ts` 8.1.4, including that no second session row is created.
- [x] **Review gate:** the session cookie is `httpOnly`, `secure`, `sameSite: 'lax'` — asserted against the object the writer passes. **Still worth reading off a real response by hand.**
- [x] `SESSION_LOG.md` has a complete entry for every session in this phase
- [x] `docs/plan-summary.md` status line updated for Phase 1
- [x] `docs/user-journeys.md` reviewed, coverage table updated with Journey 8
- [x] Phase retrospective written to `docs/phase-1-retro.md`
- [ ] Housekeeping session run
- [ ] `tasks/phase-2.md` generated, reviewed, and committed

---

## Completed task log

*(Tasks are compressed to this format once complete. Full details live in the session log.)*

<!--
### Task 1.X — [Task name] ✓
**Output:** [One sentence: what was built.]
**Key decisions:** [Any non-obvious choices.]
**Session:** [Date / logs pointer]
-->
