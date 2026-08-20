# sittter — Product Specification

> **Status:** V1 specification
> **Audience:** Human and agent
> **Companion documents:** `docs/dev-plan.md` (how it gets built), `docs/user-journeys.md` (end-to-end behavior), `AGENTS.md` (standing orders)

This document describes what the product does, from the user's and the data's point of view. It contains no implementation sequencing. Where a requirement was ambiguous during planning, the assumption taken is stated inline and marked **Assumption**.

---

## 1. Glossary

These terms are used with exactly these meanings throughout every document in this repository. Agents must not introduce synonyms.

| Term | Meaning |
|---|---|
| **Business** | The single sitting operation the app serves. Every record belongs to exactly one business. There is one business in V1. |
| **Admin** | A person who signs in and administers the business. There are two in V1: the sitter and her co-administrator. All admins have identical permissions. |
| **Sitter** | Informal term for the admin who performs the visits. Not a role in the system. |
| **Co-administrator** | Informal term for the admin who holds the family calendar. Not a role in the system. |
| **Customer** | A person who requests service. Customers never sign in and never hold an account. |
| **Property** | A home where service is performed. Belongs to a customer. Holds durable information that persists across bookings. |
| **Booking** | One engagement covering one away period for one property. The central object. |
| **Service range** | The inclusive start and end dates of a booking. Drives the per-day fee. |
| **Visit** | One scheduled trip to a property on a specific date. Drives the per-visit fee. |
| **Visit log** | The record of what actually happened on a visit. Written after the fact. |
| **Care instruction** | One item of what needs doing at a property. Free text with an optional label and cadence. |
| **Activity entry** | A dated note recording something that happened outside the app, such as a text message or an in-person conversation. |
| **Link** | A short, opaque URL that resolves to a target in the app without requiring sign-in. |
| **Slug** | The five-character identifier inside a link. |
| **Pricing component** | One rule that contributes to a booking's total, such as per-day or per-visit. |
| **Line item** | One row on a booking's computed cost summary. |
| **Dates firm** | A flag meaning the customer has stated their travel dates will not change. |
| **Availability checked** | A flag meaning an admin has checked the family calendar and the booking can be committed to. |
| **Digest** | The daily email summarizing all active bookings. |
| **Forecast** | Predicted weather, read at digest send time, never stored. |
| **Observed weather** | Recorded weather for a past date, fetched after the fact and stored permanently. |

---

## 2. Product overview

### 2.1 Purpose

sittter is a shared operations record for one small sitting business. It exists so that everything about a customer engagement lives in one place, so that dates are not committed to without a deliberate check, and so that customers know what was agreed and what happened.

The business it was built for is a teenager who feeds neighbors' cats, waters their plants, and takes in their mail while they are away. Requests arrive by text message and in conversation, addressed to either the sitter or her mother, in pieces, over time. That messiness is the problem the product is solving.

### 2.2 The three goals

Every feature in V1 traces to one of these. A proposed feature that traces to none of them is out of scope.

1. **A single source of truth.** One record per engagement that both admins and the customer can read.
2. **Clear expectations and centralized communication with the customer.** The customer can see what was agreed, what it costs, and what happened.
3. **A repeatable confirmation process so calendar commitments are firm.** Dates become real through a deliberate step, not by drifting into being real.

### 2.3 What this tool is not

- **It is not a payments product.** No card processing, no invoicing, no payment links. Money changes hands the way it already does. The app computes what is owed and records that it was paid.
- **It is not a messaging product.** There is no chat, no in-app inbox, and no threaded conversation with customers. Communication happens by text and email between people, and the app records what was said.
- **It is not a scheduling marketplace.** There is no discovery, no booking availability calendar exposed to customers, and no self-service booking. A customer requests, an admin confirms.
- **It is not a CRM.** There is no pipeline, no lead scoring, no campaign sending.
- **It is not a permissions system.** All admins can do everything. The confirmation discipline is a shared understanding between two people, supported by visible attribution, not enforced by roles.
- **It is not multi-tenant in its user experience.** The data model carries a business identifier so multi-tenancy is possible later. There is no sign-up, no plan selection, and no tenant onboarding in V1.

### 2.4 V1 scope summary

**In scope:**

