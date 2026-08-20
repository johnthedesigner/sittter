# Phase 3 — Links and customer surfaces

> **Status:** Not started
> **Depends on:** Phase 2 complete (all tasks `[x]`, all gates closed 2026-08-20)
> **Reference:** `docs/dev-plan.md` § Phase 3; `docs/spec.md` §5.2, §5.3, §5.10, §6.1

---

## Overview

A customer can request service and see their own engagements without an account. Short opaque slugs, the links table with revocation and hit counting, rate-limited resolution, the three link types, the public intake form, the pre-addressed booking form, and the customer portal.

**This is the first phase where a surface is reachable by someone who is not signed in.** Everything before it sat behind a session guard. That changes what a mistake costs: a query that returns one column too many now returns it to a stranger.

**What this phase does not change:** no photos in the portal — visit logs and photos are Phase 4. No calendar, no weather, no digest. No emails beyond what Phase 1 built, except the intake notification §5.2 requires. Nothing under `src/core/` is modified; `src/core/slug.ts` is complete and consumed.

**Done means:** a neighbour follows a link from a text message, fills in a form on their phone in under two minutes, and later opens their portal to see what was done — and no query behind any of those pages can return an access code, an activity entry, an admin's name, or another customer's data.

---

## A spec inconsistency to resolve before Task 3.1

`docs/spec.md` §6.1 says slugs are "five characters from Crockford base32 with `I`, `L`, `O`, and `U` removed, giving 28 characters and roughly 17 million combinations."

**That arithmetic does not hold.** Crockford base32 is already 32 characters — ten digits and twenty-two letters — *because* `I`, `L`, `O`, and `U` are excluded from it. Removing them again is not possible. `tasks/phase-0.md` Reference data resolved this correctly during planning, and `src/core/slug.ts` implements it: 32 characters, 32⁵ = **33,554,432** combinations, with a test asserting the alphabet and its length.

**The code is right and the spec sentence is wrong.** This task file proceeds on the implemented behaviour. `docs/spec.md` §6.1 should be corrected to say 32 characters and roughly 33.5 million — **a human's edit, not this file's.**

---

## Reference data

Resolved during planning. No task should invent these.

### Link types and lifetimes

From `docs/spec.md` §6.1, matching the `link_type` enum.

| Type | Target column | Lifetime |
|---|---|---|
| `customer_portal` | `customer_id` | Long-lived. No expiry. Rotatable on demand, which revokes the old slug. |
| `booking_form` | `booking_id` | Resolves only while the booking derives `inquiry` or `tentative`. After that it dispatches to the customer's portal instead. |
| `public_intake` | neither | Permanent. Exactly one per business. |

### Slug resolution responses

**A slug that never existed, an expired slug, and a revoked slug produce the SAME response.** Anything else lets a stranger probe which slugs are real. `src/db/repositories/links.ts` already returns the row whatever its state, deliberately, so the decision is the caller's.

| Case | Response |
|---|---|
| Resolves and is live | The target page |
| Never existed / expired / revoked | The invalid-link page, HTTP 404, identical in all three cases |
| Rate limit exceeded | HTTP 429, a plain page, no information about the slug |

### Invalid-link copy

| Element | String |
|---|---|
| Heading | `This link is no longer valid` |
| Body | `Links expire, and can be replaced if something has changed. Get in touch and we'll send you a new one.` |
| Contact line | Renders the business's `contact_email` |

Deliberately says nothing about whether the link ever existed.

### Rate limiting

| Setting | Value |
|---|---|
| Limit | `LINK_RATE_LIMIT_PER_MINUTE`, default 30 |
| Scope | Per IP, per minute, across all slug resolution |
| Storage | `rate_limit_hits`, keyed `(key, window_start)` — no Redis, per `docs/dev-plan.md` §3 |
| Window | Fixed one-minute buckets, floored from the current instant |

### Intake chips

`docs/spec.md` §5.2. Each selected chip creates a care instruction with that label and empty detail; the free text becomes one further instruction labelled `General`.

```
Cats   Dogs   Other pets   Plants
Mail and packages   Trash and recycling   Medications   Something else
```

Chips are prompts, not a taxonomy. A chip creates an instruction with cadence `as_needed`, because nothing in the form asks how often — the admin sets cadence later on the booking detail screen.

### Intake copy

| Element | String |
|---|---|
| Page heading | `Request pet or house sitting` |
| Submit button | `Send request` |
| Confirmation heading | `Thanks — we've got it` |
| Confirmation body | `We'll be in touch to confirm. Nothing is booked until we've replied, so please don't count on these dates yet.` |
| Portal link line | `You can check back here any time:` |

