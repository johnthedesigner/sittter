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

## Tasks — all complete, compressed at the Phase 1 housekeeping session

Full bodies, acceptance criteria, and must-not-do lists are in the git history at commit `6eac75e` and earlier. Session detail is in `logs/phase-1.md`.

### Task 1.1 — Schema, client, and the first migration ✓

**Output:** `src/db/schema.ts` (21 tables, 7 enums, 4 check constraints), `src/db/client.ts`, `src/lib/env.ts`, and `drizzle/0000_foamy_marvel_apes.sql` applied to both Neon branches.
**Key decisions:** The client is lazy so `drizzle-kit` can read the schema without a connection string. `env.ts` validates with zod and names every missing variable. **Two defects found:** `dotenv` was installed but never imported, so `drizzle.config.ts` had been reading `DATABASE_URL` as undefined since it was written; and `.gitignore` did not cover `.env.test`, which holds a live Neon credential — untracked and never committed, and the rule now covers the whole `.env` family.
**Session:** 2026-08-19 — `logs/phase-1.md`

---

### Task 1.2 — Repositories and the seed fixture ✓

**Output:** 15 repository modules, 71 functions, `src/db/seed.ts`, `src/db/testing/database.ts`, and 49 integration tests.
**Key decisions:** 70 of 71 functions take `businessId` first; the exception is `createBusiness`, documented alongside `getOnlyBusiness` as the only two, both bootstrap. The audit caught `findLinkBySlug` and `recordLinkHit` taking a slug and no business — fixed, because "the argument is currently redundant" is exactly the shortcut AGENTS.md warns about. Access codes are excluded at the query layer: `getPropertyForPortal` names its columns and a test asserts the serialized result contains neither the code nor the notes. The seed refuses a non-empty database rather than attempting idempotency. `passWithNoTests` removed from **both** vitest configs.
**Session:** 2026-08-19 — `logs/phase-1.md`

---

### Task 1.3 — The email service and its send log ✓

**Output:** `src/services/email.ts` (the only file importing `resend`), `src/emails/layout.tsx`, `src/emails/magic-link.tsx`, and the shared Resend fake at `src/services/testing/resend-fake.ts`.
**Key decisions:** A send never throws; callers inspect `{ ok, providerId, error, attempts }`. One `email_sends` row per send, not per attempt. Retry is exactly one further attempt, proved by queueing three failures and asserting the provider was called twice. Copy is exported as `MAGIC_LINK_COPY` so the test asserts the strings the template renders. The fake replaces the `resend` module itself, which is what proves the boundary. **Deviation:** the fake lives in `src/services/testing/`, not the `e2e/fixtures.ts` this file originally named — `e2e/` is Playwright's directory.
**Session:** 2026-08-19 — `logs/phase-1.md`

---

### Task 1.4 — Magic link issue and consume ✓

**Output:** `src/services/auth.ts`, `src/lib/session.ts`, and 34 integration tests.
**Key decisions:** Tokens are 32 bytes from `node:crypto`; only SHA-256 hashes are stored, and a test reads every row of both auth tables to assert neither plaintext token appears. Nine failure modes each get their own test, including a token whose admin was deleted since issue — the case most likely to have been an unhandled crash. `issueMagicLink` returns an identical value for registered, unregistered, and delivery-failed. SHA-256 is deliberate: these are 256-bit random tokens, not passwords. The cookie is `sameSite: 'lax'`, not `'strict'`, which would drop it on the navigation from a mail client.
**Session:** 2026-08-19 — `logs/phase-1.md`

---

### Task 1.5 — Sign-in surface and the session guard ✓

**Output:** `/signin`, `/api/auth/callback`, the `(admin)` session guard, the `/home` stub, `e2e/fixtures.ts`, and `e2e/journey-8.spec.ts` covering steps 8.1.1–8.1.6.
**Key decisions:** 8.1.5 submits a registered and an unregistered address through one helper and asserts the rendered text is byte-identical. Copy moved to `src/app/signin/copy.ts` because importing it from `page.tsx` dragged `next/navigation` into the Playwright process. E2E cannot follow a real email by construction, so `e2e/fixtures.ts` mints a link directly and the web server runs with a `RESEND_API_KEY` that cannot authenticate. `pnpm build` rewrote `tsconfig.json`'s `jsx` to `react-jsx` on first run.
**Session:** 2026-08-19 — `logs/phase-1.md`

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
- [x] `SESSION_LOG.md` has a complete entry for every session in this phase — **corrected at housekeeping.** The entries were not written per session; they were reconstructed from commit messages into `logs/phase-1.md`. This box was ticked in error before that was noticed.
- [x] `docs/plan-summary.md` status line updated for Phase 1
- [x] `docs/user-journeys.md` reviewed, coverage table updated with Journey 8
- [x] Phase retrospective written to `docs/phase-1-retro.md`
- [x] Housekeeping session run — 2026-08-19
- [x] `tasks/phase-2.md` generated, reviewed, and committed — 2026-08-19. Seven tasks, not the four to six §3 asks for; the file states why rather than compressing.

---

## Completed task log

*(Tasks are compressed to this format once complete. Full details live in the session log.)*

<!--
### Task 1.X — [Task name] ✓
**Output:** [One sentence: what was built.]
**Key decisions:** [Any non-obvious choices.]
**Session:** [Date / logs pointer]
-->