- Customer, property, and booking records with durable care instructions
- Two intake paths: a public intake form and a pre-addressed booking link
- Fast admin capture of a booking in under thirty seconds
- A two-flag confirmation model with per-user attribution
- A configurable pricing model with per-booking overrides and ad-hoc line items
- Visit generation from a cadence, with individual visit editing
- Visit logging with outcomes, notes, and photos
- A customer portal reachable by link, with upcoming and past engagements
- Google Calendar synchronization for bookings and visits
- A daily digest email to both admins
- Observed weather recorded against past dates
- An activity log capturing out-of-band communication

**Out of scope for V1:** see §9.

### 2.5 Deployment context

- Single deployment on Vercel, custom domain `sittter.com`
- Postgres database
- One business, two admins, an expected volume in the low tens of bookings per year
- All dates and times in `America/New_York`

**Assumption:** the business operates in a single timezone. Every calendar date in the system is interpreted in `America/New_York`. Multi-timezone support is out of scope and is not designed around.

---

## 3. Core design principles

These are product principles. Engineering invariants live in `docs/dev-plan.md` and `AGENTS.md`.

**Capture beats completeness.** A record that exists with three fields filled in is worth more than a form nobody completes. Every intake path must be satisfiable with the minimum a person actually knows at that moment.

**The app must be faster than the alternative.** The alternative is remembering. If creating a booking takes longer than sending a text, the app gets bypassed and the single source of truth fails. Thirty seconds is the budget for admin capture.

**Durable information belongs to the customer, not the booking.** Addresses, care instructions, access details, and contacts persist. A repeat customer's fifth booking is faster than their first because the app already knows their home.

**Confirmation is deliberate, not incidental.** Availability checking is its own labeled action. It is never a side effect of saving an edit and never bundled into a single button with other changes.

**Attribution replaces permission.** The system records who did what and when, and shows it. It does not restrict who may do what.

**Context, not verification.** Recorded weather and timestamps exist to help a customer understand what happened. They are never presented as a check on the sitter's honesty.

**Nothing sensitive behind an unauthenticated link.** Access codes, alarm codes, and key locations are visible only to signed-in admins. Customers already know their own codes.

---

## 4. Primary deliverables

The things the product produces, which a person outside the system sees or receives:

1. **A customer portal page**, reachable by a short link, showing upcoming and past engagements with status, dates, care details, costs, and visit notes with photos.
2. **A public intake form**, reachable by a short link, that creates a booking request.
3. **A pre-addressed booking link**, which is the intake form bound to an existing booking so the customer completes rather than starts it.
4. **A Google Calendar** containing the family's sitting commitments, subscribable by any family member.
5. **A daily digest email** to both admins covering all active bookings.
6. **A cost summary** for a booking, readable in the customer portal and copyable by an admin.

---

## 5. The main user flow

Each stage below enumerates every control and its options. Vagueness here becomes agent improvisation, so absence of a control from this list means the control does not exist in V1.

### 5.1 Stage: Fast capture (admin)

An admin has just been told about a job. They open the app on a phone and record it before they forget.

**Entry point:** a persistent "New booking" action visible from the admin home screen.

**Controls:**

| Control | Type | Options / behavior | Required |
|---|---|---|---|
| Customer | Combobox | Search existing customers by name; free text creates a new customer with that name | Yes |
| Property | Select | Auto-selected if the customer has exactly one property; otherwise a list plus "New property" | No |
| Start date | Date | Any date | No |
| End date | Date | Any date, must not precede start date | No |
| Dates are approximate | Toggle | Default on when dates are entered | No |
| Note | Text area | Free text, unlimited length | No |
| Save | Button | Creates the booking and returns to the booking detail screen | — |

**Behavior:**

- The only required field is a customer name. Everything else can be empty.
- Saving with no dates creates a booking in `Inquiry` status.
- Saving with dates creates a booking in `Tentative` status.
- A new customer created this way has a name and nothing else. The record is valid in that state.
- The note is written to the booking's activity log as the first entry, with source `admin capture`.
- The screen must be usable one-handed on a phone.

**Acceptance target:** an admin who has used the app before can complete this stage in under thirty seconds, entering a new customer name, a date range, and a one-line note.

### 5.2 Stage: Public intake (customer)

A customer visits the public intake link, typically `sittter.com/new`.