### Customer-facing status labels

Already implemented — `CUSTOMER_FACING_LABELS` in `src/core/presentation.ts`, tested. `Requested`, `Waiting on you`, `Waiting on us`, `Confirmed`, `In progress`, `Complete`, `Cancelled`. **Internal status names are never rendered on a customer surface.**

### Never shown in the customer portal

From `docs/spec.md` §5.10, verbatim, because this is the list the phase gate checks against:

> access codes, alarm codes, key locations, wifi passwords, the activity log, admin names as actors, or any other customer's data.

`properties.access_notes` covers key locations and wifi passwords in practice. Excluded **at the query layer** by naming columns, never by omitting fields from a template.

---

## Tasks

### Task 3.1 — Link storage, resolution, and rate limiting

> **Status:** `[x]` Complete
> **Session:** 2026-08-20 — see `SESSION_LOG.md`
> **Depends on:** none

**What this task implements:**
`src/services/links.ts` and `src/lib/rate-limit.ts` — slug allocation with collision retry, resolution, expiry, revocation, hit counting, and the rate limit. No user-facing surface.

**Files to create or modify:**
- `src/services/links.ts` — `allocateSlug`, `resolveSlug`, `revokeLink`, `rotateCustomerLink`, `ensurePublicIntakeLink`
- `src/lib/rate-limit.ts` — database-backed, `rate_limit_hits`
- `src/db/repositories/rate-limit.ts` — a repository for it, since no Drizzle call may live outside `src/db/`
- `src/services/links.test.ts`, `src/lib/rate-limit.test.ts`

**Journey steps enabled:** none — no user-facing surface.

**Acceptance criteria:**
- [x] `allocateSlug` uses `generateSlug` from `src/core/slug.ts` and no second generator exists
- [x] Allocation retries on a database collision, not merely on reserved and blocked words, and a test forces a collision by seeding an existing slug
- [x] Allocation takes a random source as an argument, so a collision is a deterministic test rather than a hope
- [x] Slugs are stored uppercase and resolve case-insensitively, asserted through the service
- [x] `resolveSlug` returns the SAME result for a slug that never existed, an expired one, and a revoked one — a test asserts the three are indistinguishable
- [x] A `booking_form` link stops resolving once its booking derives anything but `inquiry` or `tentative`
- [x] `rotateCustomerLink` revokes the old slug and issues a new one; the old one then resolves like any dead link
- [x] `ensurePublicIntakeLink` is idempotent — exactly one `public_intake` link per business, however many times it is called
- [x] A successful resolution increments `hit_count` and sets `last_hit_at`
- [x] The rate limit engages at `LINK_RATE_LIMIT_PER_MINUTE` and releases in the next window, both tested with an injected instant rather than by waiting
- [x] Rate limiting is keyed per IP, and a test proves one IP hitting the limit does not affect another
- [x] No Drizzle call exists outside `src/db/` — grep
- [x] Tests pass: `pnpm test:unit`, `pnpm test:integration`
- [x] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [x] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- Does not put a signed payload, an encoded identifier, or a JWT in a URL; a slug is an opaque lookup key and revocation is a requirement
- Does not build any page — that is Tasks 3.2 through 3.4
- Does not add Redis or any external rate-limit dependency
- Does not reveal, in any return value, which of the three dead-link cases occurred

---

### Task 3.2 — `/s/[slug]` dispatch and the invalid-link page

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Task 3.1

**What this task implements:**
The single public route that resolves a slug and sends the visitor to the right place, plus the page every dead link lands on.

**Files to create or modify:**
- `src/app/s/[slug]/page.tsx` — resolution and dispatch
- `src/app/s/invalid/page.tsx` or an equivalent — the invalid-link page, per the Reference data copy
- `src/app/layout.tsx` — confirm the public surface renders outside the admin shell
- `e2e/journey-5.spec.ts` — step 5.3.2

**Journey steps enabled:** 5.3.2.

**Acceptance criteria:**
- [ ] A live `customer_portal` slug dispatches to that customer's portal
- [ ] A live `booking_form` slug dispatches to the booking form
- [ ] A `booking_form` slug whose booking is now confirmed dispatches to the **customer portal** instead, per `docs/spec.md` §5.3
- [ ] A live `public_intake` slug dispatches to the intake form
- [ ] **A slug that never existed, an expired slug, and a revoked slug all render the identical invalid-link page with HTTP 404**, asserted by comparing the three responses
- [ ] The invalid-link page uses the Reference data copy exactly and names no slug
- [ ] Resolution is case-insensitive in the browser, not only in a unit test
- [ ] Exceeding the rate limit returns 429 and reveals nothing about the slug
- [ ] **No public page renders the admin shell**, and none of them calls `requireAdmin()`
- [ ] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] `docs/user-journeys.md` coverage table updated
- [ ] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- Does not distinguish the three dead-link cases in copy, status code, timing, or redirect target
- Does not require a session for any `/s/` route
- Does not build the portal or the forms themselves — Tasks 3.3 and 3.4

