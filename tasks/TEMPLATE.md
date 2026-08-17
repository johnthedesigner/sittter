# Phase N — [Phase Name]

> **Status:** Not started
> **Depends on:** Phase N-1 complete (all tasks marked `[x]`, all tests passing)
> **Reference:** `docs/dev-plan.md` § Phase N — [Phase Name]

---

## Overview

[One paragraph: the goal of this phase, what will be built, and what "done" means.]

**What this phase does not change:** [Explicit sentence naming the surfaces and modules this phase leaves alone.]

---

## Reference data

*Constants, enumerated options, exact copy strings, and resolved values needed by tasks in this phase. Resolved during planning so that no task has to invent them during implementation. Omit this section if the phase needs none.*

---

## Tasks

### Task N.1 — [Task name]

> **Status:** `[ ]` Not started / `[~]` In progress / `[x]` Complete
> **Session:** [SESSION_LOG.md pointer when complete]
> **Depends on:** [Task N.0, or "none"]

**What this task implements:**
[One or two sentences. What exists after this task that did not before.]

**Files to create or modify:**
- `path/to/file.ts` — [what changes]
- `path/to/file.test.ts` — [what is tested]

**Journey steps enabled:** [Step numbers from `docs/user-journeys.md`, or "none — no user-facing surface."]

**Acceptance criteria:**
- [ ] [Specific and verifiable. Not "it works" — "calling X with Y returns Z."]
- [ ] [Checkable by someone who was not in the planning conversation.]
- [ ] Tests pass: `pnpm test:unit`
- [ ] Tests pass: `pnpm test:integration` *(from Phase 1 onward)*
- [ ] Tests pass: `pnpm test:e2e` *(when this task touches a user surface)*
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] `docs/user-journeys.md` coverage table updated *(when journey steps are enabled)*
- [ ] `SESSION_LOG.md` updated with a session entry and a replaced Current State block

**Must not do:**
- [Scope boundary. What this task explicitly excludes.]
- [e.g. "Does not implement X — that is Task N.2"]
- [e.g. "Does not touch `src/db/` — this phase has no database"]

---

## Phase completion checklist

- [ ] All tasks above marked `[x]`
- [ ] `pnpm test:unit` passes with zero failures
- [ ] `pnpm test:integration` passes with zero failures
- [ ] `pnpm test:e2e` passes with zero failures
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] `SESSION_LOG.md` has a complete entry for every session in this phase
- [ ] `docs/plan-summary.md` status line updated for this phase
- [ ] `docs/user-journeys.md` reviewed, coverage table updated, deferrals revisited
- [ ] Phase retrospective written to `docs/phase-N-retro.md`
- [ ] Housekeeping session run
- [ ] Phase N+1 task file generated, reviewed, and committed

---

## Completed task log

*(Tasks are compressed to this format once complete. Full details live in the session log.)*

<!--
### Task N.X — [Task name] ✓
**Output:** [One sentence: what was built.]
**Key decisions:** [Any non-obvious choices.]
**Session:** [Date / SESSION_LOG pointer]
-->
