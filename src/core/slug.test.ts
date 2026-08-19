import { describe, it, expect } from 'vitest'
import {
  ALPHABET,
  RESERVED,
  SLUG_LENGTH,
  generateSlug,
  isBlocked,
  isReserved,
  normalizeSlug,
} from './slug'
import type { RandomSource } from './slug'

/**
 * A random source that produces exactly the given slugs, in order, then
 * cycles through a fixed benign slug. Each character is turned back into the
 * [0, 1) value that would select it, so a test can say "suppose the source
 * would produce TERMS" and mean it.
 */
function sourceProducing(...slugs: string[]): RandomSource {
  const values: number[] = []
  for (const slug of slugs) {
    for (const character of slug.toUpperCase()) {
      const index = ALPHABET.indexOf(character)
      if (index === -1) {
        // Guard the fixture itself. A character outside the alphabet cannot
        // be produced by the generator, so asking for it silently yields a
        // different slug and the test passes for the wrong reason.
        throw new Error(`sourceProducing cannot produce ${JSON.stringify(character)}`)
      }
      values.push(index / ALPHABET.length)
    }
  }
  let index = 0
  const fallback = 'ZW7XQ'
  return () => {
    if (index < values.length) {
      const value = values[index]
      index += 1
      return value ?? 0
    }
    const position = (index - values.length) % SLUG_LENGTH
    index += 1
    return ALPHABET.indexOf(fallback[position] ?? 'Z') / ALPHABET.length
  }
}

describe('the alphabet', () => {
  it('is Crockford base32 with 32 distinct characters', () => {
    expect(ALPHABET).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ')
    expect(ALPHABET).toHaveLength(32)
    expect(new Set(ALPHABET).size).toBe(32)
  })

  it('omits the confusable characters I, L, O, and U', () => {
    for (const character of ['I', 'L', 'O', 'U']) {
      expect(ALPHABET).not.toContain(character)
    }
  })

  it('has a slug length of 5', () => {
    expect(SLUG_LENGTH).toBe(5)
  })
})

describe('generateSlug', () => {
  it('produces a 5-character string drawn only from the alphabet', () => {
    // Acceptance criterion.
    let seed = 987654321
    const random: RandomSource = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }

    for (let i = 0; i < 500; i += 1) {
      const slug = generateSlug(random)
      expect(slug).toHaveLength(5)
      for (const character of slug) expect(ALPHABET).toContain(character)
      expect(slug).toBe(slug.toUpperCase())
    }
  })

  it('takes a random source as an argument and does not call Math.random', () => {
    // Acceptance criterion. Math.random is made to throw for the call.
    const mathObj = globalThis.Math as unknown as { random: () => number }
    const realRandom = mathObj.random
    mathObj.random = () => {
      throw new Error('src/core/slug.ts called Math.random')
    }
    try {
      let calls = 0
      const random: RandomSource = () => {
        calls += 1
        return ((calls * 7) % 32) / 32
      }
      const slug = generateSlug(random)
      expect(slug).toHaveLength(5)
      expect(calls).toBeGreaterThanOrEqual(5)
    } finally {
      mathObj.random = realRandom
    }
  })

  it('retries when the source would produce a reserved word', () => {
    // Acceptance criterion. TERMS is reserved and every character of it is
    // in the alphabet, so it is genuinely reachable.
    expect(normalizeSlug('TERMS')).toBe('TERMS')
    expect(isReserved('TERMS')).toBe(true)

    const random = sourceProducing('TERMS', 'PQ3RT')
    const slug = generateSlug(random)

    expect(slug).toBe('PQ3RT')
    expect(slug).not.toBe('TERMS')
    expect(isReserved(slug)).toBe(false)
  })

  it('retries when the source would produce a blocked word', () => {
    // Acceptance criterion. FK54T is matched by the leet-speak transformers.
    expect(isBlocked('FK54T')).toBe(true)

    const random = sourceProducing('FK54T', 'PQ3RT')
    const slug = generateSlug(random)

    expect(slug).toBe('PQ3RT')
    expect(slug).not.toBe('FK54T')
    expect(isBlocked(slug)).toBe(false)
  })

  it('retries past several bad candidates in a row', () => {
    // Every candidate here is composable from the alphabet, so each is
    // genuinely reachable. ADMIN is not: it contains I.
    const random = sourceProducing('TERMS', 'FK54T', 'FKCGB', 'F463K', 'PQ3RT')
    expect(generateSlug(random)).toBe('PQ3RT')
  })

  it('throws rather than looping forever on a degenerate source', () => {
    // A source pinned to a reserved word can never succeed.
    const always: RandomSource = sourceProducing(...Array.from({ length: 200 }, () => 'TERMS'))
    expect(() => generateSlug(always)).toThrow(/degenerate/i)
  })

  it('does not index past the end of the alphabet when the source returns 1', () => {
    const atOne: RandomSource = () => 1
    const slug = generateSlug(atOne)
    expect(slug).toBe('ZZZZZ')
    expect(slug).not.toContain('undefined')
  })
})