---

### Task 3.3 — Public intake and the pre-addressed booking form

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Task 3.2

**What this task implements:**
`/new` and the booking form behind a `booking_form` slug — the same form, one creating and one updating. **The time-to-intake target in `docs/spec.md` §5.2 is measured against this.**

**Files to create or modify:**
- `src/app/new/page.tsx` — the public intake form
- `src/app/s/[slug]/booking-form/page.tsx` or equivalent — the pre-addressed form
- `src/app/actions/intake.ts` — `submitIntake`, `submitBookingForm`; **unauthenticated, and therefore a new class of action**
- `src/services/intake.ts` — creation and update, chips to care instructions
- `src/emails/intake-received.tsx` — the admin notification §5.2 requires
- `src/services/intake.test.ts`
- `e2e/journey-2.spec.ts`, `e2e/journey-3.spec.ts`

**Journey steps enabled:** 2.1.1–2.1.6, 2.2.1–2.2.3, 2.3.1, 2.3.2, 3.1.1–3.1.5, 3.2.1, 3.2.2.

**Acceptance criteria:**
- [ ] Only name and email are required; everything else submits empty
- [ ] Submitting with no dates creates a booking deriving `inquiry`; with dates, `tentative`
- [ ] Each selected chip creates a care instruction with that label, empty detail, and cadence `as_needed`
- [ ] The free text becomes one further instruction labelled `General`
- [ ] **An email matching an existing customer attaches to that customer rather than creating a duplicate** (step 2.3.1), matched case-insensitively
- [ ] A name collision with a different email creates a **new** customer, per the §5.2 assumption
- [ ] The confirmation screen uses the Reference data copy and gives the customer their portal link
- [ ] Both admins receive an intake notification, and a delivery failure does not fail the submission
- [ ] The pre-addressed form pre-fills existing values and **updates** the booking rather than creating one
- [ ] **Every field the customer changes is recorded as an activity entry with source `customer_form`** (step 3.2.1)
- [ ] A booking-form submission after confirmation is refused — the link no longer resolves there
- [ ] **The unauthenticated actions record no acting admin and cannot**; `actorId` is null on customer-form entries, and a test asserts it
- [ ] Neither form is rate-limit exempt
- [ ] The whole form is completable one-handed at 390px with no horizontal scrolling
- [ ] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] `docs/user-journeys.md` coverage table updated
- [ ] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- Does not require an account, a password, or a verification step
- Does not call `requireAdmin()` anywhere in the public path
- Does not accept a `businessId`, a `customerId`, or a `bookingId` from the form; every identifier comes from the resolved slug server-side
- Does not trust the email field to identify a customer for **reading** — matching on email attaches a submission, it never grants access to anything

---

### Task 3.4 — The customer portal

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Task 3.3

**What this task implements:**
The page a customer sees at their own link. **This is the task the phase review gate is about.**

**Files to create or modify:**
- `src/app/s/[slug]/portal/page.tsx` or equivalent
- `src/services/portal.ts` — assembly, using only column-named repository reads
- `src/db/repositories/*.ts` — portal reads that name every column they return
- `src/services/portal.test.ts`
- `e2e/journey-5.spec.ts` — steps 5.1.1–5.1.4, 5.2.1–5.2.4, 5.3.1, 5.3.3

**Journey steps enabled:** 5.1.1–5.1.4, 5.2.1–5.2.4, 5.3.1, 5.3.3.

**Acceptance criteria:**
- [ ] Upcoming engagements show the service range, the **customer-facing** status label, care instructions, visit dates and windows, and the estimated cost with line items
- [ ] Past engagements show the service range and the visit list
- [ ] Status uses `CUSTOMER_FACING_LABELS`; **no internal status name appears anywhere in the rendered HTML**, asserted against the response body
- [ ] The "What to expect" copy blocks render from the business record
- [ ] **THE PORTAL QUERY CANNOT RETURN:** `properties.access_codes`, `properties.access_notes`, any `activity_entries` row, any admin name, or any other customer's data
- [ ] **Every repository function reachable from this page names every column it returns.** A `select()` with no column list in this path is a failure even if the template happens not to render the field
- [ ] **Seed an access code and an activity entry, then search the rendered HTML for both.** Neither appears. This is the phase gate's own check, written as a test
- [ ] A portal slug belonging to one customer cannot render another customer's engagements, asserted with two seeded customers
- [ ] Costs are formatted from integer cents at the point of display
- [ ] No photos are shown — Phase 4
- [ ] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] `docs/user-journeys.md` coverage table updated
- [ ] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- Does not add a customer-facing read to `src/db/repositories/activity.ts`; `src/services/attribution.test.ts` asserts its exported names and must keep passing
- Does not render an admin's name anywhere
- Does not show photos, weather, or visit logs — Phase 4 and Phase 6
- Does not rely on a template omitting a field; exclusion happens in the query

