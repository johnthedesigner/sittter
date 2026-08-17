# sittter — META-PLAN

> **Audience:** the human orchestrator. Not read by the implementing agent.
> **Purpose:** the prompts, gates, and checklists for running this build. Copy the prompt blocks verbatim.

This document assumes the eight-phase decomposition in `docs/dev-plan.md` §9. It is adapted to this project rather than restated from the framework: the dependency lists are real, the review gates are specialized to the phase types this project actually contains, and the failure playbook names failures this project is likely to produce.

---

## 1. Pre-flight risk validation

Run before the scaffold session. Two throwaway scripts. Neither ships. Both findings become the first `SESSION_LOG.md` entry.

The point is not to de-risk everything. It is to de-risk the two things that would invalidate the plan.

### Spike 1 — Google service account calendar

**The assumption:** a service account can own a calendar and share it with ordinary Gmail accounts in a way that works.

**What to prove, in order:**

1. A service account with domain-wide delegation disabled can create a secondary calendar through `calendar.calendars.insert`.
2. `calendar.acl.insert` grants a personal Gmail address `reader` access to that calendar.
3. The calendar then appears in that account's Google Calendar, either automatically or after accepting an invitation. Note which.
4. The same calendar is visible in Apple Calendar on an iPhone through a connected Google account.
5. An event written with `extendedProperties.private` can be read back and matched on that property.

**If it fails:** the calendar design in `docs/spec.md` §5.12 changes shape and Phase 5 must be replanned. The fallback is a published ICS feed, which costs refresh latency in Google. Do not start Phase 5 without this finding recorded.

### Spike 2 — Daily job inside the Hobby budget

**The assumption:** the daily digest job fits inside a ten second serverless function timeout.

**What to prove:** a script that fetches Open-Meteo forecast and past-days data for three coordinate pairs, does trivial composition work, and sends two emails through Resend, completes in under eight seconds from a cold start.

**If it fails:** either the job splits, or the project moves to Vercel Pro. Record which, and update `docs/dev-plan.md` §8 if the target changes.

### Prompt

```
This is a pre-flight validation session. Do not write any application code and do
not create any project structure.

Write two throwaway scripts under scripts/spike/ that prove or disprove the two
assumptions in docs/dev-plan.md §12. Run each, report what actually happened
including any error messages verbatim, and state plainly whether each assumption
holds.

Then write the findings as the first entry in SESSION_LOG.md. Do not proceed to
scaffold work.
```

---

## 2. Scaffold session

A dedicated Claude Code session that creates structure and tooling only. Zero application code.

**Before running it:** `git init`, place the planning documents in `docs/`, put `AGENTS.md` and `SESSION_LOG.md` at the repository root, create `tasks/` containing `TEMPLATE.md` and `phase-0.md`, and create an empty `logs/`.

### Prompt