describe('isReserved', () => {
  it('is true for every reserved word, case-insensitively', () => {
    for (const word of RESERVED) {
      expect(isReserved(word)).toBe(true)
      expect(isReserved(word.toLowerCase())).toBe(true)
    }
  })

  it('includes the route-colliding names from the reference data', () => {
    for (const word of ['ADMIN', 'API', 'NEW', 'S', 'SIGNIN', 'SETTINGS', 'TERMS', 'UNDEFINED']) {
      expect(RESERVED.has(word)).toBe(true)
    }
    expect(RESERVED.size).toBe(24)
  })

  it('is false for an ordinary slug', () => {
    expect(isReserved('PQ3RT')).toBe(false)
    expect(isReserved('ZW7XQ')).toBe(false)
  })

  it('mostly names words the generator could never produce anyway', () => {
    // The check still earns its keep: TERMS is composable from the alphabet.
    const composable = [...RESERVED].filter(
      (word) => word.length === SLUG_LENGTH && [...word].every((c) => ALPHABET.includes(c))
    )
    expect(composable).toEqual(['TERMS'])
  })
})

describe('isBlocked', () => {
  it('matches an offensive word', () => {
    expect(isBlocked('shit')).toBe(true)
    expect(isBlocked('SHIT')).toBe(true)
  })

  it('matches leet-speak, which the digit-bearing alphabet makes reachable', () => {
    expect(isBlocked('FK54T')).toBe(true)
  })

  it('is false for an ordinary slug', () => {
    expect(isBlocked('PQ3RT')).toBe(false)
    expect(isBlocked('ZW7XQ')).toBe(false)
  })

  it('rejects a small fraction of random slugs, so retries stay rare', () => {
    let seed = 24680
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    let blocked = 0
    const sampleSize = 5000
    for (let i = 0; i < sampleSize; i += 1) {
      let slug = ''
      for (let j = 0; j < SLUG_LENGTH; j += 1) {
        slug += ALPHABET[Math.floor(random() * ALPHABET.length)]
      }
      if (isBlocked(slug)) blocked += 1
    }
    expect(blocked / sampleSize).toBeLessThan(0.02)
  })
})

describe('normalizeSlug', () => {
  it('resolves case-insensitively', () => {
    // Acceptance criterion.
    expect(normalizeSlug('ab3k9')).toBe(normalizeSlug('AB3K9'))
    expect(normalizeSlug('ab3k9')).toBe('AB3K9')
    expect(normalizeSlug('Ab3K9')).toBe('AB3K9')
  })

  it('returns null for a character outside the alphabet', () => {
    // Acceptance criterion. I, L, O, and U are deliberately absent.
    expect(normalizeSlug('AB3I9')).toBeNull()
    expect(normalizeSlug('AB3L9')).toBeNull()
    expect(normalizeSlug('AB3O9')).toBeNull()
    expect(normalizeSlug('AB3U9')).toBeNull()
    expect(normalizeSlug('AB-K9')).toBeNull()
    expect(normalizeSlug('AB K9')).toBeNull()
  })

  it('returns null for the wrong length', () => {
    expect(normalizeSlug('')).toBeNull()
    expect(normalizeSlug('AB3K')).toBeNull()
    expect(normalizeSlug('AB3K99')).toBeNull()
  })

  it('tolerates surrounding whitespace, since slugs get pasted', () => {
    expect(normalizeSlug('  AB3K9  ')).toBe('AB3K9')
    expect(normalizeSlug('\nab3k9\t')).toBe('AB3K9')
  })

  it('does not fold I or O onto 1 or 0', () => {
    // Folding would silently make two different links resolve to one. That
    // mapping has not been decided in this repository.
    expect(normalizeSlug('III11')).toBeNull()
    expect(normalizeSlug('OOO00')).toBeNull()
  })

  it('accepts every character of the alphabet', () => {
    for (const character of ALPHABET) {
      const slug = `${character}${character}${character}${character}${character}`
      expect(normalizeSlug(slug.toLowerCase())).toBe(slug)
    }
  })

  it('round-trips a generated slug', () => {
    let seed = 13579
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    for (let i = 0; i < 100; i += 1) {
      const slug = generateSlug(random)
      expect(normalizeSlug(slug)).toBe(slug)
      expect(normalizeSlug(slug.toLowerCase())).toBe(slug)
    }
  })
})

describe('slug purity', () => {
  it('does not touch the clock or randomness of its own', () => {
    const dateCtor = globalThis.Date as unknown as { now: () => number }
    const mathObj = globalThis.Math as unknown as { random: () => number }
    const realNow = dateCtor.now
    const realRandom = mathObj.random
    dateCtor.now = () => {
      throw new Error('src/core/slug.ts read the clock')
    }
    mathObj.random = () => {
      throw new Error('src/core/slug.ts read a random source')
    }
    try {
      expect(normalizeSlug('ab3k9')).toBe('AB3K9')
      expect(isReserved('TERMS')).toBe(true)
      expect(isBlocked('PQ3RT')).toBe(false)
      expect(generateSlug(sourceProducing('PQ3RT'))).toBe('PQ3RT')
    } finally {
      dateCtor.now = realNow
      mathObj.random = realRandom
    }
  })
})
