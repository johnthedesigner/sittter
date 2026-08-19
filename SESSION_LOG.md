# Session Log — sittter

## Current State

**Phase:** 1 — Persistence and admin authentication — In progress, 3 of 5 tasks complete
**Next task:** 1.4 — Magic link issue and consume

**What's built in Phase 1:** schema and migration on both Neon branches; 15 repository modules, 71 functions; `src/db/seed.ts`; `src/services/email.ts`; `src/emails/layout.tsx` and `magic-link.tsx`; the shared Resend fake.

**Test totals:** 206 unit, 66 integration, 0 e2e.

**What Task 1.4 can rely on:**
- `sendEmail(businessId, { kind, to, subject, body })` returns `{ ok, providerId, error, attempts }` and **never throws**. It retries exactly once and writes one `email_sends` row describing the final outcome.
- `MagicLinkEmail({ signInUrl })` and `MAGIC_LINK_COPY` — the copy is exported from the template so a test asserts the same strings the template renders.
- `findAdminByEmail(businessId, email)` is case-insensitive and returns null for an unregistered address.
- Auth repository functions exist and are tested: `createMagicLinkToken`, `findLiveMagicLinkToken`, `consumeMagicLinkToken`, `createSession`, `findSession`, `deleteSession`. Each takes `businessId` first and joins through `admins` to enforce it. **Expiry is deliberately not checked in the repository** — the caller compares against an instant it is given, so Task 1.4 can test expiry without waiting.

**A deviation from `tasks/phase-1.md` worth knowing:** the task listed `e2e/fixtures.ts` as the home for the shared vendor fake. It lives at `src/services/testing/resend-fake.ts` instead — `e2e/` is Playwright's directory and a Vitest module mock does not belong there. `e2e/fixtures.ts` is created in Task 1.5, where Playwright actually needs it; writing it empty now would have been a placeholder, which AGENTS.md forbids. The substance of the requirement — the vendor faked once, in a shared fixture, not inline per test — is met.

**Vitest needed a JSX transform override.** `tsconfig.json` sets `jsx: "preserve"` because Next requires it, and Vite 8 reads that directly, failing on `.tsx` with "content contains invalid JS syntax". `vitest.integration.config.ts` now sets `oxc: { jsx: { runtime: 'automatic' } }`. Note the option is `oxc`, not `esbuild` — Vite 8 replaced esbuild with oxc and silently ignores the old key.

**Database:** one Neon project, two branches. `main` (`.env`, seeded) for development; `test` (`.env.test`) for integration tests. `src/db/testing/database.ts` refuses any other target.

**`EMAIL_FROM` is `onboarding@resend.dev`.** Resend's shared sender only delivers to the address owning the API key, so the seeded admin is `jlivornese@gmail.com`. A magic link addressed anywhere else silently never arrives — which will matter when Task 1.5 is exercised by hand.

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