**Controls:**

| Control | Type | Options / behavior | Required |
|---|---|---|---|
| Your name | Text | — | Yes |
| Email | Text | Validated as an email address | Yes |
| Mobile number | Text | Free text, not validated for format | No |
| Address | Text area | Free text street address | No |
| Start date | Date | — | No |
| End date | Date | Must not precede start date | No |
| These dates are not final yet | Checkbox | Default checked | No |
| What do you need? | Chip multi-select | `Cats`, `Dogs`, `Other pets`, `Plants`, `Mail and packages`, `Trash and recycling`, `Medications`, `Something else` | No |
| Tell us more | Text area | Free text. Placeholder prompts for feeding schedule, where supplies are kept, and anything unusual | No |
| Anything we should know about getting in? | Text area | Free text | No |
| Submit | Button | — | — |

**Behavior:**

- Chips are prompts, not a taxonomy. Each selected chip creates a care instruction with that label and empty detail. The free text is stored as a single additional care instruction labeled `General`.
- Submitting creates a customer, a property, and a booking in one action.
- If the submitted email matches an existing customer, the submission attaches to that customer rather than creating a duplicate. **Assumption:** email is the matching key. Name collisions are not treated as matches.
- The booking is created in `Inquiry` status if no dates were given, `Tentative` otherwise.
- The confirmation screen states plainly that the request has been received, that dates are not confirmed until someone gets back to them, and gives the customer their portal link.
- Both admins receive an email notification of a new intake submission.

### 5.3 Stage: Pre-addressed booking link (customer)

An admin has already created the booking. They send the customer a link so the customer fills in what only they know.

**Behavior:**

- Same form as §5.2, with existing values pre-filled and editable.
- The customer name and email fields are pre-filled and editable.
- Submitting updates the existing booking rather than creating a new one.
- Every field the customer changes is recorded as an activity entry with source `customer form`.
- The link resolves to this form only while the booking is in `Inquiry` or `Tentative` status. After confirmation it resolves to the customer portal instead.

### 5.4 Stage: Booking completion (admin)

The admin opens a booking and fills in the parts the customer did not provide.

**Sections on the booking detail screen:**

1. **Header.** Customer name, property nickname, service range, status chip, and the two flag indicators.
2. **Dates.** Start date, end date, approximate toggle.
3. **Care instructions.** List inherited from the property, each editable. Controls per instruction: label, detail text, cadence, and a delete action. An "Add instruction" action. A "This booking only" toggle that makes the instruction an override rather than a change to the property.
4. **Visits.** See §5.6.
5. **Pricing.** See §5.7.
6. **Activity.** See §5.8.
7. **Links.** Copy actions for the customer portal link and, when applicable, the booking form link.

**Care instruction cadence options:** `Every day`, `Every other day`, `Every third day`, `Once at the start`, `Once at the end`, `As needed`, `Custom`. `Custom` stores free text and does not participate in visit generation.

### 5.5 Stage: Confirmation (admin)

This is the stage the third product goal depends on. It is two independent actions.

**Control: "Customer's dates are firm."**

- A toggle with a plain-language label.
- Setting it records the acting admin and a timestamp.
- Unsetting it clears both and records the change in the activity log.

**Control: "Checked the family calendar."**

- A separate toggle, visually and physically separated from the first.
- Setting it records the acting admin and a timestamp.
- It must not be combined with any other change into a single save action. Toggling it is its own submission. **Settled 2026-08-20 after live evaluation at the Phase 2 review gate — see §10.** This rule encodes deliberateness as a hard constraint. It was reviewed against real use and kept.

**Behavior:**

- A booking is `Confirmed` only when both flags are set and the service range has both dates.
- Both flags are visible on the booking list, so an admin can see which of the two is missing without opening the booking.
- Both flags display their actor and date once set, for example "Checked by Kate, Aug 4".
- Any admin may set or unset either flag. There is no role restriction.
- On transition to `Confirmed`, visits are generated (§5.6) and the pricing snapshot is taken (§5.7).
- On transition to `Confirmed`, the customer receives an email confirming dates, visits, care instructions, and estimated cost, with their portal link.

### 5.6 Stage: Visits

**Generation:**

