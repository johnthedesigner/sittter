# Session Log — sittter

## Current State

**Phase:** 0 — Pure core — Not started
**Next task:** 0.1 — Domain types and calendar date arithmetic
**What's built:** No application code. The planning package is version-controlled (`docs/spec.md`, `docs/dev-plan.md`, `docs/plan-summary.md`, `docs/user-journeys.md`, `AGENTS.md`, `tasks/TEMPLATE.md`, `tasks/phase-0.md`, `docs/META-PLAN.md`). Two throwaway pre-flight scripts exist under `scripts/spike/`. No scaffold, no database, no `package.json`.

**Gate status before Task 0.1:**

1. ~~Pre-flight spikes~~ — **complete.** Both assumptions hold. See the entry below. One consequence for Phase 5 needs a human decision; it does not block Phase 0.
2. Scaffold session per `docs/META-PLAN.md` §2 — **not started.** This is the remaining gate. Task 0.1 cannot begin until type check, lint, and both test runners verify cleanly, including the deliberate `src/core/violation.ts` proving the `no-restricted-imports` rule actually fires.

**Open questions:** Three deferred items in `docs/spec.md` §10, each with a review trigger, not to be resolved during implementation. Spike 1 raised a fourth, about calendar onboarding; it was **resolved by the human on 2026-08-19** and is no longer open. See the decision recorded in the entry below.

---

## Session entries

## 2026-08-19 — Pre-flight risk validation: Spikes 1 and 2

Per `docs/dev-plan.md` §12 and `docs/META-PLAN.md` §1. No application code. Both assumptions hold.

**What was done:**
- `scripts/spike/env.mjs` — minimal `.env` reader, no dependencies
- `scripts/spike/google-calendar.mjs` — Spike 1, Google service account calendar
- `scripts/spike/daily-job-budget.mjs` — Spike 2, daily job timing
- `.gitignore`, `logs/`, `scripts/spike/`, `git init` on `main` — the repository did not exist before this session
- `.env.local` template created; credentials were ultimately supplied in `.env` (both gitignored)

### Spike 1 — Google service account calendar: ASSUMPTION HOLDS

A service account with domain-wide delegation **disabled** can own a calendar and share it with an ordinary Gmail account. All five checks pass. The scripted ones:

| Check | Result |
|---|---|
| JWT-bearer token exchange, no delegation | PASS |
| `calendar.calendars.insert` creates a secondary calendar | PASS |
| `calendar.acl.insert` grants a Gmail address `reader` | PASS |
| `extendedProperties.private` written, then matched via `privateExtendedProperty` | PASS — 1 event, marker survived the round trip |

The extended-properties round trip is the load-bearing one: it is what keeps sync reconcilable after a manual edit in Google, which the Phase 5 design depends on.

**The two hand checks, and the finding that matters:**

Sharing is **not one step**. Neither manual check passed on its own.

- **Step 3 — Google Calendar.** The calendar did **not** appear automatically after `acl.insert`. An invitation email arrived separately; after accepting it, the calendar appeared immediately across all of that account's devices.
- **Step 4 — Apple Calendar on iPhone.** The Google account was *already* connected on the device and the calendar still did not appear. It was listed at `calendar.google.com/calendar/syncselect` but **unchecked**. Enabling it there and saving made it visible in both Google Calendar and Apple Calendar.

**Consequence for Phase 5 — flagged, not resolved.** Adding a family member takes three steps, only the first of which the app controls:

1. An admin triggers `acl.insert` from the settings screen.
2. The recipient accepts an emailed invitation.
3. The recipient enables the calendar at `syncselect` for it to reach iOS.

The settings screen in `docs/spec.md` §5.12 is currently designed as though step 1 were sufficient. Without copy setting expectations for steps 2 and 3, the predictable failure is a family member reporting the calendar "doesn't work" while the app shows the share as successful — and step 3 in particular is invisible, since the calendar is present in Google but silently absent from the phone.

Per the AGENTS.md rule *"Open questions in the spec are not yours to close"*, this is recorded and left open. It is a Phase 5 planning decision for the human, taken with this finding in hand. It does not block Phase 0.

**Resolved by the human, 2026-08-19 — V1 supports Google Calendar only.**

The supported clients for Phase 5 are Google Calendar on the web and the Google Calendar app. Apple Calendar on iOS is explicitly **not** a supported surface in V1. Making it smoother is deferred and may be revisited later.

Rationale: step 3 is Apple-specific. Google Calendar picked the shared calendar up across all of the recipient's devices immediately on accepting the invitation, with no visit to `syncselect`. Scoping to Google removes the invisible failure mode entirely rather than papering over it with copy.

