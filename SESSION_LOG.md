# Session Log — sittter

## Current State

**Phase:** 1 — Persistence and admin authentication — In progress
**Current task:** 1.1 — Schema, client, and the first migration — **BLOCKED, 2 of 11 acceptance criteria unverifiable. Not marked complete.**

**What's built in Phase 1 so far:** `src/db/schema.ts` (all 21 tables, 7 enums, 4 check constraints), `src/db/client.ts`, `src/lib/env.ts`, and the first generated migration at `drizzle/0000_foamy_marvel_apes.sql`.

### The blocker — a Neon database is needed

Two Task 1.1 criteria cannot be verified without one:

- `pnpm db:migrate` applies cleanly to an empty database
- Applying the migration twice is safe

`drizzle-kit` selects the `@neondatabase/serverless` driver because it is installed, and that driver reaches Neon over a websocket only:

```
Warning  '@neondatabase/serverless' can only connect to remote Neon/Vercel
Postgres/Supabase instances through a websocket
```

A local Postgres 18.3 is running on this machine and the generated SQL was applied to a scratch database directly, which proves the SQL is valid but is **not** the same check — it exercises neither `drizzle-kit migrate` nor the journal that makes a second run a no-op.

**What the human needs to do:** provision a Neon database and put its connection string in `.env` as `DATABASE_URL`. Free tier is sufficient. Everything else in Task 1.1 is done and verified.

**What was verified against real Postgres**, by applying `drizzle/0000_foamy_marvel_apes.sql` to a scratch database and then dropping it:

| Check | Result |
|---|---|
| Tables created | 21 — matches `docs/dev-plan.md` §5 exactly |
| Enums created | 7 |
| `range_ordered` rejects an inverted service range | PASS |
| `one_owner` rejects a care instruction with neither owner | PASS |
| `has_subject` rejects an activity entry with no subject | PASS |
| `admins` `(business_id, email)` uniqueness | PASS |
| Every `%cents%` column is `integer` | PASS |
| Every calendar-date column is `date` | PASS |
| No `status` column on `bookings` | PASS |
| Foreign keys emitted after all tables, resolving the `care_instructions` → `bookings` cycle | PASS |
| `src/lib/env.ts` names every missing variable rather than failing later | PASS |

`pnpm typecheck`, `pnpm lint`, all three test runners, and `prettier --check` pass.

**Note for whoever provisions the database:** Task 1.2's integration tests will need one too, and running them against the same database as development will destroy seed data. Decide then whether that is a second Neon database or a branch.

**Open decisions the human owns.** None block Phase 1. All five are set out with recommendations in `docs/phase-0-retro.md`: the `src/core/` import rule versus `obscenity`; the Vercel cron schedule; the TypeScript 6 pin; `docs/spec.md` §5.12 and two-step calendar onboarding; and the `photos/[id]/route.ts` discrepancy between AGENTS.md and `docs/dev-plan.md` §3.

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2, drizzle-kit 0.31.10.

**Open questions in the spec:** the three deferred items in `docs/spec.md` §10 remain open and are not to be resolved during implementation.

---

## Session entries

Phase 0 session entries archived to `logs/phase-0.md`.

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
