# Session Log — sittter

## Current State

**Phase:** 2 — Admin surface — **COMPLETE, 2026-08-19.** Retrospective in `docs/phase-2-retro.md`.
**Next phase:** 3 — Links and customer surfaces. **Not started.**

**What's built:** `src/core/` complete; the schema on Neon; 15 repository modules; magic-link auth; and the full admin surface — `/home`, `/bookings`, `/bookings/new`, `/bookings/[id]`, `/customers`, `/customers/[id]`, `/settings`.

**Tests:** 220 unit, 190 integration, 77 end-to-end. `pnpm build`, `typecheck`, `lint`, `prettier` all pass.

**Phase 2 gate: one item outstanding.**

1. **THE THIRTY-SECOND CAPTURE MEASUREMENT — the human's, on a real phone. STILL OUTSTANDING.** `docs/META-PLAN.md` §6 calls it the single most important measurement in the project. `/bookings/new` is the surface — **admin-only**, behind the session guard; the customer intake forms are `/new` and `/s/[slug]` in Phase 3. A miss is a **product finding**: the fix belongs in `docs/spec.md` §5.1 before it belongs in code.
2. ~~The `docs/spec.md` §10 evaluation~~ — **SETTLED 2026-08-20: the rule stands as written.** Recorded in `docs/spec.md` §10, and the "Under review" note in §5.5 replaced.
3. ~~Housekeeping session~~ — run 2026-08-20.
4. **`tasks/phase-3.md`** — not yet generated.

**An observation the human raised, not yet acted on:** `docs/spec.md` §5.1 sets a thirty-second acceptance target for the ADMIN capture, but §5.2 (public intake) and §5.3 (pre-addressed booking form) set **no time target at all** — and a customer who abandons a form is a lost booking, while a slow admin is mildly annoyed. Worth deciding before Phase 3 plans those surfaces. Not resolved here.

**Decisions the human owns**, in `docs/phase-2-retro.md` with recommendations: `resolveEffectiveInstructions` placement; the absent `visits.created_by` column; plus the five carried from Phase 0.

**A development detail worth knowing: `pnpm dev:signin <email>` mints a sign-in link for a seeded admin.** The seeded co-administrator is at `co-admin+sittter@example.com`, which can never receive email, and Resend's shared sender only delivers to the address owning the API key — so switching admins to evaluate anything needing two of them is otherwise impossible until a domain is verified in Phase 7. **Before Phase 7, the seed's second admin address should become a real inbox.**

**Database:** one Neon project, two branches. `main` (`.env`, seeded); `test` (`.env.test`). Playwright runs a production build on **:3100** with `workers: 1`; the full e2e suite takes about five minutes and the integration suite about two.

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11 on Vite 8.2.1, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2, Neon Postgres.

**Open questions in the spec:** the three deferred items in `docs/spec.md` §10 remain open. One of them is now evaluable — see gate item 2.

---

## Session entries


Phase 2 session entries archived to `logs/phase-2.md`.

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
