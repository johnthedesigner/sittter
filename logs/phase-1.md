# Phase 1 session entries — archived

> Moved out of `SESSION_LOG.md` at the Phase 1 housekeeping session on
> 2026-08-19, per `docs/META-PLAN.md` §8. Newest first.
>
> **A correction about these entries.** They were RECONSTRUCTED at
> housekeeping from the per-task commit messages, not written at the end of
> each session as `AGENTS.md` requires. The Current State block was replaced
> after every task, but the session entries themselves were skipped — five
> times, unnoticed, and the Phase 1 gate item claiming otherwise was ticked in
> error. The commit messages were written per task at the time and are
> detailed, so the content below is faithful rather than invented; but its
> provenance is a commit, not a session log, and that difference is recorded
> here rather than papered over.
>
> Current state and open decisions live in `SESSION_LOG.md`. The phase
> retrospective is `docs/phase-1-retro.md`.

---


## 2026-08-19 — Task 1.5: Sign-in surface and the session guard

*Reconstructed from commit `6eac75e`.*

Journey 8 covered end to end, steps 8.1.1 through 8.1.6, plus five more
specs for failure modes the journey does not name: expired link, tampered
token, no token at all, garbage session cookie, and the guard redirecting an
unauthenticated visitor.

8.1.5 is the one that mattered most. It submits an unregistered address and a
registered one through the same helper, waits for the same URL state so the
two captures are not racing the redirect, and asserts the rendered text is
byte-identical. If the page ever distinguished them it would be telling a
stranger which addresses belong to admins.

Route handler and action are thin: read input, call a service, redirect. The
only @/db import in src/app is getOnlyBusiness, which is a repository call
and so the permitted path. Every failure in the callback produces the same
redirect, so the URL reveals nothing about which one occurred.

Three things cost time and are recorded in the retro. Playwright pulled the
server-component graph into the test process because the copy constants lived
in page.tsx and dragged in next/navigation; copy moved to signin/copy.ts,
which imports nothing. pnpm build rewrote tsconfig's jsx to react-jsx on
first run. And e2e cannot follow a real email by construction — the plaintext
token exists only in the emailed URL, which is the property the design wants
— so e2e/fixtures.ts mints a link directly and the web server runs with a
RESEND_API_KEY that cannot authenticate, so no mail is sent.

Phase 1: 206 unit, 100 integration, 11 e2e. build, typecheck, lint, and
prettier pass. Retrospective in docs/phase-1-retro.md, plan-summary status
line updated, user-journeys coverage table now carries Journey 8.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

**Files changed:**

```
AGENTS.md                          |  10 +++
 SESSION_LOG.md                     |  34 +++++----
 docs/phase-1-retro.md              |  75 ++++++++++++++++++++
 docs/plan-summary.md               |   6 +-
 docs/user-journeys.md              |   7 +-
 e2e/fixtures.ts                    | 103 +++++++++++++++++++++++++++
 e2e/journey-8.spec.ts              | 138 +++++++++++++++++++++++++++++++++++++
 playwright.config.ts               |  27 +++++++-
 src/app/(admin)/actions/.gitkeep   |   0
 src/app/(admin)/actions/auth.ts    |  38 ++++++++++
 src/app/(admin)/home/.gitkeep      |   0
 src/app/(admin)/home/page.tsx      |  25 +++++++
 src/app/(admin)/layout.tsx         |  32 +++++++++
 src/app/(admin)/settings/.gitkeep  |   0
 src/app/api/auth/callback/.gitkeep |   0
 src/app/api/auth/callback/route.ts |  30 ++++++++
 src/app/globals.css                |   3 +
 src/app/layout.tsx                 |  17 +++++
 src/app/page.tsx                   |   6 ++
 src/app/signin/.gitkeep            |   0
 src/app/signin/copy.ts             |  20 ++++++
 src/app/signin/page.tsx            |  67 ++++++++++++++++++
 tasks/phase-1.md                   |  66 +++++++++---------
 tsconfig.json                      |  23 +++++--
 vitest.integration.config.ts       |  16 +++--
 25 files changed, 675 insertions(+), 68 deletions(-)
```

---


## 2026-08-19 — Task 1.4: Magic link issue and consume

*Reconstructed from commit `4d51c82`.*

Tokens are 32 bytes from node:crypto randomBytes, base64url. Math.random
appears nowhere in the auth path, proved by a test that makes it throw and
then exercises issue and session creation.

