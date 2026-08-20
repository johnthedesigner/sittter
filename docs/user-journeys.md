# sittter — User Journeys and Test Coverage

> **Purpose:** describe end-to-end behavior in observable steps, so that a question the test suite cannot answer becomes answerable: is there behavior that should work by now and does not?
> **Audience:** human and agent
> **Companion:** `docs/spec.md` defines the controls. This document defines the sequences.

Each journey is numbered. Each stage within a journey is numbered `N.M`. Each step is numbered `N.M.X` and describes one observable user action and its outcome. Steps do not describe internal state changes and do not bundle two decisions.

---

## Process rules

These two rules live in this file and are followed without being asked.

> **Maintenance rule.** At every phase boundary, before starting the next phase: read the next phase's task file in full. For each task, ask whether it unlocks user-facing behavior not yet described here. If so, add or extend a journey. Ask whether any deferred step has become testable. If so, remove the deferral. Ask whether any step's behavior has changed. If so, revise it. Then update the coverage table.

> **Per-task rule.** At the start of any task that touches the frontend or a user-facing API: identify which journey steps it enables, add those step numbers to the task's acceptance criteria, cite them in the test file header, and update the coverage table when marking the task complete.

---

## Journey 1 — A neighbor asks in person, and the booking becomes confirmed

The primary path. This is the journey the product exists for.

### 1.1 Fast capture

| Step | Action | Expected result |
|---|---|---|
| 1.1.1 | Admin opens the app on a phone while already signed in | Home screen loads showing today's visits and a needs-attention list |
| 1.1.2 | Admin taps "New booking" | Capture form appears with the customer field focused |
| 1.1.3 | Admin types a name that does not match any existing customer | The combobox offers to create a new customer with that name |
| 1.1.4 | Admin selects the create option | Customer field shows the name; property defaults to a new property |
| 1.1.5 | Admin enters a start date and an end date | "Dates are approximate" turns on automatically |
| 1.1.6 | Admin types a one-line note about what was asked for | Note field accepts the text |
| 1.1.7 | Admin taps Save | Booking detail screen loads; status reads Tentative; the note appears as the first activity entry |

### 1.2 Filling in the details later

| Step | Action | Expected result |
|---|---|---|
| 1.2.1 | Admin opens the booking from the booking list | Detail screen shows an empty care instruction list |
| 1.2.2 | Admin adds an instruction labeled Cats with detail text and cadence "Every day" | Instruction appears in the list and is attached to the property |
| 1.2.3 | Admin adds an instruction labeled Plants with cadence "Every other day" and marks it weather relevant | Instruction appears in the list |
| 1.2.4 | Admin enters the property address | Address is saved and shown on the property |
| 1.2.5 | Admin enters a garage code in the access field | Field is visibly labeled as admin only |
| 1.2.6 | Admin adds an activity entry with source "Text message" recording a date change the customer sent | Entry appears in the activity log with that source and date |

### 1.3 Confirmation

| Step | Action | Expected result |
|---|---|---|
| 1.3.1 | Admin toggles "Customer's dates are firm" | Toggle is set and shows the acting admin's name and today's date |
| 1.3.2 | Admin returns to the booking list | The booking shows one confirmation flag set and one unset |
| 1.3.3 | The second admin signs in and opens the same booking | Both flag states are visible with the first admin's attribution |
| 1.3.4 | The second admin toggles "Checked the family calendar" | Toggle is set and attributed to the second admin |
| 1.3.5 | The screen updates | Status reads Confirmed |
| 1.3.6 | Admin scrolls to the visit list | Visits are generated with one entry per date, and dates carrying both cats and plants show both tasks on a single visit |
| 1.3.7 | Admin scrolls to the pricing section | Line items show the per-day and per-visit components with a total |
| 1.3.8 | The customer checks their email | A confirmation email has arrived with dates, visits, care instructions, estimated cost, and a portal link |

---

## Journey 2 — A customer submits a request through the public link

### 2.1 Submission

