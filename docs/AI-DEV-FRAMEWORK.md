# The Phased Agent Development Framework

A portable process for building software with Claude Code as the implementer and a human as the
orchestrator and quality gate. Extracted from a project that shipped a full-stack product (pure
generation pipeline + Express/Postgres API + React frontend + CLI) across eight phases in roughly
seven working sessions.

The framework's central premise: **the agent has no memory, so the repository is the memory.** Every
session starts cold. Quality and momentum come from a small set of durable documents that are
maintained with discipline, not from long conversations.

---

## How to use this file

This file has two entry points. Pick one.

### Mode A — Generate a development plan package

Hand this file to a **Claude chat session** (not Claude Code) along with your product requirements —
a PRD, a spec, a napkin sketch, a transcript, whatever you have. Then say:

> Read the attached framework document in full, then read my requirements. Act as the planning
> partner described in **§7 Mode A**. Produce the plan package artifacts in the order given there,
> one at a time, stopping after each for my review. Do not write any application code.

Output: a `docs/` + `tasks/` + `AGENTS.md` + `SESSION_LOG.md` package ready to drop into a fresh repo.

### Mode B — Build using this process inside a repo

Hand this file to a **Claude Code session** in your repo and say:

> Read the attached framework document in full. Act as the implementer described in **§8 Mode B**.
> Assess what framework artifacts already exist in this repo, report the gaps, and propose the
> bootstrap sequence. Do not write application code yet.

Output: the framework installed in the repo, then the task-by-task build loop running.

---

## 1. Principles

These are the load-bearing ideas. Everything mechanical in the rest of this document exists to serve
one of them.

**1. The repo is the memory.** Documents, not conversation history, carry state between sessions.
If a decision isn't written down, it didn't happen.

**2. Invariants are separate from instructions.** Standing orders (`AGENTS.md`) outrank task
instructions. An agent following a task file into an architectural violation should stop and flag the
conflict, not resolve it silently. This one rule prevents most compounding architectural drift.

**3. Pure logic first.** Sequence the phases so that the most algorithmically complex, most
side-effect-free code is built first, with heavy unit tests, before anything depends on it. No
server, no UI, no infrastructure friction during the hardest part. Later phases add features to a
component that already has a hundred passing tests guarding it.

**4. The task is the atomic unit.** Not the phase, not the session. A task has a one-paragraph
statement of what will exist afterward, an explicit file list, verifiable acceptance criteria, and a
**must-not-do** list. Small and complete beats large and 80% done — a half-finished task is harder to
resume than an unstarted one.

