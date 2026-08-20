# Session Log — sittter

## Current State

**Phase:** 3 — Links and customer surfaces — In progress, 1 of 5 tasks complete
**Next task:** 3.2 — `/s/[slug]` dispatch and the invalid-link page

**What's built in Phase 3:** `src/services/links.ts`, `src/lib/rate-limit.ts`, `src/db/repositories/rate-limit.ts`. No user-facing surface yet.

**Tests:** 220 unit, 218 integration, 79 end-to-end.

**What Task 3.2 can rely on:**
- `resolveSlug(businessId, rawSlug, now, today)` returns a discriminated `Resolution`. **Every failure is `{ kind: 'invalid' }`** — malformed, never existed, expired, revoked, wrong business, missing target. A test asserts three of those are deep-equal, so the route renders one page for all of them.
- A `booking_form` slug whose booking has moved past `tentative` resolves to `{ kind: 'customer_portal' }` for that booking's customer, per `docs/spec.md` §5.3 — not to `invalid`.
- `rateLimit(key, at, limit)` and `slugResolutionKey(ip)` in `src/lib/rate-limit.ts`. The instant is an argument. The hit is counted whether or not it is allowed.
- `linkUrl(appUrl, slug)` builds the absolute URL with no doubled slash.
- `ensureCustomerLink`, `ensureBookingFormLink`, `ensurePublicIntakeLink`, `rotateCustomerLink` — all take a random source.

**Two exceptions to the business-scoping rule, both deliberate:** `src/db/repositories/rate-limit.ts` is not scoped by business, because a rate limit is about the caller and slug resolution happens before any business is known — the table has no business column for the same reason. The others remain `createBusiness` and `getOnlyBusiness`.

**A SPEC INCONSISTENCY FOR THE HUMAN TO CORRECT.** `docs/spec.md` §6.1 says slugs draw on "28 characters and roughly 17 million combinations". Crockford base32 is already 32 characters *because* `I`, `L`, `O`, and `U` are excluded, so they cannot be removed again. The code implements 32 and 33,554,432 with a test. On the Phase 3 completion checklist.

**Database:** one Neon project, two branches. `main` (`.env`, seeded); `test` (`.env.test`). Playwright builds into `.next-e2e` on **:3100** with `workers: 1`.

**Toolchain:** Node 22.17.1, pnpm 11.8.0, TypeScript 6.0.3 (pinned), Next 16.3.1, React 19.2.8, Tailwind 3.4.19 (pinned), Vitest 4.1.11 on Vite 8.2.1, Playwright 1.62.1, ESLint 10.8.1, Drizzle ORM 0.45.2, Neon Postgres.

**Open questions in the spec:** two of the original three §10 items remain open; the isolated-submission question was settled 2026-08-20.

---

## Session entries

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