| Step | Action | Expected result |
|---|---|---|
| 2.1.1 | Customer opens the public intake link on a phone | Intake form loads with no sign-in prompt |
| 2.1.2 | Customer enters their name and email | Fields accept the values |
| 2.1.3 | Customer enters an approximate date range and leaves "These dates are not final yet" checked | Form accepts the range |
| 2.1.4 | Customer selects the Cats and Mail chips | Both chips show as selected |
| 2.1.5 | Customer types free text describing the feeding schedule | Text area accepts the text |
| 2.1.6 | Customer submits | A confirmation screen states the request was received, that dates are not confirmed until someone follows up, and shows their portal link |

### 2.2 What the admins see

| Step | Action | Expected result |
|---|---|---|
| 2.2.1 | Both admins check email | An intake notification has arrived with a link to the new booking |
| 2.2.2 | An admin opens the booking | Status reads Tentative; care instructions exist for Cats, Mail, and a General item holding the free text |
| 2.2.3 | An admin opens the activity log | An entry records the submission with source "Customer form" |

### 2.3 A returning customer

| Step | Action | Expected result |
|---|---|---|
| 2.3.1 | The same customer submits the form again months later with the same email | A second booking is created against the existing customer, not a duplicate customer |
| 2.3.2 | An admin opens the new booking | The property's existing care instructions are already present |

---

## Journey 3 — A customer completes a pre-addressed booking form

### 3.1 Completion

| Step | Action | Expected result |
|---|---|---|
| 3.1.1 | Admin opens a booking created by fast capture and copies the booking form link | The share sheet opens on mobile with the link |
| 3.1.2 | Customer opens the link | The intake form loads with their name, email, and dates already filled in |
| 3.1.3 | Customer corrects the end date and adds detail about the cat's medication | Fields accept the changes |
| 3.1.4 | Customer submits | A confirmation screen appears; no duplicate booking is created |
| 3.1.5 | Admin opens the booking's activity log | Entries record each field the customer changed, with source "Customer form" |

### 3.2 After confirmation

| Step | Action | Expected result |
|---|---|---|
| 3.2.1 | Admins confirm the booking per journey 1.3 | Status reads Confirmed |
| 3.2.2 | Customer opens the same link again | The link now resolves to their customer portal rather than the form |

---

## Journey 4 — Working a booking, day by day

### 4.1 A normal visit

| Step | Action | Expected result |
|---|---|---|
| 4.1.1 | Sitter opens the app on the morning of a visit | Home screen shows today's visit with its property and tasks |
| 4.1.2 | Sitter taps the visit | Visit screen shows the tasks, the property's access notes, and a log form |
| 4.1.3 | Sitter selects outcome "Completed" and types a short note | Form accepts both |
| 4.1.4 | Sitter attaches two photos from the camera roll | Photos upload and appear as thumbnails |
| 4.1.5 | Sitter saves | Visit shows as logged; the home screen no longer lists it as outstanding |

### 4.2 A visit that did not go to plan

| Step | Action | Expected result |
|---|---|---|
| 4.2.1 | Sitter opens a plant-watering visit on a rainy day | Visit screen loads |
| 4.2.2 | Sitter selects outcome "Skipped" | The note field is visually emphasized |
| 4.2.3 | Sitter types a reason and saves | Visit shows as logged with the skipped outcome |
| 4.2.4 | Sitter opens a cat visit where the cat hid, selects "Partially completed", writes a note, and saves | Visit shows as logged with the partial outcome |

### 4.3 Changing the plan mid-booking

| Step | Action | Expected result |
|---|---|---|
| 4.3.1 | Admin adds a visit on a date not originally generated | Visit appears in the list |
| 4.3.2 | Admin deletes an upcoming visit that has no log | Visit is removed without a warning |
| 4.3.3 | Admin attempts to delete a past visit that has a log | A confirmation is required before deletion |
| 4.3.4 | Admin changes the booking's end date and regenerates visits | A warning names the logged visits that would be removed, and logged visits are preserved |

---

## Journey 5 — A customer follows what is happening

### 5.1 Before service

| Step | Action | Expected result |
|---|---|---|
| 5.1.1 | Customer opens their portal link | Portal loads with no sign-in |
| 5.1.2 | Customer reads the upcoming engagement | Dates, plain-language status, care instructions, visit dates with time windows, and an estimated cost with line items are all shown |
| 5.1.3 | Customer reads the expectations section | Copy explains how confirmation works, what to leave out, how pricing works, and how payment works |
| 5.1.4 | Customer looks for their garage code | No access code, alarm code, or key location appears anywhere on the page |

