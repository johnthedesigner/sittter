# Session Log — sittter

## Current State

**Phase:** 3 — Links and customer surfaces — In progress, 2 of 5 tasks complete
**Next task:** 3.3 — Public intake and the pre-addressed booking form

**What's built in Phase 3:** `src/services/links.ts`, `src/lib/rate-limit.ts`, the rate-limit repository, and `/s/[slug]` — dispatch, the invalid-link page, and a read-only view of what a link resolves to.

**Tests:** 220 unit, 218 integration, 91 end-to-end.

**`/s/[slug]` renders inline rather than redirecting**, so the URL a customer was sent stays the URL they can bookmark (`docs/spec.md` §6.1). Tasks 3.3 and 3.4 replace the read-only views with the real form and the full portal at that same route.

**What Task 3.3 must know:**
- **`/new` does not exist yet.** A `public_intake` slug redirects there, and an e2e test asserts the redirect target. Task 3.3 builds the page.
- The booking-form view at `/s/[slug]` is currently read-only — property nickname, range, customer-facing status. Task 3.3 turns it into an editable form at that same route.
- `src/db/repositories/bookings.ts` has `listBookingsForPortal` and `getBookingForPortal`, both naming every column. **Neither returns `accessCodes`, `accessNotes`, or any `*_by` actor column**, and an e2e test asserts the rendered HTML contains none of them.
- The public routes call no `requireAdmin()` and render no admin shell — asserted by a test looking for the admin nav, the acting-admin name, and the New booking action.

**AN AMENDED ACCEPTANCE CRITERION.** Task 3.2 was written asking for HTTP 429 on rate limiting. **An App Router page cannot set a status code**, so exceeding the limit redirects to `/s-too-many`, which reveals nothing about any slug. A true 429 needs middleware. That is a larger change than the task warranted and is recorded here for **Phase 7's rate-limit tuning** — the criterion was written during planning without checking that the platform supported it, and was amended rather than quietly ticked.

**A SPEC INCONSISTENCY FOR THE HUMAN TO CORRECT.** `docs/spec.md` §6.1 says slugs draw on "28 characters and roughly 17 million combinations". Crockford base32 is already 32 characters *because* `I`, `L`, `O`, and `U` are excluded. The code implements 32 and 33,554,432 with a test. On the Phase 3 completion checklist.

**Deployed on Vercel from `main`.** `vercel.json` declares `framework: "nextjs"` because detection failed — probably confused by `pnpm-workspace.yaml` reading as a monorepo signal. **The cron it declares points at `/api/cron/daily`, which is not built until Phase 6**, so it fires against a 404 daily until then.

**Database:** one Neon project, two branches. `main` (`.env`, seeded); `test` (`.env.test`). Playwright builds into `.next-e2e` on **:3100** with `workers: 1`.

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11 on Vite 8.2.1, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2, Neon Postgres.

**Open questions in the spec:** two of the original three §10 items remain open; the isolated-submission question was settled 2026-08-20.

---

## Session entries

## 2026-08-21 — Task 3.2: `/s/[slug]` dispatch and the invalid-link page

**What was done:**
- `src/app/s/[slug]/page.tsx` — resolution, rate limiting, dispatch, and read-only views
- `src/app/s/[slug]/not-found.tsx` — the invalid-link page
- `src/app/s-too-many/page.tsx`, `src/components/link-copy.ts`
- `src/db/repositories/bookings.ts` — `listBookingsForPortal`, `getBookingForPortal`
- `e2e/journey-5.spec.ts` — 12 specs; link fixtures in `e2e/fixtures.ts`

**A problem caught before it was written, not after.**

The task file had this route dispatching by redirect to `/s/[slug]/portal` and `/s/[slug]/form`, which Tasks 3.3 and 3.4 would build. Those routes do not exist yet — and a missing child route falls through to the nearest `not-found.tsx`, which here is **the invalid-link page**. A perfectly valid link would have rendered "This link is no longer valid".

Rendering inline instead fixes that and is closer to the spec anyway: `docs/spec.md` §6.1 fixes the URL shape at `/s/<slug>`, so the link a customer was sent is the link they can bookmark. The read-only views show real data — property nickname, service range, customer-facing status — rather than placeholder copy, and Tasks 3.3 and 3.4 replace them at the same route.

**Decisions made:**

- **Every failure calls `notFound()`.** A slug that never existed, an expired one, a revoked one, and one belonging to another business produce the same 404 and the same words. A test walks all three cases and asserts the status codes and the rendered text are equal, rather than merely that each is "some error".
- **The invalid-link page names no slug and no cause.** A test asserts the body contains neither the slug that was tried nor the words "expired", "revoked", or "not found".
- **Rate limiting runs before anything is looked up**, so this route cannot be used to probe at all.
- **The portal reads name every column.** Neither returns `accessCodes`, `accessNotes`, nor any `*_by` actor column. A test seeds a known access code and asserts the rendered HTML contains neither it, nor the access notes, nor the admin's name, nor any system activity text — the Phase 3 gate's own check, written as a test rather than left for the gate.
- **A test asserts no internal status name appears in the HTML**, so `toCustomerFacingLabel` cannot be bypassed later without going red.

