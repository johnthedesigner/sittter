/**
 * The shell every email shares.
 *
 * Deliberately plain. These are read on a phone, often in a hurry, and the
 * visual pass across every surface is Phase 7. What matters here is that the
 * text is legible and the button is tappable.
 */

import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'

export interface EmailLayoutProps {
  /** Shown in the inbox list beside the subject. */
  preview: string
  children: ReactNode
  footer?: string
}

const body = {
  backgroundColor: '#f6f6f4',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: '0',
  padding: '24px 0',
}

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '520px',
  padding: '32px',
}

const footerText = {
  color: '#6b6b66',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
}

const divider = { borderColor: '#e6e6e2', margin: '28px 0 20px' }

export function EmailLayout({ preview, children, footer }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>{children}</Section>
          {footer !== undefined && (
            <>
              <Hr style={divider} />
              <Text style={footerText}>{footer}</Text>
            </>
          )}
        </Container>
      </Body>
    </Html>
  )
}