### 5.2 After service

| Step | Action | Expected result |
|---|---|---|
| 5.2.1 | Customer returns to the portal after the trip | The engagement appears under past engagements |
| 5.2.2 | Customer opens a past visit | The outcome, the sitter's note, and the photos are shown |
| 5.2.3 | Customer views a skipped plant-watering day | The recorded observed weather for that date is shown alongside the note, labeled as nearest-location data |
| 5.2.4 | Customer looks for a record of their text messages | The activity log does not appear anywhere in the portal |

### 5.3 Link hygiene

| Step | Action | Expected result |
|---|---|---|
| 5.3.1 | Admin rotates the customer's portal link | A new link is issued |
| 5.3.2 | Customer opens the old link | A plain page explains the link is no longer valid and gives a way to get in touch, without revealing whether the link ever existed |
| 5.3.3 | Customer opens the new link | The portal loads with all previous content intact |

---

## Journey 6 — The daily digest

### 6.1 Receiving it

| Step | Action | Expected result |
|---|---|---|
| 6.1.1 | Both admins check email in the morning during an active booking | One digest email has arrived, identical for both |
| 6.1.2 | Admin reads the Today section | Each booking with a visit today shows the property, time window, tasks, and a link to log it |
| 6.1.3 | Admin reads the Needs attention section | Unlogged visits from prior days appear with links, as do bookings missing either confirmation flag |
| 6.1.4 | Admin reads the Weather section | Weather appears only for bookings with a weather-relevant care instruction |
| 6.1.5 | Admin reads the Timeline section | The booking's full service range is listed, past days truncated, today emphasized, future days empty |
| 6.1.6 | Admin taps a log link from the email | The visit log form opens for the correct visit |

### 6.2 Quiet days

| Step | Action | Expected result |
|---|---|---|
| 6.2.1 | The job runs on a day with no active bookings and nothing needing attention | No email is sent |
| 6.2.2 | The job runs on a day with no visits but with an unconfirmed booking starting in five days | An email is sent containing only the needs-attention item |

---

## Journey 7 — The family calendar

### 7.1 A tentative booking appears

| Step | Action | Expected result |
|---|---|---|
| 7.1.1 | Admin adds a family member's email in settings | The calendar is shared with that address |
| 7.1.2 | The family member accepts and opens Google Calendar | The sitting calendar appears alongside their own |
| 7.1.3 | An admin saves a booking with dates but no confirmations | An all-day event spanning the range appears, visibly marked as unconfirmed |
| 7.1.4 | The family member checks the calendar before answering the availability question | The tentative event is visible against their existing commitments |

### 7.2 Confirmation and change

| Step | Action | Expected result |
|---|---|---|
| 7.2.1 | The booking becomes Confirmed | The all-day event loses its unconfirmed marking, and one timed event per visit appears |
| 7.2.2 | An admin changes the booking's end date | The all-day event and the visit events update to match |
| 7.2.3 | An admin cancels the booking | All associated events are removed |
| 7.2.4 | A family member edits an event's title directly in Google, then an admin changes the booking | The app reconciles the event without creating a duplicate |

### 7.3 Failure

| Step | Action | Expected result |
|---|---|---|
| 7.3.1 | The calendar service is unreachable and an admin confirms a booking | The booking saves and shows as Confirmed |
| 7.3.2 | The service recovers and the daily job runs | The missing events appear |

---

## Journey 8 — Signing in

| Step | Action | Expected result |
|---|---|---|
| 8.1.1 | Admin opens the app while signed out | The sign-in page loads |
| 8.1.2 | Admin enters their registered email | A message says a link has been sent, without confirming whether the address is registered |
| 8.1.3 | Admin opens the emailed link | A session is created and the home screen loads |
| 8.1.4 | Admin opens the same link a second time | The link no longer works |
| 8.1.5 | A person enters an email that is not a registered admin | The same message appears and no email is sent |
| 8.1.6 | Admin returns to the app days later on the same phone | They are still signed in |

---

## Journey 9 — An engagement that does not fit the standard pricing