```
Read AGENTS.md in full. Then read docs/dev-plan.md, specifically the Repository
Structure and Environment Variables sections.

Your task is to initialize the project scaffold. Do not write any application
code. Only project structure, configuration files, and tooling setup.

1. Create the full directory structure from the Repository Structure section,
   with empty placeholder directories where files do not yet exist.

2. Initialize a single-package pnpm project with these dependencies:

   Runtime:
     next react react-dom
     drizzle-orm @neondatabase/serverless
     zod
     resend @react-email/components @react-email/render
     @vercel/blob
     googleapis
     obscenity

   Development:
     typescript @types/node @types/react @types/react-dom
     drizzle-kit
     tailwindcss postcss autoprefixer
     vitest @vitest/coverage-v8
     @playwright/test
     eslint eslint-config-next @typescript-eslint/parser
       @typescript-eslint/eslint-plugin prettier eslint-config-prettier
     tsx dotenv

3. Configure TypeScript with strict mode on, noUncheckedIndexedAccess on,
   and a path alias mapping @/* to src/*.

4. Configure ESLint at the root, one config covering the whole repository. It
   must include a no-restricted-imports rule that forbids any file under
   src/core/ from importing src/db/, src/services/, src/app/, next, react,
   drizzle-orm, or any package that performs input or output. This rule is an
   architectural boundary from AGENTS.md, not a style preference.

5. Configure Prettier at the root.

6. Configure Vitest in vitest.config.ts with the test glob limited to
   src/core/**/*.test.ts, and coverage via v8.

7. Configure a second Vitest project in vitest.integration.config.ts with the
   glob src/{db,services}/**/*.test.ts. It will match nothing until Phase 1.

8. Configure Playwright in playwright.config.ts with the test directory e2e/
   and a base URL of http://localhost:3000.

9. Add these package.json scripts: dev, build, start, test, test:unit,
   test:integration, test:e2e, typecheck, lint, format, demo, db:generate,
   db:migrate, db:seed.

10. Create .env.example containing every variable from the Environment Variables
    section, grouped by phase, each with a comment naming its purpose.

11. Create .gitignore covering: node_modules, .next, .env, .env.local,
    coverage, playwright-report, test-results, .DS_Store.

12. Install dependencies. Then verify and report each result separately:
    - pnpm typecheck passes
    - pnpm lint passes with zero errors
    - pnpm test:unit exits cleanly with zero tests and zero failures
    - pnpm test:integration exits cleanly with zero tests and zero failures
    - pnpm test:e2e installs its browsers and exits cleanly with zero tests
    - the no-restricted-imports rule fails on a deliberately created temporary
      file at src/core/violation.ts that imports react. Delete that file after
      proving it.

13. Make a single commit: "Initial scaffold — no application code"

Report any decision you made that was not specified above, and flag anything
that did not verify cleanly. Do not proceed to Phase 0 task work.
```

If anything did not verify cleanly, fix it in a follow-up scaffold session. Do not carry broken tooling into Phase 0. In particular, do not start Phase 0 until step 12's last item has actually failed on purpose. A lint rule that is not proven to fire is a lint rule that is not enforcing anything.

---

## 3. Generating a phase task file

Run in a **chat session**, not Claude Code. This is planning, and it should not have write access to the repository.

**Generate one phase ahead.** Have Phase N+1's file ready before Phase N finishes.

### Prompt

```
Read docs/dev-plan.md, specifically the Phase [N] section, plus docs/spec.md and
tasks/TEMPLATE.md. Generate tasks/phase-[N].md using the template's format.

Requirements:
- Four to six tasks. If it needs more, say so rather than compressing.
- Every task has specific, verifiable acceptance criteria that someone who was
  not in the planning conversation could check.
- Every task has a must-not-do list that constrains something real.
- Every task that touches a user surface names the journey steps it enables,
  from docs/user-journeys.md.
- Include a Reference data section resolving any constants, enumerated options,
  or exact copy strings the tasks would otherwise have to invent.

Do not write any application code.
```

Then review it yourself against these questions:

- Are the tasks in the right order? Can each be implemented without depending on something not yet built?
- Are the acceptance criteria specific enough to verify without ambiguity? Would a stranger get the same answer you would?
- Does every task update `SESSION_LOG.md`?
- Does every task have a must-not-do list that actually constrains something, rather than restating the task?
- For core-logic tasks, does every task have a test validating the output content, not just that it ran?
- Does any task need reference data resolved now rather than during implementation?
- For this project specifically: does any task quietly assume a database, a clock, or a network call that the phase is not supposed to have?

Commit the task file, then start the phase.

---

## 4. Session opening prompt

```
Read AGENTS.md in full. Then read SESSION_LOG.md, starting with the Current
State block. Then read only the entry for task [N.X] in tasks/phase-[N].md,
not the full file.

Before writing any code, summarize:
1. What this task implements
2. Which files you will create or modify
3. Any dependencies on prior tasks, and whether they are complete per the
   Current State block
4. Any potential conflicts with the architectural rules in AGENTS.md

Wait for my confirmation before proceeding.
```

Wait for the summary. Correct it now if it is wrong, because wrong summaries are cheap to fix and wrong implementations are not.

During the session: let the agent work. Intervene if it strays outside task scope. If it gets stuck, ask it to describe the blocker in prose without proposing a fix.

---

## 5. Session closing prompt

