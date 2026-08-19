# Session Log — sittter

## Current State

**Phase:** 0 — Pure core — **COMPLETE, 2026-08-19.** Retrospective in `docs/phase-0-retro.md`.
**Next phase:** 1 — Persistence and admin authentication. **Not started, and blocked on human-owned work — see below.**

**What's built:** `src/core/` in full — `types.ts`, `dates.ts`, `status.ts`, `presentation.ts`, `pricing.ts`, `schedule.ts`, `digest.ts`, `slug.ts` — with 206 unit tests at 99.29% statement and 100% function coverage. `scripts/demo.ts` prints a priced booking, a visit schedule, a digest model, and slugs. Scaffold and tooling complete and verified. **No database, no schema, no migrations, no server, no user-facing surface.**

**Housekeeping session run 2026-08-19.** Task entries in `tasks/phase-0.md` compressed (388 → 207 lines), Phase 0 session entries archived to `logs/phase-0.md`, seven entries added to the AGENTS.md Patterns established section.

**Before Phase 1 can start, two things remain the human's, per `docs/META-PLAN.md`:**

1. **Read `pnpm demo` output by hand and judge it** (§6, Phase 0 gate). The agent read it and fixed two defects it found — a misaligned total and a day offset that would have broken across a month boundary — but the gate asks for a human, and an agent checking its own output is not that check.
2. **Generate `tasks/phase-1.md`** (§3) — deliberately not done here: §3 says planning runs in a chat session *without repository write access*. This also blocks the forward-looking half of the `docs/user-journeys.md` maintenance rule, which requires reading the next phase's task file.

**Decisions the human owns.** None block Phase 1. All five are set out with recommendations in `docs/phase-0-retro.md`:

1. **The `src/core/` import rule versus `obscenity`.** AGENTS.md's heading says "imports nothing that performs input or output"; its body says "only `src/core/` and Node built-ins". `src/core/slug.ts` imports `obscenity`, which performs no input or output but is neither. Task 0.6 required the check in that file and forbade vendoring a word list, so there was no third option. Flagged, not resolved. Recommendation: amend the body to match the heading.
2. **The Vercel cron schedule**, before Phase 6.
3. **The TypeScript 6 pin**, whenever `typescript-eslint` supports TS 7.
4. **`docs/spec.md` §5.12 and two-step calendar onboarding**, before Phase 5.
5. **AGENTS.md lists `src/app/api/photos/[id]/route.ts`; `docs/dev-plan.md` §3 does not.**

**A correction owed to `tasks/phase-0.md` Reference data.** The blocked-slug note says to filter the `obscenity` dataset "to entries that are exactly five characters". The dataset holds parsed patterns with wildcards, not plain words, so there is nothing to filter. The working approach is a `RegExpMatcher` tested against each candidate. Worth fixing before Phase 3 reads it as gospel.

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2.

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