---

### Task 3.5 — Copy-link actions across the admin surface

> **Status:** `[ ]` Not started
> **Session:**
> **Depends on:** Task 3.4

**What this task implements:**
The admin side of links: copying a portal or booking-form link, rotating a customer's link, and the link hygiene an admin needs to see.

**Files to create or modify:**
- `src/app/(admin)/bookings/[id]/page.tsx` — the Links section from `docs/spec.md` §5.4
- `src/app/(admin)/customers/[id]/page.tsx` — the portal link and rotation
- `src/app/(admin)/actions/links.ts` — `rotateCustomerLink`, link issuance
- `src/components/CopyLink.tsx` — native share sheet where available, clipboard otherwise
- `e2e/journey-5.spec.ts` — step 5.3.1

**Journey steps enabled:** 5.3.1.

**Acceptance criteria:**
- [ ] A booking detail screen offers a copy action for the customer portal link, and for the booking form link **only while that link would still resolve**
- [ ] Copying places an absolute URL built from `APP_URL` on the clipboard, with no doubled slash
- [ ] The native share sheet is used where available, with a clipboard fallback, and neither path is required for the test to assert the URL
- [ ] **Rotating a customer's link revokes the old slug and issues a new one**, and a test follows the old URL afterwards and gets the invalid-link page
- [ ] Rotation records an attributed activity entry
- [ ] An admin can see a link's hit count and when it was last used
- [ ] Tests pass: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] `docs/user-journeys.md` coverage table updated
- [ ] `SESSION_LOG.md` updated with a **session entry** and a replaced Current State block

**Must not do:**
- Does not expose a link's slug in any admin list where it could be shoulder-surfed alongside the customer's name — a copy action, not a printed URL
- Does not let an admin choose a slug
- Does not build link expiry management beyond rotation and revocation

---

## Phase completion checklist

- [ ] All tasks above marked `[x]`
- [ ] `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e` all pass with zero failures
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass with zero errors
- [ ] **Review gate — READ THE REPOSITORY FUNCTIONS THAT SERVE CUSTOMER SURFACES AND CONFIRM THEY NAME EVERY COLUMN THEY RETURN.** A `select()` with no column list in that path is a failure even if the template happens not to render the sensitive field. This is the phase's central check
- [ ] **Review gate, by hand — open the customer portal and search the rendered HTML source for the access code you seeded.** It must not be there
- [ ] **Review gate, by hand — confirm a revoked slug, an expired slug, and a slug that never existed produce the same response.** Compare all three
- [ ] **Review gate, by hand — is slug resolution case-insensitive in practice, not just in a unit test?**
- [ ] **Review gate, by hand — does the rate limit actually engage? Hit it**
- [ ] **Review gate, by hand — TIME THE PUBLIC INTAKE FORM ON A REAL PHONE against the two-minute target in `docs/spec.md` §5.2**, and the pre-addressed form against ninety seconds. Both figures are first proposals: confirm or replace them now that the forms exist. A miss is a product finding — fewer required fields or fewer taps, in the spec, before anything in code
- [ ] `SESSION_LOG.md` has a **session entry for every session in this phase, written at the end of that session**
- [ ] `docs/plan-summary.md` status line updated for Phase 3
- [ ] `docs/user-journeys.md` reviewed, coverage table updated, deferrals revisited
- [ ] Phase retrospective written to `docs/phase-3-retro.md`
- [ ] Housekeeping session run
- [ ] `tasks/phase-4.md` generated, reviewed, and committed
- [ ] **`docs/spec.md` §6.1's slug arithmetic corrected** — see the note near the top of this file

---

## Completed task log

*(Tasks are compressed to this format once complete. Full details live in the session log.)*

<!--
### Task 3.X — [Task name] ✓
**Output:** [One sentence: what was built.]
**Key decisions:** [Any non-obvious choices.]
**Session:** [Date / logs pointer]
-->