**5. Must-not-do is load-bearing.** Scope creep is the dominant failure mode of capable agents. An
explicit negative boundary ("does not implement the OAuth flow — that's Task 4.3", "does not add
Redis") stops it cheaply and repeatedly. Write these for every task.

**6. One task per session. Stop at the boundary.** The agent finishes a task, updates the log, and
stops. It does not start the next one. The human reviews between tasks, which is where quality is
actually enforced.

**7. Confirm the plan before code.** Every session opens with the agent summarizing what it's about
to do and which files it will touch. Wrong summaries are cheap to correct; wrong implementations are
not.

**8. Never weaken a test to make it pass.** A failing test or an unmeetable acceptance criterion is
documented as a blocker and the session stops. Same for architectural violations: revert and
re-implement, don't work around. "Good enough for now" becomes a harder problem two phases later.

**9. Patterns get promoted.** When a task discovers a non-obvious implementation fact — an API
signature that differs from the docs, a test-harness gotcha, a config incantation — it gets written
into the standing-orders file with the reason it was established. This is how the agent stops
re-solving the same problem every session.

**10. Journeys detect gaps that tests can't.** A separate document of end-to-end user journeys,
reviewed at every phase boundary, answers a question the test suite cannot: *is there behavior that
should work by now and doesn't?*

**11. The human is the quality gate.** Tests passing is a floor, not a ceiling. Someone must read
the generated output, look at the UI, and ask whether a skilled engineer would have written it this
way.

---

## 2. The artifact set

Ten files. Each has one job and one owner.

| Artifact | Audience | Written by | Lifecycle |
|---|---|---|---|
| `docs/spec.md` | Human + agent | Planning session | Written once, revised on ambiguity |
| `docs/dev-plan.md` | Human + agent | Planning session | Written once, revised on ambiguity |
| `docs/META-PLAN.md` | Human only | Planning session | Written once |
| `docs/plan-summary.md` | Human + agent | Planning session | Status updated per phase |
| `docs/user-journeys.md` | Human + agent | Planning session | Reviewed every phase boundary |
| `AGENTS.md` | Agent | Planning session | Patterns appended continuously |
| `SESSION_LOG.md` | Agent + human | Agent | Rewritten every session |
| `tasks/TEMPLATE.md` | Agent | Planning session | Static |
| `tasks/phase-N.md` | Agent | Per-phase planning session | One per phase, one phase ahead |
| `logs/phase-N.md` | Archive | Housekeeping session | One per completed phase |
| `docs/phase-N-retro.md` | Human | Agent at phase end | One per completed phase |

**The split that matters most:** `AGENTS.md` holds rules that never change. `tasks/phase-N.md` holds
instructions for right now. `SESSION_LOG.md` holds what has happened. Agents conflate these if you
let them; keeping them in three files with three lifecycles is what makes cold starts reliable.

---

## 3. Document specifications

### 3.1 `docs/spec.md` — Product specification

What the product does, from the user's and data's point of view. No implementation sequencing.

Sections: glossary · product overview (purpose/positioning, **what the tool is not**, V1 scope
summary) · core design principles · output artifacts or primary deliverables · the main user flow,
stage by stage with every control and its options enumerated · data model concepts · each subsystem
in enough detail that behavior is unambiguous · explicit future/out-of-scope section.

The "what the tool is not" and out-of-scope sections do real work. They are the thing you point at
when a task starts to grow.

### 3.2 `docs/dev-plan.md` — Development plan

How it gets built. This is the source document that task files are generated from.

Sections:
- **Principles** — engineering invariants, later distilled into `AGENTS.md` rules
- **Repository structure** — the full directory tree, to the file level for key modules. Every other
  document references these exact paths.
- **Environment variables** — every var, grouped, with the phase that introduces it
- **Database schema** — full DDL or equivalent
- **Core types** — the central data structures, plus a documented default instance
- **API routes** — one line per route: method, path, auth requirement, purpose
- **Performance targets** — numbers, so acceptance criteria can be written against them
- **Phase N sections** — for each phase: goal, what's built, module-by-module detail
- **Dependency map** — what must exist before what
- **Testing strategy** — per layer, including what a *good* test asserts in this project

### 3.3 `docs/plan-summary.md` — Living phase summary

One paragraph per phase plus a status line. Cheap for a human to skim to answer "where are we". Kept
in sync with the dev plan; status updated at each phase completion.

### 3.4 `docs/user-journeys.md` — Journeys and coverage

Numbered journeys (`Journey 1`), each broken into steps (`1.2`), each step a table of
`Step | Action | Expected result` rows (`1.2.3`). A good step is one observable user action and its
outcome. Not an internal state change. Not two decisions bundled.

Ends with a **test coverage table** mapping journey step ranges → test file → test name → phase, plus
an explicit list of steps *not* covered, each with a reason (deferred, manual-only, covered by
integration tests).

Two process rules live in this file:

> **Maintenance:** At every phase boundary, before starting the next phase — read the next phase's
> task file in full; for each task, does it unlock user-facing behavior not yet described? Add or
> extend a journey. Do any deferred steps become testable? Remove the deferral. Has any step's
> behavior changed? Revise it. Update the coverage table.

> **Per-task rule:** At the start of any task touching the frontend or a user-facing API — identify
> which journey steps it enables, add them to the task's acceptance criteria, cite them in the test
> file header, and update the coverage table when marking the task complete.

### 3.5 `AGENTS.md` — Standing orders

The most important file. Read in full at the start of every session.

```markdown
# AGENTS.md — Standing Orders

**Read this file first. Every session. No exceptions.**

This file contains the invariants for this project — rules that do not change between sessions
and must be respected regardless of what a task asks you to do. If a task instruction conflicts
with a rule in this file, the rule wins. Stop and flag the conflict rather than resolving it
silently.

---

## What to do at the start of every session

Read these three things, in this order, before writing any code:

**Step 1 — Read this file (`AGENTS.md`) in full.**

**Step 2 — Read `SESSION_LOG.md`.** Start with the **Current State block** near the top — it
tells you the current phase, the next task ID and name, what is already built, and any open
questions. Read individual session entries only if you need the reasoning behind a specific
past decision.

**Step 3 — Read the entry for the next task only** from the current phase task file. The Current
State block identifies it. Do not read the full task file.

If any of the above are missing or the task is unclear, ask before proceeding.

---

## What to do at the end of every session

1. Verify every acceptance criterion in the task is checked off
2. Run the relevant tests and confirm they pass:
   - [exact commands, per suite]
3. Check that no architectural rule below has been violated
4. Update `SESSION_LOG.md`:
   - Add a full session entry (what was done, decisions made, what was not done)
   - Replace the **Current State block** with the new current state
5. If this task established a reusable implementation pattern, add it to **Patterns established**
6. Do not start the next task — stop and wait for instruction

**At the end of a phase**, additionally:

7. All tasks marked `[x]` in the phase task file
8. All test suites pass. Paste output into the session log. Do not proceed with any red test.
9. Type check passes with zero errors
10. Lint passes with zero errors
11. `SESSION_LOG.md` Current State reflects phase completion
12. Write a phase retrospective in `docs/phase-N-retro.md`
13. Review and update `docs/user-journeys.md` per its maintenance rule
14. Wait for instruction before starting the next phase

If tests fail or an acceptance criterion cannot be met, document the blocker in `SESSION_LOG.md`
and stop. Do not work around a failing test by weakening it or skipping it.

---

## Project reference documents

| Document | Purpose |
|---|---|
| `docs/spec.md` | Product specification |
| `docs/dev-plan.md` | Development plan — phases, schemas, contracts, test strategy |
| `tasks/phase-N.md` | Task list for the current phase — primary instruction source |
| `SESSION_LOG.md` | Running record of completed work and decisions |

---

## Repository structure

[full tree, copied from the dev plan]

---

## Architectural rules

[One subsection per rule. Each states the rule absolutely, names the exact files it governs,
and says what to do on conflict. Pattern:]

### [Rule name, stated as an assertion]

[The rule, in specific terms with real file paths and identifiers.]

[What to do if you find yourself violating it: "stop and flag it." Where the correct place for
that logic is instead. If a test enforces the rule, name it and forbid weakening it.]

---

## Patterns established

[Appended over the life of the project. Each entry: the gotcha, correct vs. wrong code, and the
reason it was established — which failure it prevents.]

### [Pattern name]

[Explanation.]

```ts
// correct
// wrong — [the exact error message this produces]
```

Established because: [the concrete failure that motivated it].

---

*This file is version-controlled. Changes to it require a commit with a clear message explaining
why the rule changed.*
```

**On writing architectural rules.** The rules that worked were absolute, file-scoped, and paired with
an escape hatch that is *stop and ask* rather than *use judgment*. Good examples in form:

- *"`generate(config)` in `src/pipeline/index.ts` must have no side effects: no DB reads, no network
  calls, no file system access, no logging. It takes a config object and returns a data object.
  Period. If you find yourself adding a DB query inside any file under `src/pipeline/`, stop and flag
  it. That infrastructure lives in `src/api/` and `src/services/`."*
- *"`configStore` is the single source of truth for the creation flow. All stage components read from
  and write to it only. No stage component stores a local copy of config state, derives it from URL
  params, props, or `useState`."*
- *"Generated files contain no TODO comments or placeholder values. A generated file containing
  `// TODO` is a pipeline bug, not an acceptable shortcut."*
- *"Migrations are the only way to change the schema. No manual schema edits. Every migration has
  both `up` and `down`."*

Aim for 6–12 rules. Each should name a boundary that, if crossed, is expensive to uncross.

**On patterns.** Do not write these upfront — they're discovered. What earns a place: a library API
that differs from what the agent will assume, a test-harness behavior that silently does the wrong
thing, a build/config incantation with a non-obvious failure mode. Always include the error message
or symptom, because that's what makes the entry findable next time.

### 3.6 `SESSION_LOG.md` — Running record

```markdown
# Session Log — [Project]

## Current State

**Phase:** N — [Name] — [In progress | Complete]
**Next task:** N.X — [Name]
**What's built:** [Cumulative, a few sentences. Enough for a cold agent to know what it can rely on.]
**Open questions:** [Or "None."]

---

## Phase N-1 archive

Phase N-1 session entries are archived at `logs/phase-N-1.md`.

---

## YYYY-MM-DD — Task N.X: [Name]

**What was done:**
- [Specific changes, by file]

**Decisions made:**
- [Non-obvious choice + why]

**Verification:**
- [Command → result, with counts and timings]

---
```

The Current State block is the single most-read piece of text in the whole system. It is *replaced*
each session, not appended to. Newest session entry goes directly beneath it; older phases get
archived out by the housekeeping session so the file stays skimmable.

### 3.7 `tasks/TEMPLATE.md` — Task file template

```markdown
# Phase N — [Phase Name]

> **Status:** Not started
> **Depends on:** Phase N-1 complete (all tasks marked `[x]`, all tests passing)
> **Reference:** `docs/dev-plan.md` § Phase N — [Phase Name]

---

## Overview

[One paragraph: the goal of this phase, what will be built, and what "done" means.
Include an explicit "What this phase does not change" sentence.]

---

## Tasks

### Task N.1 — [Task name]

> **Status:** `[ ]` Not started / `[~]` In progress / `[x]` Complete
> **Session:** [SESSION_LOG.md pointer when complete]
> **Depends on:** [Task N.0, or "none"]

**What this task implements:**
[One or two sentences. What exists after this task that didn't before.]

**Files to create or modify:**
- `path/to/file.ts` — [what changes]
- `path/to/file.test.ts` — [what is tested]

**Acceptance criteria:**
- [ ] [Specific and verifiable. Not "it works" — "calling X with Y returns Z."]
- [ ] [Checkable without ambiguity.]
- [ ] Tests pass: `[exact command]`
- [ ] Type check passes
- [ ] `SESSION_LOG.md` updated with session entry and new Current State block

**Must not do:**
- [Scope boundary — what this task explicitly excludes]
- [e.g. "Does not implement X — that is Task N.2"]

---

## Phase completion checklist

- [ ] All tasks above marked `[x]`
- [ ] All test suites pass with zero failures
- [ ] Type check passes in all packages
- [ ] Lint passes with zero errors
- [ ] End-to-end tests for this phase pass
- [ ] `SESSION_LOG.md` has a complete entry for every session in this phase
- [ ] `docs/plan-summary.md` updated to reflect this phase's completion
- [ ] `docs/user-journeys.md` reviewed — coverage table updated
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
```

A phase should be 4–6 tasks. If a phase needs more, it's two phases. Phases inserted mid-stream get a
letter suffix (`1b`, `3b`) rather than renumbering everything — this happened twice in the source
project and worked fine.

Task files may also carry **pre-computed reference data** — resolved constants, palette values,
enumerated options, exact copy strings — in a section before the tasks. Doing that translation during
planning rather than during implementation is a large, repeatable win.

### 3.8 `docs/phase-N-retro.md` — Phase retrospective

```markdown
# Phase N Retrospective — [Phase Name]

**Date:** YYYY-MM-DD
**Tasks:** N.1–N.X
**Session count:** N

## What went well
- [Specific, with the mechanism — not "good progress"]

## Harder than expected
- [The failure, its root cause, and the fix]

## Key decisions
| Decision | Rationale |
|---|---|

## Carry-forwards to Phase N+1
- [Deferred item, with why and what it will cost]
```

At project milestones, also write a `docs/project-retro.md`: what was built (layer table), what went
well, what was harder, **key decisions assessed in retrospect** (a table with a correct/wrong
verdict per decision), **carried-forward debt** (issue · priority · notes), and "if starting again."
The retrospective that assesses its own past decisions as wrong is the one that's actually useful.

---

## 4. The operating loop

```
   pre-flight risk validation (once)
              ↓
        scaffold session
              ↓
   ┌──→ generate tasks/phase-N.md  ────┐   (chat session, one phase ahead)
   │          ↓                        │
   │   ┌─ session: open → confirm →    │
   │   │  build → close ──┐            │
   │   └──── per task ←───┘            │
   │          ↓                        │
   │   phase completion checklist      │
   │          ↓                        │
   │   retro → housekeeping ───────────┘
   └───────────  next phase
```

### 4.0 Pre-flight risk validation

Before the first line of code, identify the one or two technical assumptions the whole plan rests on
— an unfamiliar library doing the core algorithmic work, an API whose behavior you're guessing at, a
performance target you haven't measured. Spend thirty minutes proving each in a throwaway script.
Record findings as the first `SESSION_LOG.md` entry.

The point is not to de-risk everything. It's to de-risk the thing that would invalidate the plan.

### 4.1 Scaffold session

A dedicated Claude Code session that creates structure and tooling only — zero application code.
Before running it: `git init`, place the planning docs in `docs/`, put `AGENTS.md` and
`SESSION_LOG.md` at the root, create `tasks/` with `TEMPLATE.md` and `phase-0.md`.

```
Read AGENTS.md in full. Then read docs/dev-plan.md — specifically the Repository
Structure and Environment Variables sections.

Your task is to initialize the project scaffold. Do not write any application code —
only project structure, configuration files, and tooling setup.

1. Create the full directory structure from the Repository Structure section.
2. Create package/module manifests for each package, with these exact dependencies:
   [enumerate per package]
3. Configure the type checker: [settings]
4. Configure the linter at the root, single config covering all packages.
5. Configure the formatter at the root: [settings]
6. Configure the unit test runner: [settings, test file glob, coverage provider]
7. Configure the end-to-end test runner: [base URL, test directory]
8. Create .env.example with all variables from the Environment Variables section.
9. Create a .gitignore covering: [entries]
10. Install dependencies. Then verify: type check passes; lint passes with zero errors;
    the test runner exits cleanly with zero tests and zero failures; the e2e runner installs.
11. Make a single commit: "Initial scaffold — no application code"

Report any decisions you made that were not specified above, and flag anything that did
not verify cleanly. Do not proceed to Phase 0 task work.
```

If anything didn't verify cleanly, fix it in a follow-up scaffold session. Do not carry broken
tooling into Phase 0.

### 4.2 Generate the phase task file

Run in a **chat session**, not Claude Code — this is planning, and it shouldn't have write access to
the repo.

```
Read docs/dev-plan.md (specifically Phase N) and tasks/TEMPLATE.md. Generate
tasks/phase-N.md — a complete, sequenced task list for Phase N using the template's
format. Every task must have specific, verifiable acceptance criteria and an explicit
must-not-do list. Do not write any application code.
```

Then review it yourself against these questions:

- Are tasks in the right order? Can each be implemented without depending on something not yet built?
- Are acceptance criteria specific enough to verify without ambiguity?
- Does every task update `SESSION_LOG.md`?
- Does every task have a must-not-do list that actually constrains something?
- For core-logic tasks: does every task have a test validating the *output*, not just that it ran?
- Does any task need reference data resolved now rather than during implementation?

Commit the task file, then start the phase. **Generate one phase ahead** — have Phase N+1's file
ready before Phase N finishes.

### 4.3 Session opening prompt

```
Read AGENTS.md in full. Then read SESSION_LOG.md — start with the Current State block.
Then read only the entry for task [N.X] in tasks/phase-[N].md (not the full file).

Before writing any code, summarize:
1. What this task implements
2. Which files you will create or modify
3. Any dependencies on prior tasks and whether they are complete per the Current State block
4. Any potential conflicts with the architectural rules in AGENTS.md

Wait for my confirmation before proceeding.
```

Wait for the summary. Correct it now if it's wrong. During the session: let the agent work; intervene
if it strays outside task scope; if it gets stuck, ask it to *describe the blocker* rather than
telling it to try again.

### 4.4 Session closing prompt

```
Before we finish:
1. Run all tests and report results
2. Run the type checker and report any errors
3. Run the linter on all modified files and report any errors
4. Verify every acceptance criterion in the task is checked off
5. Update SESSION_LOG.md:
   a. Add a full session entry (what was done, decisions made, what was not done)
   b. Replace the Current State block with the updated state
6. Mark the task complete in the phase task file
7. If this task established a new pattern, add it to the Patterns established section of AGENTS.md

Do not start the next task.
```

### 4.5 Review gates — what the human checks

**Every task:** type check clean · lint clean · tests pass · `SESSION_LOG.md` updated · no debug
logging in production paths · no `TODO`/`FIXME` in code (those belong in the session log) · no
placeholder text in anything generated or user-facing.

**Core-logic tasks:** do the tests assert on output *content*, or merely that nothing threw? A test
that calls the function and asserts `result !== undefined` is not a test. Does generated code
actually compile? Are the values sensible when you inspect them by hand?

**Backend tasks:** is every new route covered by at least one integration test asserting persisted
state? Are route handlers thin — no inline SQL, no business logic?

**Frontend tasks:** are state-ownership boundaries respected? Do components read from the designated
store rather than local state? Do the timing assertions actually assert the performance target?

**Phases with no visual feedback** deserve extra scrutiny, because "tests pass" is the only signal
and it's insufficient. Read the generated output. Would a skilled engineer have written it this way?
Do not advance until you're satisfied with output *quality*, not just green tests.

### 4.6 Phase transition checklist

- [ ] All tasks in the phase file marked complete
- [ ] Full test suite passes across all packages
- [ ] Type check passes
- [ ] Lint passes
- [ ] End-to-end tests for this phase pass
- [ ] `SESSION_LOG.md` has entries for every session in this phase
- [ ] Phase retrospective written to `docs/phase-N-retro.md`
- [ ] `docs/user-journeys.md` reviewed and updated
- [ ] `docs/plan-summary.md` status updated
- [ ] Next phase's task file generated and reviewed
- [ ] Housekeeping session run

Do not start a new phase with a failing test.

### 4.7 Housekeeping session

End of every phase, before the next. Produces no code.

```
This is a housekeeping session. Do not write any application code.

1. Compress any completed task entries in tasks/phase-[N].md that still have their full
   body. Each completed task becomes: status line, one-sentence output summary, key
   decisions, session log pointer.

2. Move all session entries for Phase [N] from SESSION_LOG.md to logs/phase-[N].md.
   Keep the project status header and Current State block in SESSION_LOG.md. Add a
   one-line pointer: "Phase [N] session entries archived to logs/phase-[N].md"

3. Review the AGENTS.md Patterns established section. Add any patterns from Phase [N]
   that are missing.

4. Read tasks/phase-[N+1].md. Flag any entries that look wrong or depend on something
   not yet built. Do not edit them — just report what you find.

5. Report what you did and what (if anything) needs human attention.
```

This is not optional bookkeeping. Without it, `SESSION_LOG.md` grows until the cold-start read is
expensive and the agent starts skimming the part that matters most.

### 4.8 Failure playbook

**Tests fail after a session.** Open a focused session: *"Read `AGENTS.md` and `SESSION_LOG.md`. The
following tests are failing: [paste output]. Do not write any new features. Diagnose and fix the
failing tests only."*

**Generated or user-facing output isn't production quality.** That's a bug in the generator, not an
acceptable state. Fix it before moving on — output quality is the product.

**An architectural rule was violated.** Don't work around it. Revert and re-implement correctly.

**The spec and dev plan conflict, or have a gap.** Stop work on the affected task. Resolve the
ambiguity in a chat session, update the documents, then resume. Do not let the implementing agent
resolve spec ambiguity by choosing.

**The agent is stuck in a loop.** Ask it to describe the blocker in prose, without proposing a fix.
Loops are almost always a missing piece of context, and the description surfaces it.

**A test suite becomes a maintenance sink.** Usually a systemic cause, not N independent ones. In the
source project, integration-test churn traced to two root causes: reusing already-running dev servers
with wrong environment variables, and parallel test workers racing on a shared database. Both were
one-line config fixes that should have been set on day one. When you're fixing the same category of
test failure a third time, stop and look for the shared cause.

---

## 5. Sequencing phases

The phase decomposition matters more than any other planning decision. Heuristics that held up:

**Phase 0 is pure logic with no infrastructure.** Whatever the algorithmic core is — a generator, a
solver, a parser, a pricing engine — build it as pure functions with heavy unit tests, before any
server, database, or UI exists. It's the hardest part and it deserves zero infrastructure friction.
Every later phase then adds to something already well-tested.

**Then persistence and auth.** Schema, migrations, API, sessions. A frontend stub is fine here — one
page proving the wiring.

**Then the primary user flow.** The real UI against a real API.

**Then account/persistence integration**, once the flow exists and you know what needs saving.

**Then adjacent surfaces** — CLI, public API, integrations.

**Visual and identity work goes late,** as its own phase. Doing it before flows are settled means
doing it twice. Doing it as a distinct phase with its own reference material makes it tractable.

**Insert lettered phases when you learn something.** A `1b` or `3b` for a foundational change
discovered mid-project (in the source project: making the ownership model support anonymous users,
which touched schema, API, and frontend) is far cheaper than retrofitting it three phases later.
Getting a foundational data-model change in early is the single highest-leverage correction available.

---

## 6. Adapting the framework

The mechanics are project-agnostic; the specifics are not. What changes per project:

| Element | How to adapt |
|---|---|
| Architectural rules | Derive from *your* project's expensive-to-uncross boundaries. Different domains, different rules. |
| Test commands | Every command in `AGENTS.md` and every task file must be literally runnable in your repo. |
| Phase 0 | Whatever your algorithmic core is. If there genuinely isn't one, Phase 0 becomes schema + contracts + fixtures. |
| Journeys | Only if the product has user-facing flows. For a library or service, replace with consumer-contract scenarios. |
| Phase count | 4–6 tasks per phase is the working range. Scale phase count, not task count. |

What doesn't change: the three-file separation of rules/instructions/history, the Current State block,
open-confirm-build-close, must-not-do lists, one task per session, stop at boundaries, never weaken a
test, promote patterns, human as quality gate.

**Where this framework is a poor fit:** exploratory prototyping where the goal is learning rather
than shipping, one-off scripts, and codebases whose conventions are already so established that
`AGENTS.md` would just restate the existing code. The overhead is real — roughly one planning session
per phase plus a housekeeping session — and it pays off over a multi-week build, not an afternoon.

---

## 7. Mode A — Generating a plan package

*Instructions for a Claude chat session given this file plus a set of product requirements.*

Your job is to produce the plan package described in §2, from the requirements provided. You are a
planning partner, not an implementer. Write no application code.

**Before writing anything, interview.** Ask about: the algorithmic or logical core (what's the hard
part?); the persistence and auth model; deployment target and cost constraints; what's explicitly
*not* in V1; existing code or greenfield; the tech stack, or a recommendation if it's open; how the
human wants to verify quality on work that has no visual output.

Ask what you actually need. Don't interrogate.

**Then produce artifacts in this order, stopping after each for review:**

1. **`docs/spec.md`** — per §3.1. Enumerate every control and option in the main flow; vagueness here
   becomes agent improvisation later. Include "what this is not" and out-of-scope sections.
2. **`docs/dev-plan.md`** — per §3.2. Propose the phase decomposition against §5's heuristics and
   explain your reasoning for the ordering before writing the phase sections. Repository structure
   must be file-level for key modules.
3. **`docs/plan-summary.md`** — per §3.3.
4. **`docs/user-journeys.md`** — per §3.4, with an empty coverage table and both process rules.
5. **`AGENTS.md`** — per §3.5. Derive 6–12 architectural rules from the dev plan's principles and
   structure. Each must be absolute, name real file paths, and say "stop and flag it" on conflict.
   Leave **Patterns established** empty with a note that it's populated during development.
6. **`SESSION_LOG.md`** — per §3.6. Current State block pointing at Task 0.1, empty entry list.
7. **`tasks/TEMPLATE.md`** — per §3.7, with this project's real test commands substituted in.
8. **`tasks/phase-0.md`** — the first phase task file, from the template.
9. **`docs/META-PLAN.md`** — the human's orchestration guide: the pre-flight validation specific to
   this project, the scaffold prompt with this project's real dependencies filled in, the task-file
   generation prompt, session open/close prompts, the review gates specialized per phase type, the
   phase transition checklist, the housekeeping prompt, and the failure playbook. Adapt §4 — don't
   just restate it.

**Quality bar for what you produce:** every command must be literally runnable. Every acceptance
criterion must be checkable by someone who wasn't in this conversation. Every architectural rule must
name real paths. Every task must have a must-not-do list that constrains something real.

**Flag rather than resolve.** Where requirements are ambiguous or contradictory, say so and state the
assumption you're proceeding under. Do not silently pick.

---

## 8. Mode B — Building with the framework

*Instructions for a Claude Code session given this file inside a repo.*

**First, assess.** Check which framework artifacts exist: `AGENTS.md`, `SESSION_LOG.md`,
`tasks/TEMPLATE.md`, `tasks/phase-*.md`, `docs/spec.md`, `docs/dev-plan.md`,
`docs/user-journeys.md`, `logs/`. Report what's present, what's missing, and — if a spec and dev
plan already exist — which artifacts you can derive from them versus which need human input. Then
propose a bootstrap sequence. Do not write application code yet.

**Bootstrapping into a repo with no framework:**

1. If there's no spec or dev plan, stop — that's Mode A work and it belongs in a chat session, not
   here. Say so.
2. If a spec and dev plan exist, generate the missing framework artifacts from them, in §7's order,
   presenting each for review.
3. For an existing codebase: derive `AGENTS.md` architectural rules from the conventions already in
   the code, and seed **Patterns established** with non-obvious facts already discoverable in the
   repo. Set `SESSION_LOG.md`'s "What's built" from the actual current state, not from the plan.
4. Add `logs/` and `tasks/` directories. Commit the framework separately from any code change.

**Once the framework is in place, the loop:**

- Every session begins with the §4.3 opening prompt, and you wait for confirmation after summarizing.
- You implement exactly one task, then run the §4.4 closing sequence, then stop.
- You never start the next task unprompted.
- `AGENTS.md` outranks the task file. On conflict, stop and flag it.
- A failing test or unmeetable criterion is a blocker to document, never a test to weaken.
- At a phase boundary, run the completion checklist, write the retro, update the journeys, and run
  the housekeeping session — then wait.

**Standing habits that keep the loop cheap:** commit after every task, with the task ID in the
message, so the git log reads like a table of contents. Use the exact file paths from `AGENTS.md`
everywhere — session log, task files, commit messages. Never skip the `SESSION_LOG.md` update,
especially when the session is going well and it feels like a waste of time. That's exactly when it's
load-bearing.