- When a booking becomes `Confirmed`, visits are generated from the care instructions that carry a participating cadence.
- Generation produces one visit per date, not one per instruction. Two instructions on the same date produce one visit carrying both.
- `Every other day` and `Every third day` anchor to the service range start date.
- `Once at the start` produces a visit on the start date. `Once at the end` produces a visit on the end date.
- `As needed` and `Custom` produce no visits.
- Regenerating after a date change preserves visits that already have a log entry and warns before removing any.

**Controls on the visit list:**

| Control | Type | Options / behavior |
|---|---|---|
| Add visit | Button | Creates a visit on a chosen date |
| Date | Date | Editable per visit |
| Time window | Select | `Morning`, `Midday`, `Afternoon`, `Evening`, `Anytime`. Default `Anytime` |
| Tasks | Chip multi-select | The booking's care instructions. Defaults to those whose cadence produced this visit |
| Duration | Number, minutes | Optional. Present for per-hour pricing. No timer, no check-in |
| Delete | Action | Confirms before deleting a visit that has a log entry |

### 5.7 Stage: Pricing

**Business-level pricing settings.** A single settings screen defines the default pricing profile as a list of components. Components are not mutually exclusive.

| Component type | Basis | Fields |
|---|---|---|
| `per_day` | Every calendar day in the service range, inclusive of both ends | Rate |
| `per_visit` | Every visit on the booking | Rate |
| `flat` | The whole booking | Amount |
| `per_hour` | Sum of visit durations | Rate |
| `custom` | Manual | Label, amount |

The default profile for the business at launch is `per_day` plus `per_visit`.

**Per-day counts every day in the service range, including days with no visit.** This is deliberate. The per-day fee covers the customer's away period, not the visits.

**Booking-level behavior:**

- A booking snapshots its pricing components when it becomes `Confirmed`. Later changes to business defaults do not alter a snapshotted booking.
- Any component on a booking can be edited, removed, or added.
- The computed day count and visit count are shown and are individually overridable, so an admin can waive a travel day without editing dates.
- **Ad-hoc line items** can be added freely: a label and an amount. This absorbs supplies, an extra key run, or a discount entered as a negative amount.
- The cost summary shows every line item, its basis, and the total.
- A "Copy summary" action produces a plain-text version an admin can paste into a message.

**Payment:**

- A single `Paid` toggle with an optional date and an optional free-text method note.
- No payment processing, no reminders, no overdue states.

### 5.8 Stage: Activity log

A dated, append-only list of what happened around a booking, including things that happened outside the app.

**Controls:**

| Control | Type | Options |
|---|---|---|
| Note | Text area | Free text |
| Source | Select | `Text message`, `In person`, `Email`, `Phone`, `Customer form`, `App` |
| Date | Date | Defaults to today, editable backward |
| Add | Button | — |

**Behavior:**

- System events are written here automatically: status changes, flag changes, date changes, price overrides, and email sends. Each records the acting admin, or `System` where there is none.
- Entries are not editable after creation. A correction is a new entry.
- The activity log is admin-only and is never shown in the customer portal.

### 5.9 Stage: Visit logging (admin)

**Controls:**

| Control | Type | Options |
|---|---|---|
| Outcome | Select | `Completed`, `Partially completed`, `Skipped`, `Could not complete` |
| Note | Text area | Free text. Shown to the customer |
| Photos | File upload | Multiple. Shown to the customer |
| Logged date | Date | Defaults to the visit date, editable |
| Save | Button | — |

**Behavior:**

- `Skipped` and `Could not complete` do not require a reason, but the note field is emphasized when they are chosen.
- A visit with a log entry is complete. A visit without one, whose date has passed, is unlogged and appears in the digest nudge block.
- Photos are compressed client-side before upload to a maximum longest edge of 1600 pixels at JPEG quality 0.8.
- Each photo has a delete action available to admins at any time.
- A visit log entry can be edited after saving. Edits are recorded in the activity log.

### 5.10 Stage: Customer portal (customer)

Reachable by the customer's link with no sign-in. One page per customer, covering all their engagements.

**Contents:**

- **Upcoming engagements.** For each: service range, status in plain language, the list of care instructions, the visit dates and time windows, and the estimated cost with its line items.
- **Past engagements.** For each: service range, the visit list, and for each visit its outcome, note, photos, and observed weather where recorded.
- **What to expect.** Static copy defined at the business level, covering how confirmation works, what the customer should provide before leaving, and how payment works.
- **Contact.** How to reach the sitter.

