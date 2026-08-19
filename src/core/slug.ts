/**
 * Slug generation for short links.
 *
 * PURE. No clock, no environment, no input or output. Randomness is an
 * argument, because `src/core/` may not call `Math.random()`.
 *
 * A slug is a five-character opaque lookup key and NOTHING MORE. It is not a
 * signed token, it does not encode an identifier, and it carries no
 * permissions. Access is decided by reading the `links` row server-side.
 * See AGENTS.md, "Links carry no claims and are resolved server-side".
 *
 * ── A flagged dependency ────────────────────────────────────────────
 * This module imports `obscenity`. AGENTS.md says `src/core/` "may import
 * only from `src/core/` and from Node built-ins that perform no input or
 * output", which reads against that. It is here deliberately, not by
 * oversight: `tasks/phase-0.md` Task 0.6 requires the blocked-word check in
 * this file and its must-not-do list forbids vendoring a word list into the
 * repository, so there is no third option. `obscenity` performs no input or
 * output — no filesystem, no network, no environment — which is what the
 * rule's own heading asks for. Recorded in SESSION_LOG.md for the human to
 * reconcile; do not treat it as licence to add other packages here.
 */

import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity'

/**
 * Crockford base32. `I`, `L`, `O`, and `U` are absent: the first three
 * because they are confusable with `1` and `0` when read aloud or copied off
 * a screen, and `U` to avoid accidental obscenities.
 */
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 32^5 = 33,554,432 combinations. */
export const SLUG_LENGTH = 5

/**
 * Slugs that would collide with a route or read as a claim about the app.
 *
 * Most of these can never be generated — `about` contains `o` and `u`, which
 * are not in the alphabet — but the check is written against arbitrary input
 * so it also serves a slug someone asks for by hand. `TERMS` is the case
 * that proves the check earns its keep: every character is in the alphabet.
 */
export const RESERVED: ReadonlySet<string> = new Set([
  'ABOUT',
  'ADMIN',
  'API',
  'APP',
  'AUTH',
  'HEALTH',
  'HELP',
  'HOME',
  'LOGIN',
  'LOGOUT',
  'NEW',
  'NULL',
  'PRIVACY',
  'ROBOTS',
  'S',
  'SETTINGS',
  'SIGNIN',
  'SIGNOUT',
  'SITEMAP',
  'STATIC',
  'STATUS',
  'TERMS',
  'TRUE',
  'UNDEFINED',
])

/**
 * A source of randomness returning a number in [0, 1).
 *
 * Injected rather than read from `Math.random()` so that generation is
 * testable: a seeded source makes "this input produces a reserved word"
 * a deterministic test rather than a hope.
 */
export type RandomSource = () => number

/**
 * Guard against a degenerate random source. A source returning a constant
 * that lands on a reserved word would otherwise spin forever.
 */
const MAX_ATTEMPTS = 100

/**
 * Built once. The dataset is pattern-based rather than a word list, so
 * candidates are matched against it rather than filtered from it. The
 * recommended transformers catch leet-speak, which matters here because the
 * alphabet contains digits: `FK54T` should not become someone's link.
 */
const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
})

/** True when the slug collides with a route or a reserved word. */
export function isReserved(slug: string): boolean {
  return RESERVED.has(slug.toUpperCase())
}

/** True when the slug reads as an offensive word, leet-speak included. */
export function isBlocked(slug: string): boolean {
  return profanityMatcher.hasMatch(slug)
}

/**
 * Normalize a slug as it arrives from a URL.
 *
 * Returns the uppercase form, or null when the input is not a well-formed
 * slug. Surrounding whitespace is tolerated because these are pasted out of
 * text messages. Resolution is case-insensitive, which is what this makes
 * true in practice.
 *
 * A character outside the alphabet returns null rather than being coerced.
 * `I` and `O` are NOT folded to `1` and `0`: this repository has not decided
 * that they should be, and inventing the mapping here would silently make
 * two different links resolve to one.
 */
export function normalizeSlug(input: string): string | null {
  const candidate = input.trim().toUpperCase()
  if (candidate.length !== SLUG_LENGTH) return null

  for (const character of candidate) {
    if (!ALPHABET.includes(character)) return null
  }

  return candidate
}

/**
 * Generate a slug that is neither reserved nor blocked.
 *
 * Retries on a collision. Throws after MAX_ATTEMPTS, which cannot happen
 * with a real random source — the rejection rate is well under one percent —
 * and means the caller supplied a degenerate one.
 */
export function generateSlug(random: RandomSource): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let slug = ''
    for (let position = 0; position < SLUG_LENGTH; position += 1) {
      const index = Math.floor(random() * ALPHABET.length)
      // A source returning exactly 1, or drifting outside [0, 1), would
      // index past the end and yield `undefined` in the string.
      const bounded = Math.min(Math.max(index, 0), ALPHABET.length - 1)
      slug += ALPHABET[bounded]
    }

    if (!isReserved(slug) && !isBlocked(slug)) return slug
  }

  throw new Error(
    `Could not generate an acceptable slug in ${MAX_ATTEMPTS} attempts. The random source is likely degenerate.`
  )
}
