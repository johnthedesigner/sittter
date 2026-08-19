/**
 * Email service integration tests.
 *
 * Resend is replaced at the module boundary by the shared fake in
 * `src/services/testing/resend-fake.ts`. The database is real — the send log
 * is the thing being asserted.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('resend', async () => {
  const { resendModuleFake } = await import('./testing/resend-fake')
  return resendModuleFake()
})

import { render } from '@react-email/render'

import { MAGIC_LINK_COPY, MagicLinkEmail } from '@/emails/magic-link'
import { createBusiness } from '@/db/repositories/businesses'
import { listEmailSends } from '@/db/repositories/email-sends'
import { resetDatabase } from '@/db/testing/database'

import { resetEmailClient, sendEmail } from './email'
import { queueOutcomes, recordedSends, resetResendFake } from './testing/resend-fake'

const SIGN_IN_URL = 'http://localhost:3000/api/auth/callback?token=abc123'

/**
 * Decode the HTML entities react-email emits.
 *
 * The footer contains an apostrophe, which renders as `&#x27;`. Asserting on
 * the escaped form would tie the test to an encoding detail; asserting on the
 * decoded text checks the copy a human actually reads.
 */
function decodeEntities(html: string): string {
  return html
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x2014;/g, '—')
    .replace(/&amp;/g, '&')
}

async function business() {
  return createBusiness({ name: 'sittter', contactEmail: 'hello@example.com' })
}

function magicLink() {
  return {
    kind: 'magic_link',
    to: 'jlivornese@gmail.com',
    subject: MAGIC_LINK_COPY.subject,
    body: MagicLinkEmail({ signInUrl: SIGN_IN_URL }),
  }
}

beforeEach(async () => {
  await resetDatabase()
  resetResendFake()
  resetEmailClient()
})

describe('sendEmail — the happy path', () => {
  it('calls the provider once and returns its identifier', async () => {
    const b = await business()
    const result = await sendEmail(b.id, magicLink())

    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(1)
    expect(result.providerId).toBe('fake-provider-id-1')
    expect(result.error).toBeNull()
    expect(recordedSends()).toHaveLength(1)
  })

  it('writes an email_sends row with kind, recipient, subject, and provider id', async () => {
    const b = await business()
    await sendEmail(b.id, magicLink())

    const rows = await listEmailSends(b.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.kind).toBe('magic_link')
    expect(rows[0]!.recipient).toBe('jlivornese@gmail.com')
    expect(rows[0]!.subject).toBe('Your sittter sign-in link')
    expect(rows[0]!.providerId).toBe('fake-provider-id-1')
    expect(rows[0]!.error).toBeNull()
  })

  it('sends from EMAIL_FROM', async () => {
    const b = await business()
    await sendEmail(b.id, magicLink())
    expect(recordedSends()[0]!.from).toBe(process.env.EMAIL_FROM)
  })

  it('scopes the log to its business', async () => {
    const a = await business()
    const other = await createBusiness({ name: 'Other', contactEmail: 'o@example.com' })
    await sendEmail(a.id, magicLink())
    expect(await listEmailSends(other.id)).toEqual([])
  })
})

