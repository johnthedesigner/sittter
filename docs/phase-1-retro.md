# Phase 1 retrospective — Persistence and admin authentication

**Completed:** 2026-08-19
**Sessions:** 5 (Tasks 1.1 through 1.5)
**Output:** 21 tables on Neon, 15 repository modules, magic-link authentication, and one stub page that proves the chain from cookie to database.

**Tests:** 206 unit, 100 integration, 11 end-to-end. `pnpm build` passes.

---

## What the phase produced

| Layer | What exists |
|---|---|
| `src/db/schema.ts` | 21 tables, 7 enums, 4 check constraints, one generated migration |
| `src/db/repositories/` | 15 modules, 71 functions, every one scoped by business |
| `src/db/seed.ts` | One business, two admins, two customers, three bookings in three states |
| `src/services/email.ts` | The only file importing `resend`; send log and one retry |
| `src/services/auth.ts` | Magic link issue and consume, session lifecycle |
| `src/app/` | `/signin`, `/api/auth/callback`, the `(admin)` guard, `/home` |
| `e2e/journey-8.spec.ts` | Journey 8, steps 8.1.1–8.1.6 |

---

## What worked

**Writing a test per failure mode rather than inferring from a sibling.** Authentication has nine distinct ways to fail — expired, one millisecond before expiry, exactly at expiry, consumed, tampered, well-formed but never issued, empty, wrong business, and admin-deleted-since-issue. Each got its own test. The last one is the case that would otherwise have been an unhandled crash, because the token row cascade-deletes with the admin and the code path had never been walked.

**Asserting the absence of the plaintext token.** One test issues a link, consumes it, then reads every row of `magic_link_tokens` and `sessions` and asserts neither token appears anywhere in them, while confirming the hash does. "Only hashes are stored" went from an intention to a fact.

**The business-scoping audit found a real violation.** `findLinkBySlug` and `recordLinkHit` were written without a business identifier, with what felt like good reasoning: a slug is globally unique and `/s/[slug]` carries no business context. That is exactly the shortcut AGENTS.md names — retrofitting means auditing every query. Both now take `businessId`, and a test proves another business can neither resolve the slug nor count a hit against it.

**Excluding sensitive columns at the query layer.** `getPropertyForPortal` names its four columns, and the test asserts the returned object's keys *and* that the serialized result contains neither the seeded access code nor the access notes. A future `select()` with no column list fails rather than quietly leaking. `activity.ts` has no customer-facing read function at all.

**Refusing to seed a non-empty database.** Upserting across eleven tables invites a half-applied seed that looks fine. A clear refusal does not, and both behaviours are tested.

---

## What was harder than expected

**The toolchain again, and in the same proportion as Phase 0.** Four separate incidents, none interesting on its own:

- `dotenv` was installed but never imported, so `drizzle.config.ts` had been reading `DATABASE_URL` as `undefined` from the moment it was written. Nothing outside Next.js loads a `.env` file.
- `.gitignore` covered `.env` and `.env.local` but not `.env.test`, which was created later and holds a live Neon credential. Untracked and never committed, so nothing leaked — but it was one `git add -A` from being a real incident. The rule now covers the whole family and re-allows `.env.example`.
- Vite 8 replaced esbuild with oxc and **silently ignores** the old `esbuild` config key, so the first two attempts at a JSX override looked like the option having no effect.
- `pnpm build` rewrote `tsconfig.json`, setting `jsx` to `react-jsx` — "mandatory changes were made to your tsconfig.json". That resolved the JSX problem at the source, but only for anyone who has built before they test.

The pattern across both phases: **budget a toolchain session per phase, and record each incident rather than absorbing it.** Every one of these cost more time than any logic in the phase.

**Playwright pulled the server-component graph into the test process.** Importing the copy constants from `src/app/signin/page.tsx` dragged `next/navigation` in and failed at module resolution. Copy moved to `src/app/signin/copy.ts`, which imports nothing. That is a better home for it regardless, and the lesson generalizes: anything a test needs to assert on should live in a module with no framework imports.

**End-to-end sign-in cannot follow a real email, by construction.** The plaintext token exists only in the emailed URL, so there is no way to recover one from the database — which is the property the design is aiming for. `e2e/fixtures.ts` mints a link directly, playing the role the email plays in real use. The web server is started with a `RESEND_API_KEY` that cannot authenticate, so exercising the real form on journey step 8.1.2 sends no mail; the 401s in the log are the "integrations fail soft" rule holding, visibly.

---

## Decisions the human still owns

Unchanged from Phase 0, and none blocked Phase 1. All five are set out with recommendations in `docs/phase-0-retro.md`:

1. The `src/core/` import rule versus `obscenity`
2. The Vercel cron schedule, before Phase 6
3. The TypeScript 6 pin, whenever `typescript-eslint` supports TS 7
4. `docs/spec.md` §5.12 and two-step calendar onboarding, before Phase 5
5. AGENTS.md lists `src/app/api/photos/[id]/route.ts`; `docs/dev-plan.md` §3 does not

One new item, small: **the session cookie's attributes should be read off a real response by hand.** They are asserted against the object the writer passes, which cannot drift from what is set — but the phase gate asks for a human to look, and that check has not been done.

---

## What to carry into Phase 2

- **The thirty-second capture target is measured on a real phone.** `docs/META-PLAN.md` §6 calls it the single most important measurement in the project. It is a product finding, not a performance bug — if it misses, the fix belongs in `docs/spec.md` §5.1 before it belongs in code.
- **The open question in `docs/spec.md` §10 about the isolated availability-check submission gets its first live evaluation.** Build it as specified; decide afterwards with real use in hand.
- **`requireAdmin()` in `src/app/(admin)/layout.tsx`** is the pattern every admin page uses to get the acting admin. Phase 2 records the acting admin on every state change, and that is where it comes from.
- **Every admin surface currently calls `getOnlyBusiness()` itself.** That is correct and explicit today. If Phase 2 grows many surfaces, consider resolving it once — but not by caching it somewhere a second business would later have to be untangled from.
