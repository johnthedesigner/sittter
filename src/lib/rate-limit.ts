/**
 * Rate limiting for slug resolution.
 *
 * Fixed one-minute windows, floored from the instant the caller supplies. The
 * instant is an ARGUMENT so a test can prove the limit releases in the next
 * window without waiting sixty seconds for it.
 *
 * Fixed windows rather than a sliding one: a sliding window needs either a
 * per-request log or a background job to age entries out, and this is
 * protecting a lookup, not a payment endpoint. The cost is that a caller can
 * spend a full allowance at the end of one window and again at the start of
 * the next; the benefit is one row and one statement per request.
 */

import { countHit } from '@/db/repositories/rate-limit'
import { env } from './env'

export interface RateLimitResult {
  allowed: boolean
  /** Hits recorded in this window, this one included. */
  count: number
  limit: number
  /** When the current window ends and the allowance resets. */
  resetsAt: Date
}

const WINDOW_MS = 60_000

/** The start of the fixed one-minute window containing `at`. */
export function windowStart(at: Date): Date {
  return new Date(Math.floor(at.getTime() / WINDOW_MS) * WINDOW_MS)
}

/**
 * Record a hit and say whether it is allowed.
 *
 * The hit is counted whether or not it is allowed, so a caller cannot stay
 * under the limit by continuing to hammer it.
 */
export async function rateLimit(
  key: string,
  at: Date,
  limit: number = env().LINK_RATE_LIMIT_PER_MINUTE
): Promise<RateLimitResult> {
  const start = windowStart(at)
  const count = await countHit(key, start)

  return {
    allowed: count <= limit,
    count,
    limit,
    resetsAt: new Date(start.getTime() + WINDOW_MS),
  }
}

/**
 * The rate limit key for a slug resolution attempt.
 *
 * Keyed on the caller, not the slug. Keying on the slug would let one
 * attacker exhaust a real customer's link for everyone.
 */
export function slugResolutionKey(ipAddress: string): string {
  return `slug:${ipAddress}`
}
