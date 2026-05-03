import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { render } from '@react-email/render'

interface AuthEmailTemplateProps {
  preview: string
  title: string
  body: string
  actionLabel?: string
  actionUrl?: string
  secondary?: string
}

function AuthEmailTemplate({
  preview,
  title,
  body,
  actionLabel,
  actionUrl,
  secondary,
}: AuthEmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f6f8fb', fontFamily: 'Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', border: '1px solid #e9eef5', borderRadius: '12px', margin: '32px auto', maxWidth: '520px', padding: '28px' }}>
          <Text style={{ color: '#0f172a', fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>One Calendar</Text>
          <Text style={{ color: '#64748b', fontSize: '13px', margin: '0 0 24px' }}>Simple scheduling for focused teams.</Text>
          <Section>
            <Text style={{ color: '#0f172a', fontSize: '18px', fontWeight: 600, margin: '0 0 12px' }}>{title}</Text>
            <Text style={{ color: '#334155', fontSize: '14px', lineHeight: '24px', margin: 0 }}>{body}</Text>
          </Section>
          {actionLabel && actionUrl ? (
            <Section style={{ marginTop: '24px' }}>
              <Button href={actionUrl} style={{ backgroundColor: '#0066ff', borderRadius: '10px', color: '#ffffff', fontSize: '14px', fontWeight: 600, padding: '12px 18px', textDecoration: 'none' }}>
                {actionLabel}
              </Button>
            </Section>
          ) : null}
          {secondary ? (
            <Text style={{ color: '#475569', fontSize: '13px', lineHeight: '22px', marginTop: '18px' }}>{secondary}</Text>
          ) : null}
          <Hr style={{ borderColor: '#e9eef5', margin: '24px 0' }} />
          <Text style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>© {new Date().getFullYear()} One Calendar · xyehr.cn</Text>
        </Container>
      </Body>
    </Html>
  )
}

export async function renderAuthEmailTemplate(props: AuthEmailTemplateProps) {
  return render(<AuthEmailTemplate {...props} />)
}