What this does *not* remove is step 2. The calendar did not appear under *Other calendars* until the emailed invitation was accepted. Onboarding a family member on the supported path is therefore **two steps**: an admin shares from the settings screen, and the recipient accepts an emailed invitation. `docs/spec.md` §5.12 currently reads as though the first were sufficient, and should be reconciled when Phase 5 is planned.

Anyone who does connect the calendar to Apple Calendar will still need the `syncselect` step. That is now a known limitation rather than a defect.

**Incidental obstacles, recorded because they will recur when provisioning production credentials:**

- Creating the GCP project under a Google Workspace organization was blocked: `constraints/iam.disableServiceAccountKeyCreation` is enforced by default on newly created organizations, and "Parent Resource" is mandatory once an account belongs to an org. Resolved by creating the project under a consumer Gmail account, which belongs to no organization. The alternative — an `orgpolicy.policyAdmin` override scoped to one project — was deliberately not taken for a throwaway spike.
- The Calendar API is off by default. First run failed `403 SERVICE_DISABLED`. Enabling it at the console fixed it; propagation was not instant.

### Spike 2 — Daily job inside the Hobby budget: ASSUMPTION HOLDS LOCALLY

Three Open-Meteo coordinate pairs with `past_days=1`, trivial composition, two Resend sends, all parallel where production would parallelize.

| Stage | Time |
|---|---|
| Weather, 3 properties | 641 ms |
| Composition | 0 ms |
| Email, 2 sends | 235 ms |
| **Total** | **879 ms** against an 8,000 ms target |

Headroom against the 10,000 ms Hobby timeout: **9,121 ms**. The job is nowhere near the limit. No split is needed and there is no case for moving to Vercel Pro on these grounds.

**Caveat, stated plainly so Phase 6 is not planned against the wrong number.** This measured API latency from a developer machine. It did **not** measure a cold-started Vercel serverless function, which is what the assumption is actually about — a cold start adds runtime boot and module load, and runs from Vercel's region. The margin is wide enough that a cold start is very unlikely to consume it, but that is a judgement, not a measurement. If Phase 6 later runs close to budget, this is the first thing to re-measure properly.

**Decisions made:**
- **Raw REST, zero dependencies, plain `.mjs`.** The spike session runs before the scaffold, so there is no `package.json` to install `googleapis`, `resend`, or `tsx` into, and `docs/META-PLAN.md` §1 forbids creating project structure. Raw REST also tests the HTTP contract that Phase 5 and Phase 6 depend on, rather than an SDK's behavior over it.
- **`env.mjs` expands `\n` inside a PEM whether or not the value was quoted.** An unquoted key with literal `\n` is how it is usually pasted, and untreated it fails as `error:1E08010C:DECODER routines::unsupported`, which names nothing leading back to the cause. `src/services/calendar.ts` will need the same normalization in Phase 5. Candidate for AGENTS.md Patterns established once that file exists.
- **A real `process.env` value overrides the file** in `env.mjs`, so a run can be varied without editing credentials.
- **Two emails sent to the same address.** Resend's shared `onboarding@resend.dev` sender only delivers to the address owning the API key until a domain is verified. The first run measured one send, which was not faithful to an assumption specifying two; it was re-run with the recipient duplicated.
- **The spike calendar is left in place**, deletable via `--cleanup`, because steps 3 and 4 required it to persist.

**Not done:**
- **No cold-start measurement on a real Vercel function.** See the Spike 2 caveat.
- **The Phase 5 onboarding consequence was not resolved.** Deliberately left open per AGENTS.md.
- **No scaffold work.** `docs/META-PLAN.md` §1 ends with "Do not proceed to scaffold work."
- **No application code, no `package.json`, no project structure.**

**Verification:**
- `node scripts/spike/google-calendar.mjs` → all scripted steps PASS; calendar `309c4a80…@group.calendar.google.com` created, ACL rule `user:jlivornese@gmail.com` role `reader`, event `h333aqtas5gvrt45dofa71slk4` matched by marker
- Hand checks for steps 3 and 4 → both pass only after the extra recipient-side actions described above
- `node scripts/spike/daily-job-budget.mjs` → 879 ms total, both Resend sends accepted (ids `ebdcbbbc…`, `f80d2d6c…`)
- Private key parses as RSA 2048-bit after PEM normalization
- `git status` clean; `.env` and `.env.local` confirmed untracked via `git check-ignore`
- Type check, lint, and test suites **not run — they do not exist yet.** The scaffold session creates them.

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