```
Before we finish:
1. Run pnpm test:unit, pnpm test:integration, and pnpm test:e2e. Report each
   result separately.
2. Run pnpm typecheck and report any errors.
3. Run pnpm lint and report any errors.
4. Verify every acceptance criterion in the task is checked off.
5. Update SESSION_LOG.md:
   a. Add a full session entry recording what was done, decisions made, and
      what was deliberately not done
   b. Replace the Current State block with the updated state
6. Mark the task complete in the phase task file.
7. If this task established a new pattern, add it to the Patterns established
   section of AGENTS.md.
8. Commit with the task ID in the message.

Do not start the next task.
```

---

## 6. Review gates

### Every task, regardless of phase

- `pnpm typecheck` clean
- `pnpm lint` clean
- All three test commands pass
- `SESSION_LOG.md` updated, and the Current State block replaced rather than appended to
- No `TODO` or `FIXME` in code
- No `console.log` in a production path
- No placeholder copy on any user-facing surface
- The commit message carries the task ID

### Phase 0 — pure core

This phase has no visual output, so green tests are the only automated signal and they are insufficient on their own.

- Read the `pnpm demo` output by hand. Are the line item labels readable? Is the day count right at both ends of the range? Does an every-other-day cadence over an eight day range produce the dates you expect?
- Do the tests assert on output content, or merely that nothing threw? A test asserting `result !== undefined` is not a test.
- Does any function in `src/core/` read a clock, read an environment variable, or call `Math.random()`? Grep for it.
- Is every currency value in every test an integer?

### Phase 1 — persistence and auth

- Is there any SQL or Drizzle query builder call outside `src/db/repositories/`? Grep for it.
- Does every repository function take a business identifier?
- Does an expired magic link token fail closed? Try it by hand.
- Does a consumed token fail on second use? Try it by hand.
- Is the session cookie `httpOnly`, `secure`, and `sameSite`?

### Phase 2 — admin surface

- **Time the capture flow on a real phone, against the thirty second target.** This is the single most important measurement in the project. If it misses, the product's central premise is at risk and the finding matters more than the phase's other work.
- **Evaluate the open question in `docs/spec.md` §10** about the isolated availability-check submission. You now have live use. Decide whether the friction is worth what it buys, and record the decision in the spec rather than leaving it open.
- Are route handlers and server actions thin? No inline SQL, no business logic that belongs in `src/services/`.
- Do components read booking status from `deriveStatus`, or does any surface compute it inline?
- Is the acting admin recorded on every state change, including price overrides and date edits?

### Phase 3 — links and customer surfaces

- **Read the repository functions that serve customer surfaces and confirm they name every column they return.** A `select()` with no column list in that path is a failure even if the template happens not to render the sensitive field.
- Open the customer portal and search the rendered HTML source for the access code you seeded. It must not be there.
- Does a revoked slug, an expired slug, and a slug that never existed all produce the same response?
- Is slug resolution case-insensitive in practice, not just in a unit test?
- Does the rate limit actually engage? Hit it.

### Phase 4 — visits and photos

- Attempt to reach a photo URL without a session and without a link. It must fail.
- Wait out a signed URL's expiry and confirm it stops working.
- Upload a large photo from a real phone. Is the compressed result under 400 KB? Does it take under two seconds?
- Delete a photo and confirm the object is gone from storage, not merely dereferenced in the database.

### Phase 5 — calendar

- Edit an event title manually in Google, then change the booking. Does reconciliation update the event, or create a duplicate?
- Disable the credentials, confirm a booking, and verify the booking still saves and shows as Confirmed.
- Re-enable the credentials, run the daily job, and verify the missing events appear.
- Does a tentative booking look visibly different from a confirmed one in the calendar UI?

### Phase 6 — notifications

- Run the job twice on the same day. Exactly one email.
- Run the job at the wrong local hour. No email, no error.
- Time it with ten active bookings against the eight second target.
- **Read the digest email in a real mail client on a phone.** Is the timeline readable? Is the nudge language friendly rather than accusatory? This is the test that no automated check can perform, and the tone of this email is a feature.
- Break the weather provider and confirm the digest sends without a weather section rather than failing.

### Phase 7 — identity and launch

