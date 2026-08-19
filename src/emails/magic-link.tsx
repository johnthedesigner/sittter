/**
 * The admin sign-in email.
 *
 * Every string here is fixed in `tasks/phase-1.md` Reference data and is
 * asserted exactly by a test. Changing one is a copy decision, not a
 * refactor.
 */

import { Button, Text } from '@react-email/components'

import { EmailLayout } from './layout'

/** Exported so tests assert on the same strings the template renders. */
export const MAGIC_LINK_COPY = {
  subject: 'Your sittter sign-in link',
  firstLine: 'Tap the button below to sign in. The link expires in 15 minutes and works once.',
  buttonLabel: 'Sign in to sittter',
  footer: "If you didn't ask for this, you can ignore it — nothing will happen.",
} as const

export interface MagicLinkEmailProps {
  /** Absolute URL, built from APP_URL. */
  signInUrl: string
}

const paragraph = {
  color: '#1c1c1a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 24px',
}

const button = {
  backgroundColor: '#1c1c1a',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 600,
  padding: '12px 20px',
  textDecoration: 'none',
}

export function MagicLinkEmail({ signInUrl }: MagicLinkEmailProps) {
  return (
    <EmailLayout preview={MAGIC_LINK_COPY.subject} footer={MAGIC_LINK_COPY.footer}>
      <Text style={paragraph}>{MAGIC_LINK_COPY.firstLine}</Text>
      <Button href={signInUrl} style={button}>
        {MAGIC_LINK_COPY.buttonLabel}
      </Button>
    </EmailLayout>
  )
}
