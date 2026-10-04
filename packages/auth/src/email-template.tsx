import * as React from 'react'
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
  render,
} from 'react-email'

import type { EmailBrand } from './email-brand'

interface AuthEmailTemplateProps {
  /** The sending product supplies its own name, logo and link origin. */
  brand: EmailBrand
  preview: string
  title: string
  body: string
  eyebrow?: string
  /** Structured information, read before the action rather than in a footnote. */
  details?: Array<{ label: string; value: string; href?: string }>
  note?: { label: string; text: string }
  actionLabel?: string
  actionUrl?: string
  /** An optional secondary action below the main task. */
  secondaryActionLabel?: string
  secondaryActionUrl?: string
  secondary?: string
  code?: string
}

// Editorial layout: a white 560px column, quiet type and full-width actions.
// Essential layout stays inline and table-based for email clients.
const fontFamily =
  'Helvetica, Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const colors = {
  paper: '#ffffff',
  ink: '#111111',
  muted: '#747474',
  soft: '#f0f0f0',
  rule: '#eaeaea',
}

const buttonStyle: React.CSSProperties = {
  borderRadius: '9999px',
  boxSizing: 'border-box',
  display: 'block',
  fontSize: '16px',
  fontWeight: 600,
  lineHeight: '24px',
  padding: '12px 0',
  textAlign: 'center',
  textDecoration: 'none',
  width: '100%',
}

