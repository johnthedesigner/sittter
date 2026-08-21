/**
 * Copy for the public link surfaces.
 *
 * Fixed in `tasks/phase-3.md` Reference data. Its own module, importing
 * nothing, so tests can assert the exact strings without pulling a server
 * component's dependencies into the test process.
 *
 * The invalid-link copy says NOTHING about whether the link ever existed.
 * A slug that never was, one that expired, and one that was revoked all land
 * here, and any difference between them would let a stranger probe which
 * slugs are real.
 */
export const INVALID_LINK_COPY = {
  heading: 'This link is no longer valid',
  body: "Links expire, and can be replaced if something has changed. Get in touch and we'll send you a new one.",
} as const

export const RATE_LIMITED_COPY = {
  heading: 'Too many requests',
  body: 'Please wait a minute and try again.',
} as const
