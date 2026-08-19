# Session Log — sittter

## Current State

**Phase:** 1 — Persistence and admin authentication — **COMPLETE, 2026-08-19.** Retrospective in `docs/phase-1-retro.md`.
**Next phase:** 2 — Admin surface. **Not started.**

**What's built:** `src/core/` complete; 21 tables on Neon with one migration; 15 repository modules and 71 functions, every one scoped by business; the seed; the email service and templates; magic-link authentication and session lifecycle; `/signin`, `/api/auth/callback`, the `(admin)` session guard, and a `/home` stub rendering the signed-in admin's name.

**Tests:** 206 unit, 100 integration, 11 end-to-end. `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `prettier --check` all pass.

**Phase 1 gate: closed except two items.**

1. **Housekeeping session** — `docs/META-PLAN.md` §8. Not yet run for Phase 1.
2. **`tasks/phase-2.md`** — `docs/META-PLAN.md` §3, a dedicated planning session in this repository that writes the task file and no application code.

**One small thing for the human:** read the session cookie's attributes off a real response by hand. They are asserted against the object the writer passes, so they cannot drift — but the phase gate asks for a human to look, and that has not been done.

**Carried into Phase 2, from `docs/phase-1-retro.md`:**
- The **thirty-second capture target** is measured on a real phone. META-PLAN §6 calls it the single most important measurement in the project, and a miss is a product finding belonging in `docs/spec.md` §5.1, not a performance bug.
- The **`docs/spec.md` §10 open question** about the isolated availability-check submission gets its first live evaluation. Build it as specified; decide afterwards.
- `requireAdmin()` in `src/app/(admin)/layout.tsx` is how every admin page gets the acting admin, which Phase 2 records on every state change.

**Open decisions the human owns.** None blocked Phase 1. Recommendations in `docs/phase-0-retro.md`: the `src/core/` import rule versus `obscenity`; the Vercel cron schedule; the TypeScript 6 pin; `docs/spec.md` §5.12 and two-step calendar onboarding; and the `photos/[id]/route.ts` discrepancy between AGENTS.md and `docs/dev-plan.md` §3.

**Database:** one Neon project, two branches. `main` (`.env`, seeded) for development; `test` (`.env.test`) for integration and end-to-end tests. `src/db/testing/database.ts` refuses any other target. Playwright starts the dev server against the test branch with a `RESEND_API_KEY` that cannot authenticate, so `pnpm test:e2e` sends no real mail.

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11 on Vite 8.2.1, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2, Neon Postgres.

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
