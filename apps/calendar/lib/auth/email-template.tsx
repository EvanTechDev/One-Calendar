import * as React from 'react'
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
  render,
} from 'react-email'

interface AuthEmailTemplateProps {
  preview: string
  title: string
  body: string
  actionLabel?: string
  actionUrl?: string
  secondary?: string
  code?: string
}

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

const fontFamily =
  'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'

function AuthEmailTemplate({
  preview,
  title,
  body,
  actionLabel,
  actionUrl,
  secondary,
  code,
}: AuthEmailTemplateProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>

      {/* Background */}
      <Body
        style={{
          backgroundColor: '#f3f4f6',
          fontFamily,
          margin: 0,
          padding: '40px 0',
          width: '100%',
        }}
      >
        <Container
          style={{
            margin: '0 auto',
            maxWidth: '640px',
            width: '100%',
          }}
        >
          {/* Header */}
          <Section style={{ padding: '16px 24px' }}>
            <Row>
              <Column style={{ verticalAlign: 'middle' }}>
                <Img
                  src={`${baseUrl}/icon.svg`}
                  alt="One Calendar"
                  width={23}
                  height={23}
                  style={{ display: 'block' }}
                />
              </Column>
              <Column align="right" style={{ verticalAlign: 'middle' }}>
                <Text
                  style={{
                    color: '#7b7d81',
                    fontSize: '13px',
                    fontWeight: 420,
                    letterSpacing: '-0.039px',
                    lineHeight: '1.5',
                    margin: 0,
                  }}
                >
                  One Calendar
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Main card */}
          <Section
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '64px 40px',
              textAlign: 'center',
            }}
          >
            <Img
              src={`${baseUrl}/icon.svg`}
              alt="One Calendar"
              width={48}
              height={48}
              style={{ display: 'block', margin: '0 auto 20px' }}
            />

            <Heading
              as="h1"
              style={{
                color: '#14171e',
                fontSize: '28px',
                fontWeight: 600,
                letterSpacing: '-0.084px',
                lineHeight: '1.3',
                margin: '0 0 24px',
              }}
            >
              {title}
            </Heading>

            <Text
              style={{
                color: '#43454b',
                fontSize: '16px',
                fontWeight: 420,
                letterSpacing: '-0.048px',
                lineHeight: '1.5',
                margin: '0 auto 32px',
                maxWidth: '380px',
              }}
            >
              {body}
            </Text>

            {code ? (
              <Section style={{ margin: '0 0 32px', textAlign: 'center' }}>
                <Text
                  style={{
                    backgroundColor: '#f3f4f6',
                    borderRadius: '8px',
                    color: '#14171e',
                    display: 'inline-block',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '24px',
                    fontWeight: 600,
                    letterSpacing: '0.2em',
                    lineHeight: '1.5',
                    margin: 0,
                    padding: '14px 24px',
                  }}
                >
                  {code}
                </Text>
              </Section>
            ) : null}

            {actionLabel && actionUrl ? (
              <Section style={{ margin: '0 0 32px', textAlign: 'center' }}>
                <Button
                  href={actionUrl}
                  style={{
                    backgroundColor: '#14171e',
                    borderRadius: '8px',
                    color: '#ffffff',
                    display: 'inline-block',
                    fontSize: '16px',
                    fontWeight: 500,
                    letterSpacing: '-0.048px',
                    lineHeight: '24px',
                    padding: '14px 28px',
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
                  color: '#7b7d81',
                  fontSize: '13px',
                  fontWeight: 420,
                  letterSpacing: '-0.039px',
                  lineHeight: '1.5',
                  margin: '0 auto',
                  maxWidth: '400px',
                }}
              >
                {secondary}
              </Text>
            ) : null}
          </Section>

          {/* Footer */}
          <Section style={{ padding: '40px 24px', textAlign: 'center' }}>
            <Text
              style={{
                color: '#7b7d81',
                fontSize: '13px',
                fontWeight: 420,
                letterSpacing: '-0.039px',
                lineHeight: '1.5',
                margin: '0 auto 24px',
                maxWidth: '280px',
              }}
            >
              A privacy-first calendar that keeps your data yours.
            </Text>

            <Text
              style={{
                color: '#7b7d81',
                fontSize: '11px',
                fontWeight: 420,
                letterSpacing: '-0.033px',
                lineHeight: '1.5',
                margin: '0 0 12px',
              }}
            >
              <Link
                href={`${baseUrl}/privacy`}
                style={{ color: '#7b7d81', textDecoration: 'underline' }}
              >
                Privacy
              </Link>
              <span style={{ color: '#d4d4d8', margin: '0 8px' }}>·</span>
              <Link
                href={`${baseUrl}/terms`}
                style={{ color: '#7b7d81', textDecoration: 'underline' }}
              >
                Terms
              </Link>
              <span style={{ color: '#d4d4d8', margin: '0 8px' }}>·</span>
              <Link
                href="https://github.com/EvanTechDev/One-Calendar"
                style={{ color: '#7b7d81', textDecoration: 'underline' }}
              >
                GitHub
              </Link>
            </Text>

            <Text
              style={{
                color: '#7b7d81',
                fontSize: '11px',
                fontWeight: 420,
                letterSpacing: '-0.033px',
                lineHeight: '1.5',
                margin: 0,
              }}
            >
              © {new Date().getFullYear()} One Calendar
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export async function renderAuthEmailTemplate(props: AuthEmailTemplateProps) {
  return render(<AuthEmailTemplate {...props} />)
}