**Status wording shown to customers:** `Requested`, `Waiting on you`, `Waiting on us`, `Confirmed`, `In progress`, `Complete`, `Cancelled`. These are presentation labels mapped from internal status and flags. Internal status names are never shown.

**Never shown in the customer portal:** access codes, alarm codes, key locations, wifi passwords, the activity log, admin names as actors, or any other customer's data.

### 5.11 Stage: Daily digest (system)

One email per day covering everything active, sent to both admins at the same address content.

**Trigger:** a single scheduled job, once per day.

**Contents, in order:**

1. **Today.** For each booking with a visit today: the property, the visit's time window, its tasks, and a direct link to log it. If a booking is active today with no visit, it is listed with its service range only.
2. **Needs attention.** Unlogged visits from prior days, each with a link. Bookings missing either confirmation flag, each with a link. Bookings whose service range starts within seven days and which are not yet confirmed.
3. **Weather.** For each booking active today whose care instructions include an outdoor or plant-related item: high, low, chance of precipitation, expected amount, and a single derived line where precipitation is expected, such as "rain likely after 2pm".
4. **Timeline.** For each active booking, the full service range rendered as a list of dates. Past dates show a one-line truncated summary of the visit log or "no visit". Today is visually emphasized. Future dates are shown as empty placeholders.

**Behavior:**

- Sent to all admins. The content is identical for every recipient.
- Not sent when there are no active bookings and nothing needs attention.
- The send is idempotent per day. Running the job twice on the same day does not send twice.
- The job also backfills observed weather for the prior day before composing (§6.6).

### 5.12 Stage: Calendar (system)

**Setup:** the app authenticates with a Google service account, creates one dedicated calendar for the business, and grants each admin and family member access by email address through an admin settings screen.

**Events written:**

| Booking state | Event |
|---|---|
| `Inquiry` | None |
| `Tentative` | One all-day event spanning the service range, title prefixed to mark it unconfirmed |
| `Confirmed` and later | One all-day event spanning the service range, plus one timed event per visit |
| `Declined`, `Cancelled` | Events removed |

**Behavior:**

- Tentative bookings appear on the calendar. This is deliberate: the person being asked to check availability needs to see the conflict in the place they check.
- Every event carries the app's booking or visit identifier in its extended properties, so synchronization is idempotent and reconcilable after a manual edit in Google.
- Event titles use the property nickname, not the customer's full address.
- A calendar sync failure never blocks a booking action. It is recorded and retried.

---

## 6. Subsystems

### 6.1 Links and slugs

**Purpose:** give customers access to their own information with no account and no password.

**Slug format:**

- Five characters from Crockford base32 with `I`, `L`, `O`, and `U` removed, giving 28 characters and roughly 17 million combinations.
- Resolution is case-insensitive.
- Generated slugs are checked against a profanity list and regenerated on a match.
- Generated slugs are checked against a reserved word list and regenerated on a match.

**URL shape:** `sittter.com/s/<slug>`. The root path namespace is reserved for the application's own pages.

**The slug is a lookup key, not a signed token.** Every link is a database row holding its target, its type, its expiry, a revoked flag, a created timestamp, and a hit counter. Revocation is a field update. Signed payloads in the URL are explicitly not used, because they cannot be revoked.

**Link types:**

| Type | Target | Lifetime |
|---|---|---|
| `customer_portal` | A customer | Long-lived, rotatable on demand |
| `booking_form` | A booking | Valid while the booking is in `Inquiry` or `Tentative` |
| `public_intake` | The business | Permanent, one per business |

**Protection:**

- Slug resolution is rate-limited by IP.
- A revoked or expired slug returns a plain page explaining the link is no longer valid and giving a contact route. It does not reveal whether the slug ever existed.
- Admins can rotate a customer's portal link, which revokes the old slug and issues a new one.

### 6.2 Authentication

**Admins:** email magic link. An admin enters their email, receives a link, and follows it to establish a session. Only email addresses already registered as admins of the business can receive a link. Sessions are long-lived so that a phone stays signed in.

**Customers:** none. Access is by link only.

