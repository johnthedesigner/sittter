# Session Log — sittter

## Current State

**Phase:** 2 — Admin surface — **COMPLETE, 2026-08-19.** Retrospective in `docs/phase-2-retro.md`.
**Next phase:** 3 — Links and customer surfaces. **Not started.**

**What's built:** `src/core/` complete; the schema on Neon; 15 repository modules; magic-link auth; and the full admin surface — `/home`, `/bookings`, `/bookings/new`, `/bookings/[id]`, `/customers`, `/customers/[id]`, `/settings`.

**Tests:** 220 unit, 190 integration, 77 end-to-end. `pnpm build`, `typecheck`, `lint`, `prettier` all pass.

**Phase 2 gate: CLOSED, all items.** The thirty-second capture measurement was performed on a real phone on 2026-08-20 and **passes** — to be re-checked after the Phase 7 high-fidelity design pass, since that pass changes the surface being measured. The `docs/spec.md` §10 question was settled the same day: the isolated availability-check submission **stands as written**, recorded in §10 with §5.5's "Under review" note replaced. Housekeeping run, `tasks/phase-3.md` generated and reviewed.

**Phase 3 may begin at Task 3.1.** Five tasks: link storage and rate limiting; `/s/[slug]` dispatch; the intake and booking forms; the customer portal; and the admin copy-link actions.

**NEW IN THE SPEC, 2026-08-20 — time-to-intake targets.** `docs/spec.md` §5.2 and §5.3 now carry acceptance targets: **two minutes** for the public intake, **ninety seconds** for the pre-addressed form. Added on the human's judgement that a customer who abandons a form is a lost booking while a slow admin is only inconvenienced — the reverse of how §5.1's target had been weighted. **Both figures are first proposals** and are to be confirmed or replaced at the Phase 3 review gate, once the forms exist.

**A SPEC INCONSISTENCY FOR THE HUMAN TO CORRECT.** `docs/spec.md` §6.1 says slugs draw on "28 characters and roughly 17 million combinations". That arithmetic does not hold: Crockford base32 is already 32 characters *because* `I`, `L`, `O`, and `U` are excluded from it, so they cannot be removed again. `tasks/phase-0.md` resolved this correctly and `src/core/slug.ts` implements 32 characters and 33,554,432 combinations, with a test asserting the alphabet. **The code is right and the spec sentence is wrong**; the correction is a human's edit and is on the Phase 3 completion checklist.

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