Only SHA-256 hashes are stored. A test issues a link, consumes it, then reads
every row of magic_link_tokens and sessions and asserts neither the link
token nor the session token appears anywhere in them — while the hash does.

Everything fails closed, each with its own test rather than inferred from a
sibling: expired, one millisecond before expiry, exactly at the expiry
instant, already consumed, tampered by one character, well-formed but never
issued, empty, belonging to another business, and belonging to an admin
deleted since issue. The last resolves to null rather than throwing, which is
the case most likely to have been an unhandled crash.

issueMagicLink returns { requested: true } identically for a registered
address, an unregistered one, and a delivery failure. Tests assert the values
are equal, that no token row is written, and that no email_sends row appears
for an unregistered address — journey step 8.1.5.

A consumed token creates no second session, asserted by counting rows rather
than by trusting the return value.

SHA-256 is deliberate, not an oversight: these are 256-bit random tokens, not
passwords, so there is no dictionary to attack and key stretching would only
cost latency on every request. Comparison is timingSafeEqual.

The cookie is sameSite lax, not strict, and a test says why: strict drops the
cookie on the cross-site navigation from a mail client, and sign-in would
appear to silently fail. Options are asserted against the object the writer
passes, so the test cannot drift from what a real response sets.

206 unit, 100 integration. typecheck, lint, all runners, prettier pass.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

**Files changed:**

```
SESSION_LOG.md            |  30 ++--
 src/lib/session.ts        |  49 +++++++
 src/services/auth.test.ts | 358 ++++++++++++++++++++++++++++++++++++++++++++++
 src/services/auth.ts      | 192 +++++++++++++++++++++++++
 tasks/phase-1.md          |  34 ++---
 5 files changed, 632 insertions(+), 31 deletions(-)
```

---


## 2026-08-19 — Task 1.3: The email service and its send log

*Reconstructed from commit `1e5c1a3`.*

src/services/email.ts is the only file importing resend, verified by grep.
Everything else sends through it.

A send never throws. Delivery failing must not block a core write, so callers
inspect { ok, providerId, error, attempts } instead of catching. Retry is
exactly one further attempt, and a test queues three failures to prove the
provider is called twice and never a third time.

One email_sends row per send, not per attempt — a row per attempt would make
the log read as though twice as many emails went out. Success records the
provider id with a null error; double failure records the last error with a
null provider id, and both are asserted by reading the row back.

The Resend fake replaces the module itself rather than a hand-rolled seam,
which is what proves the vendor boundary: nothing else in the codebase would
notice resend being swapped out.

Copy is exported from the template as MAGIC_LINK_COPY so the test asserts the
same strings the template renders, rather than a second copy that can drift.
Assertions decode HTML entities first — react-email escapes the apostrophe in
"didn't", and asserting the escaped form would tie the test to an encoding
detail instead of the words a human reads.

Two toolchain notes. Vite 8 replaced esbuild with oxc and silently ignores
the esbuild config key, so the JSX override is oxc: { jsx: { runtime:
'automatic' } }; without it .tsx fails as "content contains invalid JS
syntax" because Vite reads jsx: "preserve" straight from tsconfig.

The shared fake lives at src/services/testing/resend-fake.ts, not the
e2e/fixtures.ts the task file named. e2e/ is Playwright's directory and a
Vitest module mock does not belong there; e2e/fixtures.ts arrives in Task 1.5
when Playwright needs it, rather than being created empty now as a
placeholder. Recorded in SESSION_LOG and against the task's file list.

206 unit, 66 integration. typecheck, lint, all runners, prettier pass.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

**Files changed:**

```
SESSION_LOG.md                      |  29 +++--
 src/emails/layout.tsx               |  61 +++++++++
 src/emails/magic-link.tsx           |  53 ++++++++
 src/services/email.test.ts          | 242 ++++++++++++++++++++++++++++++++++++
 src/services/email.ts               | 118 ++++++++++++++++++
 src/services/testing/resend-fake.ts |  80 ++++++++++++
 tasks/phase-1.md                    |  30 ++---
 vitest.integration.config.ts        |   6 +
 8 files changed, 591 insertions(+), 28 deletions(-)
```

---


## 2026-08-19 — Task 1.2: Repositories and the seed fixture

*Reconstructed from commit `147b13b`.*

15 repository modules, 71 functions, 49 integration tests against the Neon
test branch. Every write test reads the row back; every read test seeds a
second business and proves isolation.

