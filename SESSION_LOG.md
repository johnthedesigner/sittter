# Session Log — sittter

## Current State

**Phase:** 1 — Persistence and admin authentication — In progress, 1 of 5 tasks complete
**Next task:** 1.2 — Repositories and the seed fixture

**What's built in Phase 1:** `src/db/schema.ts` (21 tables, 7 enums, 4 check constraints), `src/db/client.ts`, `src/lib/env.ts`, and `drizzle/0000_foamy_marvel_apes.sql` applied to Neon.

**Database — decided 2026-08-19, one Neon project with two branches:**

| Branch | Endpoint | Used by | Configured in |
|---|---|---|---|
| `main` | `ep-divine-wave-…us-east-2` | development, `pnpm db:migrate`, `pnpm db:seed` | `.env` |
| `test` | `ep-sweet-morning-…-pooler.us-east-2` | integration tests | `.env.test` |

Rationale: a Neon branch is a copy-on-write clone with its own compute endpoint, so integration tests that truncate tables cannot reach development seed data, and the test branch can be reset to its parent instantly. Two databases inside one branch would share a compute and a connection ceiling; two projects would add credentials without adding isolation. Branch-per-run is also the shape CI uses, so the pattern extends rather than gets rewritten.

**Both branches use `DATABASE_URL` under the same name, in different env files.** `docs/dev-plan.md` §4 lists only `DATABASE_URL` and says every variable appears in `.env.example`; introducing `DATABASE_URL_TEST` would have changed that list. `.env.test` carries the test branch instead, which Task 1.2 must load in `vitest.integration.config.ts`.

**Neon Auth is deliberately OFF.** It provisions its own schema outside the migration chain, which AGENTS.md forbids; `docs/spec.md` §6.2 already specifies email magic link with `admins`, `magic_link_tokens`, and `sessions` defined in dev-plan §5; and customers never sign in, so there is no second surface to justify the vendor. Turning it on later is a spec change, not an implementation choice.

**Two things Task 1.2 must carry:**
- **`.env` is not loaded automatically outside Next.js.** `drizzle-kit`, `tsx`, and `vitest` all see an empty `process.env` without help. `drizzle.config.ts` now does `import 'dotenv/config'`. `pnpm db:seed` and the integration config will each need the same, and the integration config must load `.env.test` rather than `.env`.
- `passWithNoTests` comes out of `vitest.integration.config.ts`, and repositories serving customer surfaces must name every column they return.

**`EMAIL_FROM` is `onboarding@resend.dev`.** Resend's shared sender only delivers to the address that owns the API key, so seeded admin emails must use that address or no magic link will arrive in Task 1.5.

**Open decisions the human owns.** None block Phase 1. Recommendations in `docs/phase-0-retro.md`: the `src/core/` import rule versus `obscenity`; the Vercel cron schedule; the TypeScript 6 pin; `docs/spec.md` §5.12 and two-step calendar onboarding; and the `photos/[id]/route.ts` discrepancy between AGENTS.md and `docs/dev-plan.md` §3.

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2, drizzle-kit 0.31.10, Neon Postgres.

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