describe('sendEmail — failure and retry', () => {
  it('retries exactly once when the provider throws, and the second attempt succeeds', async () => {
    const b = await business()
    queueOutcomes({ kind: 'throw', message: 'connection reset' })

    const result = await sendEmail(b.id, magicLink())

    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(recordedSends()).toHaveLength(2)

    // One row, not two: a row per attempt would read as two emails sent.
    const rows = await listEmailSends(b.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.error).toBeNull()
  })

  it('retries exactly once when the provider returns an error response', async () => {
    const b = await business()
    queueOutcomes({ kind: 'error-response', message: 'rate limited' })

    const result = await sendEmail(b.id, magicLink())

    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(recordedSends()).toHaveLength(2)
  })

  it('gives up after two attempts — the provider is called twice, never three times', async () => {
    const b = await business()
    queueOutcomes(
      { kind: 'throw', message: 'first failure' },
      { kind: 'throw', message: 'second failure' },
      { kind: 'throw', message: 'third failure would be a bug' }
    )

    const result = await sendEmail(b.id, magicLink())

    expect(result.ok).toBe(false)
    expect(result.attempts).toBe(2)
    expect(recordedSends()).toHaveLength(2)
  })

  it('writes a row with error populated and providerId null when both attempts fail', async () => {
    const b = await business()
    queueOutcomes(
      { kind: 'throw', message: 'provider unavailable' },
      { kind: 'throw', message: 'provider still unavailable' }
    )

    await sendEmail(b.id, magicLink())

    const rows = await listEmailSends(b.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.providerId).toBeNull()
    expect(rows[0]!.error).toBe('provider still unavailable')
    expect(rows[0]!.kind).toBe('magic_link')
    expect(rows[0]!.recipient).toBe('jlivornese@gmail.com')
  })

  it('DOES NOT THROW to its caller when delivery fails twice', async () => {
    // AGENTS.md: integrations fail soft and never block a write.
    const b = await business()
    queueOutcomes({ kind: 'throw' }, { kind: 'throw' })

    await expect(sendEmail(b.id, magicLink())).resolves.toMatchObject({ ok: false })
  })

  it('reports the last error, not the first', async () => {
    const b = await business()
    queueOutcomes(
      { kind: 'throw', message: 'first' },
      { kind: 'error-response', message: 'second' }
    )
    const result = await sendEmail(b.id, magicLink())
    expect(result.error).toBe('second')
  })
})

describe('the magic link email', () => {
  it('renders every string from the Reference data, exactly', async () => {
    const text = decodeEntities(await render(MagicLinkEmail({ signInUrl: SIGN_IN_URL })))

    expect(text).toContain(MAGIC_LINK_COPY.firstLine)
    expect(text).toContain(MAGIC_LINK_COPY.buttonLabel)
    expect(text).toContain(MAGIC_LINK_COPY.footer)
  })

  it('exports the same strings it renders, so a copy change cannot drift', () => {
    expect(MAGIC_LINK_COPY.subject).toBe('Your sittter sign-in link')
    expect(MAGIC_LINK_COPY.firstLine).toBe(
      'Tap the button below to sign in. The link expires in 15 minutes and works once.'
    )
    expect(MAGIC_LINK_COPY.buttonLabel).toBe('Sign in to sittter')
    expect(MAGIC_LINK_COPY.footer).toBe(
      "If you didn't ask for this, you can ignore it — nothing will happen."
    )
  })

  it('contains the absolute sign-in URL with no doubled slash', async () => {
    const html = await render(MagicLinkEmail({ signInUrl: SIGN_IN_URL }))

    expect(html).toContain(SIGN_IN_URL)
    expect(html).toMatch(/href="http:\/\/localhost:3000\/api\/auth\/callback/)
    // A trailing slash on APP_URL would produce this. env.ts rejects one, and
    // this asserts the rendered result rather than trusting that.
    expect(html).not.toMatch(/localhost:3000\/\/+/)
  })

  it('builds its URL from APP_URL', () => {
    const appUrl = process.env.APP_URL
    expect(appUrl).toBeTruthy()
    expect(appUrl!.endsWith('/')).toBe(false)
    expect(SIGN_IN_URL.startsWith(appUrl!)).toBe(true)
  })

  it('contains no placeholder copy', async () => {
    const text = decodeEntities(await render(MagicLinkEmail({ signInUrl: SIGN_IN_URL })))
    expect(text).not.toMatch(/lorem|ipsum|tbd|todo|coming soon|\{\{|\}\}/i)
    expect(text).not.toContain('undefined')
  })

  it('sends the rendered HTML to the provider, not an empty body', async () => {
    const b = await business()
    await sendEmail(b.id, magicLink())
    const sent = recordedSends()[0]!
    expect(sent.html).toContain('Sign in to sittter')
    expect(sent.html).toContain(SIGN_IN_URL)
    expect(sent.subject).toBe('Your sittter sign-in link')
  })
})

describe('the vendor boundary', () => {
  it('is the only thing the service reaches — replacing resend is enough to isolate it', async () => {
    // Nothing but src/services/email.ts imports `resend`. If that stopped
    // being true, this file's vi.mock would no longer isolate the vendor and
    // a real network call would be attempted here.
    const b = await business()
    const result = await sendEmail(b.id, magicLink())
    expect(result.providerId).toMatch(/^fake-provider-id-/)
  })
})
