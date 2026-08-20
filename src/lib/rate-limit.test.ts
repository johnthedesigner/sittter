/**
 * Rate limit tests.
 *
 * The instant is an argument, so a window releasing is a deterministic test
 * rather than a sixty-second wait.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { resetDatabase } from '@/db/testing/database'
import { hitsInWindow, pruneRateLimitHits } from '@/db/repositories/rate-limit'

import { rateLimit, slugResolutionKey, windowStart } from './rate-limit'

const AT = new Date('2026-08-20T12:00:30.000Z')

beforeEach(async () => {
  await resetDatabase()
})

describe('windowStart', () => {
  it('floors to the containing minute', () => {
    expect(windowStart(new Date('2026-08-20T12:00:30Z')).toISOString()).toBe(
      '2026-08-20T12:00:00.000Z'
    )
    expect(windowStart(new Date('2026-08-20T12:00:59.999Z')).toISOString()).toBe(
      '2026-08-20T12:00:00.000Z'
    )
    expect(windowStart(new Date('2026-08-20T12:01:00Z')).toISOString()).toBe(
      '2026-08-20T12:01:00.000Z'
    )
  })
})

describe('rateLimit', () => {
  it('allows up to the limit and refuses past it', async () => {
    const key = slugResolutionKey('203.0.113.1')

    for (let i = 1; i <= 3; i += 1) {
      const result = await rateLimit(key, AT, 3)
      expect(result.allowed, `hit ${i}`).toBe(true)
      expect(result.count).toBe(i)
    }

    const over = await rateLimit(key, AT, 3)
    expect(over.allowed).toBe(false)
    expect(over.count).toBe(4)
  })

  it('counts a refused hit, so hammering does not get under the limit', async () => {
    const key = slugResolutionKey('203.0.113.2')
    for (let i = 0; i < 5; i += 1) await rateLimit(key, AT, 2)
    expect(await hitsInWindow(key, windowStart(AT))).toBe(5)
  })

  it('RELEASES in the next window', async () => {
    const key = slugResolutionKey('203.0.113.3')
    for (let i = 0; i < 4; i += 1) await rateLimit(key, AT, 3)
    expect((await rateLimit(key, AT, 3)).allowed).toBe(false)

    const nextMinute = new Date(AT.getTime() + 60_000)
    const fresh = await rateLimit(key, nextMinute, 3)
    expect(fresh.allowed).toBe(true)
    expect(fresh.count).toBe(1)
  })

  it('IS KEYED PER CALLER — one address hitting the limit does not affect another', async () => {
    const noisy = slugResolutionKey('203.0.113.4')
    const quiet = slugResolutionKey('203.0.113.5')

    for (let i = 0; i < 10; i += 1) await rateLimit(noisy, AT, 3)
    expect((await rateLimit(noisy, AT, 3)).allowed).toBe(false)

    const other = await rateLimit(quiet, AT, 3)
    expect(other.allowed).toBe(true)
    expect(other.count).toBe(1)
  })

  it('reports when the allowance resets', async () => {
    const result = await rateLimit(slugResolutionKey('203.0.113.6'), AT, 3)
    expect(result.resetsAt.toISOString()).toBe('2026-08-20T12:01:00.000Z')
  })

  it('keys on the caller, not on the slug', () => {
    // Keying on the slug would let one attacker exhaust a real customer's
    // link for everybody who has it.
    expect(slugResolutionKey('203.0.113.7')).toBe('slug:203.0.113.7')
    expect(slugResolutionKey('203.0.113.7')).not.toContain('AB3K9')
  })
})

describe('pruneRateLimitHits', () => {
  it('drops windows older than the cutoff and keeps the rest', async () => {
    const key = slugResolutionKey('203.0.113.8')
    await rateLimit(key, new Date('2026-08-20T10:00:00Z'), 3)
    await rateLimit(key, AT, 3)

    const removed = await pruneRateLimitHits(new Date('2026-08-20T11:00:00Z'))
    expect(removed).toBe(1)
    expect(await hitsInWindow(key, windowStart(AT))).toBe(1)
  })
})
