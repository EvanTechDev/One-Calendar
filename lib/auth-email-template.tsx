import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
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

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function AuthEmailTemplate({
  preview,
  title,
  body,
  actionLabel,
  actionUrl,
  secondary,
}: AuthEmailTemplateProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>

      {/* Background */}
      <Body
        style={{
          backgroundColor: '#fafafa',
          fontFamily:
            '"Geist", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
          margin: 0,
          padding: '40px 0',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            margin: '0 auto',
            maxWidth: '480px',
            padding: '0',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Section
            style={{
              borderBottom: '1px solid #e5e5e5',
              padding: '24px 32px',
            }}
          >
            <table cellPadding={0} cellSpacing={0}>
              <tr>
                <td style={{ verticalAlign: 'middle' }}>
                  <Img
                    src={`${baseUrl}/logo.svg`}
                    alt="One Calendar"
                    width={20}
                    height={20}
                    style={{ display: 'block' }}
                  />
                </td>
                <td
                  style={{
                    paddingLeft: '8px',
                    verticalAlign: 'middle',
                  }}
                >
                  <Text
                    style={{
                      color: '#000000',
                      fontSize: '14px',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      margin: 0,
                    }}
                  >
                    One Calendar
                  </Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Body */}
          <Section style={{ padding: '32px 32px 0' }}>
            <Text
              style={{
                color: '#000000',
                fontSize: '20px',
                fontWeight: 600,
                letterSpacing: '-0.025em',
                lineHeight: '28px',
                margin: '0 0 16px',
              }}
            >
              {title}
            </Text>

            <Text
              style={{
                color: '#666666',
                fontSize: '14px',
                lineHeight: '24px',
                margin: '0 0 24px',
              }}
            >
              {body}
            </Text>

            {actionLabel && actionUrl ? (
              <Section style={{ margin: '0 0 24px' }}>
                <Button
                  href={actionUrl}
                  style={{
                    backgroundColor: '#000000',
                    borderRadius: '6px',
                    color: '#ffffff',
                    display: 'inline-block',
                    fontSize: '13px',
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    padding: '10px 18px',
                    textDecoration: 'none',
                  }}
                >
                  {actionLabel}
                </Button>
              </Section>
            ) : null}

            {secondary ? (
              <Text
                style={{
                  color: '#888888',
                  fontSize: '13px',
                  lineHeight: '22px',
                  margin: '0 0 24px',
                }}
              >
                {secondary}
              </Text>
            ) : null}
          </Section>

          {/* Footer */}
          <Section style={{ padding: '0 32px 32px' }}>
            <Hr style={{ borderColor: '#e5e5e5', margin: '0 0 24px' }} />

            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tr>
                <td>
                  <Text
                    style={{
                      color: '#999999',
                      fontSize: '12px',
                      margin: 0,
                    }}
                  >
                    © {new Date().getFullYear()} One Calendar
                  </Text>
                </td>
                <td align="right">
                  <Text
                    style={{
                      color: '#999999',
                      fontSize: '12px',
                      margin: 0,
                    }}
                  >
                    <a
                      href={`${baseUrl}/privacy`}
                      style={{ color: '#999999', textDecoration: 'underline' }}
                    >
                      Privacy
                    </a>
                    <span style={{ color: '#d4d4d4', margin: '0 6px' }}>·</span>
                    <a
                      href={`${baseUrl}/terms`}
                      style={{ color: '#999999', textDecoration: 'underline' }}
                    >
                      Terms
                    </a>
                  </Text>
                </td>
              </tr>
            </table>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export async function renderAuthEmailTemplate(props: AuthEmailTemplateProps) {
  return render(<AuthEmailTemplate {...props} />)
}