**There is one admin role.** All admins have identical capabilities. Adding a role model later is an additive change and is not designed for in V1.

**Every state-changing action records the acting admin.** This is the accountability mechanism that replaces permissions.

### 6.3 Data model concepts

Conceptual, not schema. The schema lives in `docs/dev-plan.md`.

- **Business** owns everything. Every other record carries a business identifier.
- **Admin** belongs to a business. Identified by email.
- **Customer** belongs to a business. Has a name, email, phone, and notes.
- **Property** belongs to a customer. Has a nickname, address, coordinates, access notes, and admin-only access codes. A customer may have more than one.
- **Care instruction** belongs to a property. Has a label, detail text, and cadence. A booking may carry overriding instructions that shadow the property's.
- **Booking** belongs to a property. Has a service range, an approximate-dates flag, the two confirmation flags with their actors and timestamps, a derived status, a pricing snapshot, and a paid flag.
- **Visit** belongs to a booking. Has a date, a time window, a task list, and an optional duration.
- **Visit log** belongs to a visit. Has an outcome, a note, and photos.
- **Photo** belongs to a visit log. Stored externally, referenced by key.
- **Activity entry** belongs to a booking or a customer. Has a note, a source, a date, and an actor.
- **Pricing component** belongs to a business as a default, and is copied onto a booking as a snapshot.
- **Line item** belongs to a booking. Either derived from a component or entered ad hoc.
- **Link** belongs to a business and points at a target.
- **Observed weather** belongs to a property and a date.

**Status is derived, never stored as the source of truth.** A single pure function maps a booking's flags, dates, and cancellation state to a status. Every surface reads that function.

### 6.4 Status model

| Status | Condition |
|---|---|
| `Inquiry` | No service range set |
| `Tentative` | Service range set, at least one confirmation flag unset |
| `Confirmed` | Service range set, both flags set, start date in the future |
| `In progress` | Confirmed and today falls within the service range |
| `Complete` | Confirmed and the service range has passed |
| `Closed` | Complete and marked paid |
| `Declined` | Explicitly declined by an admin |
| `Cancelled` | Explicitly cancelled by an admin |

`Declined` and `Cancelled` override all other conditions.

### 6.5 Notifications

**Channel: email only in V1.**

SMS is deliberately excluded. US carriers require application-to-person registration for business texting through any provider, including Twilio, and that registration carries a multi-week approval process and an ongoing per-campaign cost. It is also a poor fit for a business whose customers are neighbors. Outbound texting happens from an admin's own phone.

**To support that,** every screen with a shareable target carries a prominent copy action that uses the native share sheet on mobile. The app never composes message text on the admin's behalf. The admin writes their own words around the link.

**Automated emails:**

| Email | Trigger | Recipients |
|---|---|---|
| New intake received | Public intake submission | All admins |
| Booking form completed | Customer submits a pre-addressed booking form | All admins |
| Booking confirmed | Booking transitions to `Confirmed` | Customer |
| Dates changed after confirmation | Service range edited on a confirmed booking | Customer |
| Booking cancelled | Booking transitions to `Cancelled` | Customer |
| Daily digest | Scheduled job | All admins |
| Magic link | Admin sign-in request | The requesting admin |

No push notifications in V1.

### 6.6 Weather

Two distinct kinds of weather data, never conflated.

**Forecast.** Read at digest composition time for today only. Used to help the sitter plan. Never stored. If the weather provider is unavailable, the digest omits the weather section and sends anyway.

**Observed.** Fetched the following day for the prior date. Stored permanently against the property and date: maximum temperature, minimum temperature, total precipitation, and a short derived summary string. This is what appears next to a visit note in the customer portal.

**Why both:** the question a customer has in September is not what was forecast, it is whether it actually rained. A stored forecast answers the wrong question.

**Behavior:**

- Weather is fetched only for properties with at least one care instruction flagged as weather-relevant.
- Property coordinates are geocoded once when an address is saved, not on every request.
- Observed weather is displayed with a note that it is from the nearest reporting location and may differ from conditions at the property.
- Observed weather is presented as context alongside a sitter's note. It is never framed as verification of one.

### 6.7 Photo storage

