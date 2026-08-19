# Session Log — sittter

## Current State

**Phase:** 1 — Persistence and admin authentication — In progress, 2 of 5 tasks complete
**Next task:** 1.3 — The email service and its send log

**What's built in Phase 1:** the schema and first migration applied to both Neon branches; 15 repository modules with 71 functions; `src/db/seed.ts`; `src/db/testing/database.ts`; 49 integration tests.

**Test totals:** 206 unit, 49 integration, 0 e2e. `passWithNoTests` is now gone from **both** vitest configs, so a glob broken by a rename fails instead of passing silently.

**Database:** one Neon project, two branches. `main` (`.env`, seeded) for development; `test` (`.env.test`) for integration tests, truncated before every test. `src/db/testing/database.ts` refuses to run against anything but the test branch, because these tests truncate all 21 tables and the first symptom of a wrong target would be a confusing empty screen rather than an error.

**What Task 1.3 can rely on:**
- `recordEmailSend(businessId, { kind, recipient, subject, providerId, error })` and `listEmailSends(businessId)` exist and are tested, including the failure shape where `error` is set and `providerId` is null.
- `findAdminByEmail(businessId, email)` is case-insensitive and returns null for an unregistered address rather than throwing — the caller must not let that difference reach a user.
- The seeded admin is `jlivornese@gmail.com`. `EMAIL_FROM` is `onboarding@resend.dev`, and Resend's shared sender only delivers to the address owning the API key, so a magic link addressed anywhere else silently never arrives.

**Two things Task 1.3 must do that this task set up:**
- **Load `.env` explicitly.** Nothing outside Next.js does. `drizzle.config.ts` uses `import 'dotenv/config'`, `src/db/seed.ts` imports it in `main()`, and `vitest.integration.config.ts` reads `.env.test` and passes it through `test.env`. A new script or config needs the same.
- **Fake Resend at the module boundary, once, in a shared fixture** — `e2e/fixtures.ts` per the task file. No inline per-test fakes.

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