- Look at every customer-facing surface on a phone. Would a neighbor trust this?
- Is every copy block written, with no placeholder text anywhere?
- Send yourself a magic link, a confirmation email, and a digest from the production domain. Do they land in the inbox rather than spam?
- Confirm the backup procedure by actually restoring to a scratch database.

---

## 7. Phase transition checklist

- [ ] All tasks in the phase file marked complete
- [ ] `pnpm test:unit`, `pnpm test:integration`, and `pnpm test:e2e` all pass
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] The phase-specific review gate above has been walked by hand, not assumed
- [ ] `SESSION_LOG.md` has entries for every session in this phase
- [ ] Phase retrospective written to `docs/phase-N-retro.md`
- [ ] `docs/user-journeys.md` reviewed, coverage table updated, deferrals revisited
- [ ] `docs/plan-summary.md` status line updated
- [ ] Next phase's task file generated and reviewed
- [ ] Housekeeping session run

Do not start a new phase with a failing test.

---

## 8. Housekeeping session

End of every phase, before the next. Produces no code. This is not optional bookkeeping: without it, `SESSION_LOG.md` grows until the cold-start read is expensive and the agent starts skimming the part that matters most.

```
This is a housekeeping session. Do not write any application code.

1. Compress any completed task entries in tasks/phase-[N].md that still have
   their full body. Each completed task becomes: status line, one-sentence
   output summary, key decisions, session log pointer.

2. Move all session entries for Phase [N] from SESSION_LOG.md to
   logs/phase-[N].md. Keep the project status header and the Current State
   block in SESSION_LOG.md. Add a one-line pointer: "Phase [N] session entries
   archived to logs/phase-[N].md"

3. Review the AGENTS.md Patterns established section. Add any patterns from
   Phase [N] that are missing. Each entry needs the error message or symptom,
   because that is what makes it findable next time.

4. Read tasks/phase-[N+1].md. Flag any entry that looks wrong or depends on
   something not yet built. Do not edit them. Report what you find.

5. Report what you did and what, if anything, needs human attention.
```

---

## 9. Failure playbook

**Tests fail after a session.**

```
Read AGENTS.md and SESSION_LOG.md. The following tests are failing:

[paste output]

Do not write any new features. Diagnose and fix the failing tests only.
```

**An architectural rule was violated.** Do not work around it. Revert and re-implement correctly. "Good enough for now" becomes a harder problem two phases later.

**The agent disabled or added an exception to the `src/core/` import rule.** Treat this as the most serious failure available in this project. Revert the exception, revert the code that needed it, and re-implement with the pure part in `src/core/` and the input-output part in `src/services/`.

**The agent resolved a spec open question on its own.** Revert the behavior change, restore the specified behavior, and record the agent's observation in `SESSION_LOG.md` where it belongs. The open question stays open until you close it.

**The spec and dev plan conflict, or have a gap.** Stop work on the affected task. Resolve the ambiguity in a chat session, update the documents, then resume. Never let the implementing agent resolve a spec ambiguity by choosing.

**The agent is stuck in a loop.** Ask it to describe the blocker in prose, without proposing a fix. Loops are almost always a missing piece of context, and the description surfaces it.

**A test suite becomes a maintenance sink.** Look for one systemic cause rather than many independent ones. In a project of this shape the likely candidates are integration tests sharing a database without isolation, and a dev server reused across runs with the wrong environment variables. Both are configuration fixes. When you are fixing the same category of failure a third time, stop and look for the shared cause.

**The thirty second capture target is missed at the Phase 2 gate.** This is a product finding, not a performance bug. Do not optimize the round trip and call it fixed. The likely cause is too many required fields or too many taps, and the fix belongs in `docs/spec.md` §5.1 before it belongs in code.

---

## 10. Standing habits

- Commit after every task, with the task ID in the message, so the git log reads like a table of contents.
- Use the exact file paths from `AGENTS.md` everywhere: session log, task files, commit messages.
- Never skip the `SESSION_LOG.md` update, especially when the session is going well and it feels like a waste of time. That is exactly when it is load-bearing.
- Generate the next phase's task file before you need it.
- When you find yourself explaining something to the agent for the second time, it belongs in `AGENTS.md` under Patterns established.
