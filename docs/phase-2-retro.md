# Phase 2 retrospective — Admin surface

**Completed:** 2026-08-19
**Sessions:** 7 (Tasks 2.1 through 2.7)
**Output:** an admin surface that runs the business end to end from a phone.

**Tests:** 220 unit, 190 integration, 77 end-to-end. `pnpm build` passes.

---

## What the phase produced

| Surface | What it does |
|---|---|
| `/home` | Today's work and what needs attention |
| `/bookings` | The list, filterable, with both confirmation flags as columns |
| `/bookings/new` | Fast capture — the thirty-second surface |
| `/bookings/[id]` | Header, confirmation, dates, care instructions, visits, pricing, property, payment, activity |
| `/customers`, `/customers/[id]` | Customers, their properties, and their activity |
| `/settings` | Default pricing components |

Journeys 1, 4.3, 8, and 9 are covered end to end — 30 of the 33 journey steps Phase 2 was scoped to enable.

---

## What worked

**Reusing `src/core/` instead of paraphrasing it.** The home screen's needs-attention list calls `buildDigestModel`, so the screen and the morning email cannot disagree about what needs attention. Pricing calls `priceBooking`; the schedule calls `generateVisits`. There is exactly one implementation of each rule, and the greps at the phase gate confirm it.

**The snapshot copies components, not a total.** Journey step 9.1.6 wants a confirmed booking's price unchanged when the business rate rises. Storing a total would do that and break the other half, because a booking whose visit count changes must still recalculate. Freezing the inputs satisfies both, with a test for each.

**Isolation enforced by a signature.** The §10 rule — that the calendar check is its own submission — is not upheld by discipline. `setAvailabilityChecked` takes a booking and a boolean, so there is no argument through which another change could ride along. A combined save is structurally impossible.

**The attribution audit enumerates rather than samples.** `src/services/attribution.test.ts` reads every action module, finds every exported action, and asserts each calls `actingAdmin()`, with a documented allowlist for the two reads. A new action added without attribution fails there. Sampling would have passed forever while coverage rotted.

---

## What was harder than expected

**Server actions and test timing, repeatedly.** Five separate failures across the phase were races, not defects: a reload that outran a write, a confirmation assertion that outgrew its timeout once confirming also generated visits and snapshotted pricing, a `goto` aborted by an in-flight action. Each looked exactly like a broken feature in the test report.

The lesson worth carrying: **a slow write and a wrong write are indistinguishable in a test report.** The tempting fix is to loosen the assertion. The right one is to wait for something that proves the write landed — an attribution line, an activity entry — and then assert the thing under test.

**Two runtime rules that pass typecheck and fail in production.** A `'use server'` file may export only async functions; exporting one constant broke the entire booking detail page and failed thirteen specs in a different journey with "expected 1, received 0". And Playwright's `hasText` matches text content, not input values, so a filter on a label living in an input matched nothing. Both are in `AGENTS.md` Patterns established.

**I broke an architectural rule and caught it with the gate's own grep.** The first version of `src/services/care-instructions.ts` called `db().update()` directly. It typechecked and would have worked. It was caught by running the phase gate's grep during the task rather than at the end of the phase — which is now the habit: **run the gate greps per task, not per phase.**

**A regeneration that did its work three times.** `regenerateVisitsForBooking` originally called `planRegeneration` and then repeated the booking read, the instruction resolution, and the schedule expansion. Against a remote database that was enough to time a test out intermittently. Fixed by computing once and reusing — the flaky test was pointing at a real inefficiency, not at itself.

---

## Decisions the human still owns

1. **`/home` "filtered by the acting admin".** `docs/dev-plan.md` describes the home screen that way. Nothing in `docs/spec.md` defines that filter, there is no assignment model, and §5.11 says the equivalent digest content is "identical for every recipient". The screen shows the same content to every admin. **Needs a definition or a deletion.**
2. **`resolveEffectiveInstructions` placement.** A pure function sitting in `src/services/` because this phase did not modify `src/core/`. Moving it is free if a later phase wants it there.
3. **`visits` has no `created_by` column** in `docs/dev-plan.md` §5, unlike `bookings`, `visit_logs`, and `photos`. Visit writes are attributed through the activity log. Adding a column would be a schema change the plan does not call for.
4. Carried from Phase 0: the `src/core/` import rule versus `obscenity`; the Vercel cron schedule; the TypeScript 6 pin; `docs/spec.md` §5.12 and two-step calendar onboarding; the `photos/[id]/route.ts` discrepancy.

---

## The two gates that are not code

**Neither has been performed.** Both need a human and a phone, and both are recorded as outstanding.

- **Time the capture flow against the thirty-second target.** `docs/META-PLAN.md` §6 calls it the single most important measurement in the project. A miss is a product finding: the fix belongs in `docs/spec.md` §5.1 before it belongs in code, and the likely cause is too many fields or taps rather than a slow round trip.
- **Evaluate the `docs/spec.md` §10 open question.** The isolated availability-check submission is built exactly as specified and was not relaxed. An observation from building it: the rule cost the implementation nothing and made the service simpler than a general update would have been. Whether it costs an *admin* anything needs someone confirming a real booking on a phone. **Record the decision in the spec rather than leaving it open.**

---

## What to carry into Phase 3

- **The customer-surface query rule gets its first real test.** Phase 3's review gate is that repository functions serving customer surfaces name every column they return. `getPropertyForPortal` and `getCustomerForPortal` already do, and `src/db/repositories/activity.ts` deliberately has no customer-facing read at all — a test asserts its exported names.
- **`src/core/slug.ts` is complete and tested**, including the reserved and blocked checks and the injected random source. Phase 3 adds storage, resolution, expiry, revocation, and rate limiting around it.
- **Run the gate greps per task.** They caught a boundary violation this phase that a typecheck could not.
- **Expect a toolchain session.** Every phase so far has had one, and the incidents were more expensive than any logic in the phase.
