# sittter — Plan Summary

> **Purpose:** the fastest way to answer "where are we". One paragraph per phase, one status line each.
> **Maintenance:** status lines are updated at each phase completion. Paragraphs are kept in sync with `docs/dev-plan.md` and revised only when the plan itself changes.

**Project status:** Planning complete. No code written. Pre-flight spikes not yet run.

---

## Phase 0 — Pure core

**Status:** Not started

Every non-trivial calculation in the product is built as a side-effect-free function before any infrastructure exists. This covers calendar date arithmetic, booking status derivation, the pricing engine, visit schedule generation from cadences, digest model composition, and slug generation. Nothing in this phase touches a database, a network, or a screen. It ends with a demo script that prints a priced booking, a generated visit schedule, and a rendered digest model to the terminal for hand inspection, because there is no other way to judge quality on a phase with no visual output.

## Phase 1 — Persistence and admin authentication

**Status:** Not started

The schema is created and migrated, repositories become the only path to the database, and an admin can sign in with a magic link. Email sending exists here because magic links need it, which means the email service and its send log are in place before any feature depends on them. The phase ends with one stub page rendering the signed-in admin's name, proving the whole chain from cookie to database works. No booking interface, no customer surfaces.

## Phase 2 — Admin surface

**Status:** Not started

Both admins can run the business end to end from a phone. Fast capture, the booking list with both confirmation flags visible as columns, the full booking detail screen, care instruction editing with booking-level overrides, visit generation and editing, the pricing section, and the activity log with automatic system entries. The two confirmation actions are built as isolated submissions per the spec. This is the phase where the thirty-second capture target is measured against a real phone, and where the open question about isolated confirmation submissions gets its first live evaluation.

## Phase 3 — Links and customer surfaces

**Status:** Not started

Short slugs, the links table with revocation and hit counting, rate-limited resolution, and the three link types. The public intake form goes live, the pre-addressed booking form works, and the customer portal shows upcoming and past engagements with costs and care details. Copy-link actions appear across the admin surface using the native share sheet. The review gate for this phase is query-level exclusion of access codes and activity entries from customer surfaces, verified at the query rather than the template.

## Phase 4 — Visits and logging

**Status:** Not started

The sitter records what happened. Visit log entries with an outcome, a note, and photos compressed client-side before upload. Photos live in external storage behind a single service module, reachable only through short-lived signed URLs, with a delete action always available. Visit notes and photos become visible in the customer portal, which is the point at which the portal becomes worth sending someone to. A storage usage indicator appears in settings because the free tier disables uploads rather than billing on overrun.

## Phase 5 — Calendar synchronization

**Status:** Not started

A dedicated Google calendar is created by a service account and shared with family members by email address from a settings screen. Tentative bookings appear as all-day events marked unconfirmed, confirmed bookings add a timed event per visit, and every event carries the app's own identifiers in its extended properties so synchronization stays reconcilable after a manual edit in Google. Sync failures are recorded and retried and never block a booking write. This phase depends on the first pre-flight spike having passed.

## Phase 6 — Notifications and the daily digest

**Status:** Not started

Weather integration, the remaining email templates, and the single scheduled job. The job backfills the prior day's observed weather, then composes and sends one digest to both admins covering all active bookings: today's visits, a needs-attention block, weather where relevant, and a timeline of each booking's full service range. It is idempotent, it verifies the local hour before acting, and it must complete inside the Hobby function timeout. This phase depends on the second pre-flight spike having passed.

## Phase 7 — Identity and launch

**Status:** Not started

The visual design pass across every surface, with customer-facing pages prioritized because they are what neighbors see. Business copy blocks written and loaded. Domain configuration and email sender verification. Rate limit tuning, a link hygiene review, an access code audit, a documented backup procedure, and a deploy runbook. The project retrospective is written here.

---

## Phase completion record

| Phase | Started | Completed | Sessions | Retro |
|---|---|---|---|---|
| 0 | — | — | — | — |
| 1 | — | — | — | — |
| 2 | — | — | — | — |
| 3 | — | — | — | — |
| 4 | — | — | — | — |
| 5 | — | — | — | — |
| 6 | — | — | — | — |
| 7 | — | — | — | — |
