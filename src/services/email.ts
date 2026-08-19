/**
 * Email delivery.
 *
 * THE ONLY FILE IN THIS REPOSITORY THAT MAY IMPORT `resend`. Everything else
 * sends through this module. See AGENTS.md, "Each external vendor is imported
 * in exactly one file".
 *
 * Every send is recorded in `email_sends`, successful or not, so a failure is
 * visible and retryable by the daily job rather than lost.
 *
 * A send NEVER THROWS to its caller. Delivery failing must not prevent a core
 * write from succeeding — a booking that could not send a confirmation is
 * still a saved, confirmed booking. See AGENTS.md, "Integrations fail soft and
 * never block a write". Callers inspect the returned result.
 */

import { render } from '@react-email/render'
import { Resend } from 'resend'
import type { ReactElement } from 'react'

import { recordEmailSend } from '@/db/repositories/email-sends'
import { env } from '@/lib/env'

/** One retry, then give up. Not a loop — a second attempt and no more. */
const MAX_ATTEMPTS = 2

export interface SendEmailInput {
  /** Recorded in `email_sends.kind`, e.g. `magic_link`. */
  kind: string
  to: string
  subject: string
  /** A react-email element. Rendered to HTML here. */
  body: ReactElement
}

export interface SendEmailResult {
  ok: boolean
  /** The provider's identifier on success, null on failure. */
  providerId: string | null
  /** The last error message on failure, null on success. */
  error: string | null
  /** How many times the provider was called. 1 on first-try success, 2 after a retry. */
  attempts: number
}

let client: Resend | null = null

function resend(): Resend {
  if (client === null) client = new Resend(env().RESEND_API_KEY)
  return client
}

/** Reset the memoized client. Tests only. */
export function resetEmailClient(): void {
  client = null
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return JSON.stringify(error)
}

/**
 * Send an email and record the attempt.
 *
 * Retries once on failure. Records exactly one `email_sends` row describing
 * the final outcome — a row per attempt would make the log read as though
 * twice as many emails had been sent.
 */
export async function sendEmail(
  businessId: string,
  input: SendEmailInput
): Promise<SendEmailResult> {
  const html = await render(input.body)
  const from = env().EMAIL_FROM

  let lastError: string | null = null
  let attempts = 0

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1
    try {
      const response = await resend().emails.send({
        from,
        to: input.to,
        subject: input.subject,
        html,
      })

      if (response.error) {
        lastError = describe(response.error.message ?? response.error)
        continue
      }

      const providerId = response.data?.id ?? null
      await recordEmailSend(businessId, {
        kind: input.kind,
        recipient: input.to,
        subject: input.subject,
        providerId,
        error: null,
      })
      return { ok: true, providerId, error: null, attempts }
    } catch (error: unknown) {
      lastError = describe(error)
    }
  }

  await recordEmailSend(businessId, {
    kind: input.kind,
    recipient: input.to,
    subject: input.subject,
    providerId: null,
    error: lastError,
  })
  return { ok: false, providerId: null, error: lastError, attempts }
}