**An acceptance criterion amended rather than quietly ticked.** The task asked for HTTP 429 on rate limiting. An App Router page cannot set a status code; a true 429 needs middleware, which is a larger change than this task warrants. Exceeding the limit now redirects to `/s-too-many`, which reveals nothing about any slug. The criterion was written during planning without checking that the platform supported it. Amended in `tasks/phase-3.md` with the reason, and carried to Phase 7's rate-limit tuning.

**Not done:**
- **`/new` does not exist** — a `public_intake` slug redirects there and Task 3.3 builds it. The dispatch is what is tested.
- **The booking-form view is read-only** — Task 3.3 makes it a form.
- **The portal shows no care instructions, costs, past-engagement detail, or copy blocks** — Task 3.4.

**Verification:**

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 220 tests |
| `pnpm test:integration` | PASS — 218 tests |
| `pnpm test:e2e` | PASS — 91 tests |
| `pnpm build` / `typecheck` / `lint` / `prettier` | PASS |
| `requireAdmin` in any public route | none |
| `accessCodes` or `accessNotes` in a portal read | none |

---

## 2026-08-20 — Task 3.1: Link storage, resolution, and rate limiting

**What was done:**
- `src/services/links.ts` — `allocateLink`, `resolveSlug`, `revokeLinkById`, `rotateCustomerLink`, `ensureCustomerLink`, `ensureBookingFormLink`, `ensurePublicIntakeLink`, `linkUrl`
- `src/lib/rate-limit.ts`, `src/db/repositories/rate-limit.ts`
- `src/db/repositories/links.ts` — `createLink` now validates the slug
- `src/services/links.test.ts` (18), `src/lib/rate-limit.test.ts` (8)
- `vitest.integration.config.ts` — the glob now covers `src/lib/`

**Decisions made:**

- **Allocation retries on the INSERT failing, not on a prior existence check.** `links.slug` is globally unique, so the insert is the only authority — checking first and inserting after is a race, and at 33.5 million combinations that race would be found in production rather than here. The retry catches only unique violations; anything else propagates, so a real failure is not swallowed by a retry loop.
- **A dead link is a dead link.** A malformed slug, one that never existed, an expired one, a revoked one, and one belonging to another business all return the same value. A test asserts three of them are deep-equal rather than merely all falsy, because `resolveSlug` is reachable with no authentication and any difference is a probe.
- **A hit is recorded only on successful resolution**, so the counter measures use rather than probing.
- **The rate limit is keyed on the CALLER, not the slug.** Keying on the slug would let one attacker exhaust a real customer's link for everyone who has it. A test proves one address hitting the limit leaves another unaffected.
- **A refused hit is still counted**, so hammering cannot get a caller back under the limit.
- **Fixed one-minute windows, not sliding.** A sliding window needs a per-request log or a background job to age entries out; this protects a lookup, not a payment endpoint. The cost is that a caller can spend a full allowance at the end of one window and again at the start of the next. Written down at the function rather than left as an unexplained choice.
- **`rate_limit_hits` is not scoped by business,** deliberately: a rate limit is about the caller, and slug resolution happens before any business is known. The table has no business column for the same reason. Documented at the top of the repository beside the only other exceptions.

**A guard added because my own test found the hole.** Two tests used slugs containing `U` and `O` — characters Crockford base32 excludes. The e2e fixture guard from Phase 0 caught one immediately; the other reached the database, because `createLink` accepted any string and produced a row that could never resolve and was silent about it. `createLink` now rejects a slug `normalizeSlug` would reject. The database cannot express that constraint, so leaving it to every caller to remember was the wrong place for it.

**A test replaced rather than given a longer timeout.** One allocation test reset the database mid-test and rebuilt its fixtures, and timed out intermittently. It was asserting determinism in a roundabout way; it now allocates twice from ONE source and asserts the second continues where the first stopped, which is the property that matters and is fast.

**Not done:**
- **No page, route, or form** — Tasks 3.2 through 3.5.
- **No signed payload, encoded identifier, or JWT** anywhere near a URL.
- **No external rate-limit dependency.**

**Verification:**

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 220 tests |
| `pnpm test:integration` | PASS — 218 tests |
| `pnpm test:e2e` | PASS — 79 tests |
| `pnpm build` / `typecheck` / `lint` / `prettier` | PASS |
| Drizzle outside `src/db/` | none |
| Second slug generator | none — `src/core/slug.ts` only |

---


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