70 of 71 functions take businessId as their first argument. The exception is
createBusiness, which creates the business and so has nothing to scope by;
businesses.ts documents it and getOnlyBusiness as the only two, both
bootstrap.

The audit caught findLinkBySlug and recordLinkHit taking a slug and no
business. A slug is globally unique and /s/[slug] carries no business
context, so it was tempting to leave them — which is exactly the shortcut
AGENTS.md warns about, since retrofitting means auditing every query. They
now take businessId, the caller resolves it first, and a test proves another
business can neither resolve the slug nor count a hit against it.

Access codes are excluded at the query layer, not the template.
getPropertyForPortal names its four columns, and a test asserts the returned
object's keys and that the serialized result contains neither the seeded
access code nor the access notes. activity.ts deliberately has no
customer-facing read at all.

The seed refuses to run against a non-empty database rather than attempting
idempotency — upserting eleven tables invites a half-applied seed that looks
fine. It takes a reference date so the fixture is a pure function of its
argument, and its three bookings derive confirmed, tentative, and inquiry.

passWithNoTests removed from both vitest configs, not just the integration
one: the unit suite has 206 tests, so the same silent-failure risk applied.
Both now exit non-zero on an empty glob, verified.

src/db/testing/database.ts refuses any target but the test branch. These
tests truncate all 21 tables, and a wrong target would surface as a
confusing empty screen rather than an error.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

**Files changed:**

```
SESSION_LOG.md                           |  30 +-
 src/db/repositories/activity.ts          |  47 ++
 src/db/repositories/admins.ts            |  66 +++
 src/db/repositories/auth.ts              | 116 +++++
 src/db/repositories/bookings.ts          |  62 +++
 src/db/repositories/businesses.ts        |  54 +++
 src/db/repositories/calendar-events.ts   |  57 +++
 src/db/repositories/care-instructions.ts |  55 +++
 src/db/repositories/customers.ts         |  75 ++++
 src/db/repositories/email-sends.ts       |  52 +++
 src/db/repositories/links.ts             |  70 +++
 src/db/repositories/photos.ts            |  54 +++
 src/db/repositories/pricing.ts           |  69 +++
 src/db/repositories/properties.ts        |  86 ++++
 src/db/repositories/repositories.test.ts | 739 +++++++++++++++++++++++++++++++
 src/db/repositories/visit-logs.ts        |  42 ++
 src/db/repositories/visits.ts            |  71 +++
 src/db/repositories/weather.ts           |  46 ++
 src/db/seed.ts                           | 263 +++++++++++
 src/db/testing/database.ts               | 102 +++++
 tasks/phase-1.md                         |  30 +-
 vitest.config.ts                         |   4 -
 vitest.integration.config.ts             |  15 +-
 23 files changed, 2163 insertions(+), 42 deletions(-)
```

---


## 2026-08-19 — Task 1.1: Schema, client, env, and the first migration

*Reconstructed from commit `6c01815`.*

All eleven criteria pass. Migration applied to Neon twice: 21 tables, 7
enums, 4 check constraints, one journal row after two runs, no status column
on bookings, every cents column integer, every calendar column date.

Two defects found while closing the last two criteria.

dotenv was installed but never imported, so drizzle.config.ts had been
reading process.env.DATABASE_URL as undefined the whole time. Next.js loads
.env on its own; drizzle-kit, tsx, and vitest do not. Fixed in
drizzle.config.ts, and recorded for Task 1.2, where db:seed and the
integration config each need the same and the latter must load .env.test.

.gitignore covered .env and .env.local but not .env.test, which was created
later and holds a live Neon connection string. It was untracked and never
committed — caught before any damage. The rule now ignores the whole .env
family and re-allows .env.example, so the next variant someone invents is
covered by default rather than by memory.

Database decision recorded in SESSION_LOG: one Neon project, main and test
branches. A branch is a copy-on-write clone with its own compute, so
integration tests cannot reach development data and the branch resets
instantly. Both use DATABASE_URL under the same name in different env files,
so dev-plan §4's variable list is unchanged. Neon Auth is off: it would
create tables outside the migration chain, and spec §6.2 already specifies
magic link auth.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

**Files changed:**

```
.gitignore        |  9 +++++++--
 SESSION_LOG.md    | 53 +++++++++++++++++------------------------------------
 drizzle.config.ts |  5 +++++
 tasks/phase-1.md  | 26 +++++++++++++-------------
 4 files changed, 42 insertions(+), 51 deletions(-)
```

---