const footerLinkStyle: React.CSSProperties = {
  color: colors.muted,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

function AuthEmailTemplate({
  brand,
  preview,
  title,
  body,
  eyebrow,
  details,
  note,
  actionLabel,
  actionUrl,
  secondaryActionLabel,
  secondaryActionUrl,
  secondary,
  code,
}: AuthEmailTemplateProps) {
  const { appName, baseUrl, logoUrl } = brand
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.paper,
          color: colors.ink,
          fontFamily,
          margin: 0,
          padding: 0,
          width: '100%',
        }}
      >
        <Section style={{ padding: '40px 24px' }}>
          <Container
            style={{
              margin: '0 auto',
              maxWidth: '560px',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <Section style={{ marginBottom: '40px' }}>
              <Row>
                <Column style={{ width: '60px', verticalAlign: 'middle' }}>
                  <Link href={baseUrl} aria-label={appName}>
                    <Img
                      src={logoUrl}
                      alt={appName}
                      width={44}
                      height={44}
                      style={{ display: 'block', border: 0 }}
                    />
                  </Link>
                </Column>
                <Column style={{ verticalAlign: 'middle' }}>
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: '18px',
                      fontWeight: 600,
                      lineHeight: '24px',
                      margin: 0,
                    }}
                  >
                    {appName}
                  </Text>
                </Column>
              </Row>
            </Section>

            {eyebrow ? (
              <Text
                style={{
                  color: colors.muted,
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '1.5px',
                  lineHeight: '16px',
                  margin: '0 0 12px',
                  textTransform: 'uppercase',
                }}
              >
                {eyebrow}
              </Text>
            ) : null}
            <Heading
              as="h1"
              style={{
                color: colors.ink,
                fontSize: eyebrow ? '30px' : '24px',
                fontWeight: 600,
                lineHeight: eyebrow ? '38px' : '32px',
                margin: '0 0 8px',
                overflowWrap: 'break-word',
              }}
            >
              {title}
            </Heading>
            <Text
              style={{
                color: colors.muted,
                fontSize: details ? '16px' : '18px',
                fontWeight: 400,
                lineHeight: '28px',
                margin: '0 0 32px',
                overflowWrap: 'break-word',
              }}
            >
              {body}
            </Text>

            {details?.length ? (
              <Section
                style={{
                  backgroundColor: '#f7f7f7',
                  border: `1px solid ${colors.rule}`,
                  borderRadius: '16px',
                  marginBottom: '28px',
                  padding: '24px 20px',
                }}
              >
                {details.map((detail, index) => (
                  <Row key={detail.label} style={{ tableLayout: 'fixed' }}>
                    <Column
                      style={{
                        width: '72px',
                        verticalAlign: 'top',
                        padding: `0 12px ${index < details.length - 1 ? '20px' : '0'} 0`,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: '12px',
                          lineHeight: '24px',
                          margin: 0,
                        }}
                      >
                        {detail.label}
                      </Text>
                    </Column>
                    <Column
                      style={{
                        verticalAlign: 'top',
                        paddingBottom: index < details.length - 1 ? '20px' : 0,
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                      }}
                    >
                      <Text
                        style={{
                          color: colors.ink,
                          fontSize: '15px',
                          fontWeight: index === 0 ? 600 : 400,
                          lineHeight: '24px',
                          margin: 0,
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {detail.href ? (
                          <Link
                            href={detail.href}
                            style={{
                              color: colors.ink,
                              textDecoration: 'underline',
                            }}
                          >
                            {detail.value}
                          </Link>
                        ) : (
                          detail.value
                        )}
                      </Text>
                      {detail.href ? (
                        <Text
                          style={{
                            color: colors.muted,
                            fontSize: '12px',
                            lineHeight: '18px',
                            margin: '4px 0 0',
                            wordBreak: 'break-all',
                          }}
                        >
                          {detail.href}
                        </Text>
                      ) : null}
                    </Column>
                  </Row>
                ))}
              </Section>
            ) : null}

            {note ? (
              <Section style={{ marginBottom: '28px' }}>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: '12px',
                    fontWeight: 600,
                    lineHeight: '20px',
                    margin: '0 0 8px',
                  }}
                >
                  {note.label}
                </Text>
                <Text
                  style={{
                    color: colors.ink,
                    fontSize: '15px',
                    lineHeight: '25px',
                    margin: 0,
                    whiteSpace: 'pre-line',
                    overflowWrap: 'break-word',
                  }}
                >
                  {note.text}
                </Text>
              </Section>
            ) : null}

            {code ? (
              <Section
                style={{
                  backgroundColor: colors.soft,
                  borderRadius: '16px',
                  marginBottom: '32px',
                  padding: '28px 16px',
                  textAlign: 'center',
                }}
              >
                <Text
                  style={{
                    color: colors.ink,
                    fontFamily:
                      '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                    fontSize: '32px',
                    fontWeight: 600,
                    letterSpacing: '6px',
                    lineHeight: '40px',
                    margin: 0,
                  }}
                >
                  {code}
                </Text>
              </Section>
            ) : null}

            {actionLabel && actionUrl ? (
              <Section style={{ marginBottom: '12px' }}>
                <Button
                  href={actionUrl}
                  style={{
                    ...buttonStyle,
                    backgroundColor: colors.ink,
                    color: colors.paper,
                  }}
                >
                  {actionLabel}
                </Button>
              </Section>
            ) : null}

            {secondaryActionLabel && secondaryActionUrl ? (
              <Section style={{ marginBottom: '12px' }}>
                <Button
                  href={secondaryActionUrl}
                  style={{
                    ...buttonStyle,
                    backgroundColor: colors.soft,
                    color: colors.ink,
                  }}
                >
                  {secondaryActionLabel}
                </Button>
              </Section>
            ) : null}

            {secondary ? (
              <Text
                style={{
                  color: colors.muted,
                  fontSize: '14px',
                  lineHeight: '22px',
                  margin: '24px 0 0',
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line',
                }}
              >
                {secondary}
              </Text>
            ) : null}

            <Hr
              style={{
                border: 0,
                borderTop: `1px solid ${colors.rule}`,
                margin: '40px 0 20px',
              }}
            />

            <Section>
              <Text
                style={{
                  fontSize: '12px',
                  lineHeight: '20px',
                  margin: 0,
                }}
              >
                <Link href={`${baseUrl}/privacy`} style={footerLinkStyle}>
                  Privacy
                </Link>
                <span style={{ color: colors.rule, margin: '0 12px' }}>·</span>
                <Link href={`${baseUrl}/terms`} style={footerLinkStyle}>
                  Terms
                </Link>
                <span style={{ color: colors.rule, margin: '0 12px' }}>·</span>
                <Link
                  href="https://github.com/EvanTechDev/One-Calendar"
                  style={footerLinkStyle}
                >
                  GitHub
                </Link>
              </Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  )
}

export async function renderAuthEmailTemplate(props: AuthEmailTemplateProps) {
  return render(<AuthEmailTemplate {...props} />)
}
