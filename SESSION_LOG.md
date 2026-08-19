# Session Log — sittter

## Current State

**Phase:** 1 — Persistence and admin authentication — In progress, 4 of 5 tasks complete
**Next task:** 1.5 — Sign-in surface and the session guard — **the last task in Phase 1**

**What's built in Phase 1:** schema and migration on both Neon branches; 15 repository modules, 71 functions; the seed; the email service and templates; `src/services/auth.ts` and `src/lib/session.ts`.

**Test totals:** 206 unit, 100 integration, 0 e2e.

**What Task 1.5 can rely on:**
- `issueMagicLink(businessId, email, now)` → always `{ requested: true }`, whether or not the address is registered, whether or not delivery succeeded. **The route must return the same response in every case.**
- `consumeMagicLink(businessId, token, now)` → `{ admin, sessionToken } | null`. Null covers expired, consumed, tampered, unknown, wrong business, and admin-since-deleted. **One message for all of them.**
- `verifySession(businessId, sessionToken, now)` → `Admin | null`. Null covers expired and unknown alike.
- `destroySession(businessId, sessionToken)` → boolean.
- `SESSION_COOKIE_NAME`, `SESSION_COOKIE_OPTIONS`, `readSessionCookie`, `writeSessionCookie`, `clearSessionCookie` in `src/lib/session.ts`.
- `getOnlyBusiness()` resolves the V1 business, which every call above needs first.

**Notes for Task 1.5:**
- The cookie is `sameSite: 'lax'` deliberately. `'strict'` drops the cookie on the cross-site navigation from a mail client, and sign-in would appear to silently fail.
- `e2e/fixtures.ts` is created in this task — it was deferred from 1.3 because `e2e/` is Playwright's directory and the Vitest vendor fake lives at `src/services/testing/resend-fake.ts` instead.
- `pnpm build` is a Task 1.5 criterion and has not been run yet in this project. Budget for first-build surprises.
- Playwright will need the app running and a seeded database. The `main` branch is seeded; the admin address is `jlivornese@gmail.com`.

**Database:** one Neon project, two branches. `main` (`.env`, seeded) for development; `test` (`.env.test`) for integration tests. `src/db/testing/database.ts` refuses any other target.

**Open decisions the human owns.** None block Phase 1. Recommendations in `docs/phase-0-retro.md`: the `src/core/` import rule versus `obscenity`; the Vercel cron schedule; the TypeScript 6 pin; `docs/spec.md` §5.12 and two-step calendar onboarding; and the `photos/[id]/route.ts` discrepancy between AGENTS.md and `docs/dev-plan.md` §3.

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