| Step | Action | Expected result |
|---|---|---|
| 9.1.1 | Admin opens a confirmed booking's pricing section | The snapshotted components are shown with the computed day and visit counts |
| 9.1.2 | Admin overrides the day count downward to waive a travel day | The total recalculates without the dates changing |
| 9.1.3 | Admin adds an ad-hoc line item for cat litter with a positive amount | The line appears and the total increases |
| 9.1.4 | Admin adds an ad-hoc line item with a negative amount as a discount | The line appears and the total decreases |
| 9.1.5 | Admin taps "Copy summary" | A plain-text itemized summary is placed on the clipboard |
| 9.1.6 | Admin raises the business default per-day rate in settings | The confirmed booking's total does not change |
| 9.1.7 | Admin marks the booking paid with a method note | Status reads Closed |

---

## Test coverage

Populated as tasks complete, per the per-task rule above. A journey step range is covered when a named test asserts its expected result.

| Journey steps | Test file | Test name | Phase |
|---|---|---|---|
| 1.1.1 | `e2e/journey-1.spec.ts` | the home screen shows today and a needs-attention list | 2 |
| 1.3.2 | `e2e/journey-1.spec.ts` | one flag set and one unset is visible without opening the booking | 2 |
| 8.1.1 | `e2e/journey-8.spec.ts` | opening the app signed out loads the sign-in page | 1 |
| 8.1.2 | `e2e/journey-8.spec.ts` | submitting a registered email shows the confirmation message | 1 |
| 8.1.3 | `e2e/journey-8.spec.ts` | following the link creates a session and loads home | 1 |
| 8.1.4 | `e2e/journey-8.spec.ts` | the same link a second time no longer works | 1 |
| 8.1.5 | `e2e/journey-8.spec.ts` | an unregistered email shows the SAME message | 1 |
| 8.1.6 | `e2e/journey-8.spec.ts` | the session survives a new browser context on the same device | 1 |

> **Phase boundary review, 2026-08-19 (Phase 1 → Phase 2).** `tasks/phase-2.md` read in full. Phase 2 enables 30 steps across Journeys 1, 4, and 9 — every step of Journey 1 except **1.3.8**, all of 4.3, and all of 9.1. No journey needed adding, extending, or revising: the task file was written from these journeys rather than the reverse.
>
> **1.3.8 is deliberately not a Phase 2 step.** It expects a confirmation email carrying a portal link. `docs/spec.md` §5.5 describes that email as part of the confirmation stage, but links do not exist until Phase 3 — so the state transition happens in Phase 2 and the notification in Phase 3. `tasks/phase-2.md` Task 2.4 carries an explicit must-not-do saying so, because it is an easy thing to pull in by mistake while reading §5.5.
>
> Journey 4 steps 4.1 and 4.2 remain uncovered: they are visit logging with photos, which is Phase 4.

> **Phase boundary review, 2026-08-19 (Phase 0 → Phase 1).** `tasks/phase-1.md` read in full. Phase 0 enabled no journey steps — it produced `src/core/` and no user-facing surface. Phase 1 enables Journey 8 (8.1.1–8.1.6) and nothing else; Journey 8 already describes that behavior completely, so no journey was added, extended, or revised, and no deferral became testable. The row for Journey 8 is added when Task 1.5 completes, per the per-task rule.

### Steps not covered by automated tests

Populated as coverage decisions are made. Each entry names a reason: deferred, manual-only, or covered by integration tests.

| Journey steps | Reason | Notes |
|---|---|---|
| 1.1.1–1.1.7 | Manual, in addition to automated | The thirty-second capture target is a human timing measurement and cannot be asserted by a test. The functional path is automated; the timing is checked by hand at the Phase 2 review gate. |
| 4.1.4 | Manual, in addition to automated | Client-side photo compression performance on a real phone is measured by hand. The upload path itself is automated. |
| 6.1.1–6.1.6 | Manual, in addition to automated | Email rendering in a real mail client is checked by eye. The digest model and the send are automated. |
| 7.1.2 | Manual only | Whether a shared calendar appears in a family member's Google Calendar cannot be asserted from the application. Verified during the pre-flight spike and again at the Phase 5 review gate. |