- Stored in external object storage, referenced by key, never in the database.
- All access is through short-lived signed URLs. Public or guessable URLs are not used.
- Compressed client-side before upload, longest edge 1600 pixels, JPEG quality 0.8.
- Admins can delete any photo at any time.
- The admin settings screen shows total storage used, because the free tier has a cap whose overrun disables uploads rather than producing a bill.

**These are the most sensitive records in the system.** They are photographs of the inside of other people's homes. Any change touching photo access is a security change.

### 6.8 Multi-tenancy posture

The data model is multi-tenant. The product is not.

**Present in V1:** a business identifier on every record, every query scoped by it, rates and settings stored as data rather than constants, and business name and contact details in configuration rather than hard-coded.

**Absent in V1:** sign-up, plan selection, billing, tenant onboarding, per-tenant domains, invitations, and roles.

---

## 7. Copy and expectation-setting

The customer-facing static copy is part of the product, not decoration. It lives in business-level settings so it is editable without a deploy.

**Required copy blocks:**

1. **How confirmation works.** That a request is not a booking, that dates get checked against a family calendar, and that the customer will receive a confirmation email.
2. **What to leave for the sitter.** Key or garage code, where food and supplies are kept, the feeding schedule, anything the pet does that would worry a stranger, and the vet's contact details.
3. **How pricing works.** The per-day and per-visit structure stated plainly with the current rates.
4. **How payment works.** When it is due and how it is paid.
5. **What happens if something changes.** How to reach the sitter about a date change or an early return.

---

## 8. Non-functional expectations

- **Admin capture in under thirty seconds** on a phone, for a returning admin creating a booking with a new customer name, a date range, and a note.
- **Mobile first for the admin surface.** The sitter's primary device is a phone, often used while standing in someone's driveway.
- **The customer portal must render on a phone with no sign-in and no app install.**
- **A failed integration never blocks a core action.** Calendar sync, weather, and email failures are recorded and retried. They do not prevent creating, editing, or confirming a booking.
- **The daily job is idempotent.** It is safe to run twice on the same day and safe to trigger manually.
- **No data loss on link rotation.** Rotating a customer link changes access, never content.

---

## 9. Out of scope for V1

Each of these was discussed and deliberately excluded. This list is the thing to point at when a task starts to grow.

| Excluded | Reason |
|---|---|
| Payment processing | The sitter is a minor and cannot hold a processor account. Fees are material on a thirty-five dollar job. Money already changes hands fine. |
| SMS notifications | Carrier registration is a multi-week process with ongoing cost, and it is a poor fit for neighbors. |
| Push notifications | Requires an installed web app. Email covers V1. |
| Customer accounts and passwords | Signed links deliver the same access with no friction. Reconsider only when something exists that should not sit behind a link. |
| In-app messaging | Communication happens between people. The app records it. |
| Recurring or standing bookings | Not yet a real need. |
| Multiple sitters, assignment, or scheduling conflicts | One sitter. |
| Roles and permissions | Two admins who live in the same house. Additive later. |
| Ratings and reviews | Not a marketplace. |
| Route optimization | One neighborhood. |
| Native mobile apps | The web surface is sufficient. |
| Automatic ingestion of text messages | Technically infeasible on iOS and privacy-invasive. Manual activity entries do the job. |
| Multi-timezone support | Single-timezone assumption stated in §2.5. |
| Time tracking with check-in and check-out | The per-hour pricing component accepts a manually entered duration. No timers. |
| Tenant sign-up and billing | The data model supports multi-tenancy. The product does not expose it. |

---

## 10. Open questions

None blocking. Items deliberately deferred rather than decided:

- ~~**Whether "Checked the family calendar" must be its own isolated submission (§5.5).**~~ **RESOLVED 2026-08-20 at the Phase 2 review gate: the rule stands as written.** It was built exactly as specified and evaluated against live use. The isolation is enforced structurally — the service function that sets the flag takes a booking and a boolean and nothing else, so a combined save is impossible rather than merely discouraged. It is no longer an open question, and §5.5's "Under review" note no longer applies.
- Whether the digest should also send the evening before. V1 sends once, in the morning, with the hour configurable. Revisit after a season of real use.
- Whether the customer portal should show a running total across all engagements. Excluded from V1 to avoid implying an account balance.
- Whether property access codes should be encrypted at rest beyond database-level encryption. V1 relies on database encryption and admin-only access. Revisit before any second business uses the system.
