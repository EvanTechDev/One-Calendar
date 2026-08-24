import { LegalPageShell } from '@/components/landing/legal-page-shell'

const privacyContent = {
  title: 'Zentra Calendar privacy policy',
  lastUpdated: 'Last updated: August 24, 2026',
  intro:
    'This policy explains what data Zentra Calendar collects, how we store and protect it, and the controls you have over it. It applies to the hosted service; if you self-host, you control your own instance and this policy does not apply.',
  sections: [
    {
      heading: '1. Self-hosted instances',
      content: [
        'Zentra Calendar is open source and you can run it on your own infrastructure. In a self-hosted deployment, you are the data controller: you choose where data lives, who can access it, and how it is secured. This policy covers only the hosted service we operate.',
      ],
    },
    {
      heading: '2. Information we collect',
      content: [
        'Account data: your email address, display name, and password hash, managed through our authentication system. If you enable two-factor authentication, we store the enrollment secret needed to verify your codes.',
        'Calendar data: the events, categories, reminders, and invitations you create. Sensitive event fields are encrypted at the application layer before they are written to the database.',
        'Participant data: when you invite someone to an event, we store their email address and RSVP so the invitation works. Invitees respond through a tokenized link and do not need an account.',
        'Operational data: security-relevant actions (such as sign-in attempts and API key usage) are logged with IP address and user agent to protect accounts and investigate abuse.',
        'Support data: messages you send to support channels, used only to respond and improve the service.',
      ],
    },
    {
      heading: '3. How we use data',
      content: [
        'We use your data to run the calendar: storing events, syncing across devices, sending invitations and reminders you asked for, and authenticating you.',
        'Email delivery (verification, password reset, invitations, and opt-in event reminders) goes through our email provider, which receives the recipient address and message content.',
        'If you connect an AI agent through MCP (Model Context Protocol), the agent can read and manage your calendar only within the scopes you grant to its API key or OAuth session. You can revoke access at any time.',
        'We do not sell personal data, and we do not use your calendar content for advertising or to train AI models.',
      ],
    },
    {
      heading: '4. Encryption and security',
      content: [
        'Data in transit is protected with Transport Layer Security (TLS). Sensitive event fields are encrypted at the application layer with keys held outside the database, so a database leak alone does not expose their contents.',
        'Authentication uses hardened session management, optional two-factor authentication, bot protection, and rate limiting on abuse-prone endpoints.',
        'Access to production systems is restricted and logged. We patch dependencies and review security findings as part of normal development.',
      ],
    },
    {
      heading: '5. Third-party services',
      content: [
        'The hosted service runs on cloud infrastructure providers for hosting, a managed Postgres database, and an email delivery provider. Each processes only the data needed for its role and is bound by its own data-processing terms.',
        'We keep the list of providers current in our documentation. We do not share your data with anyone else except as described in section 6.',
      ],
    },
    {
      heading: '6. Disclosure',
      content: [
        'We disclose personal data only when required by law, legal process, or to protect the rights and safety of Zentra Calendar and its users. We review every request for proportionality.',
      ],
    },
    {
      heading: '7. Your rights and controls',
      content: [
        'Export: you can export your calendar data at any time in standard formats (ICS and JSON).',
        'Correction and deletion: you can edit or delete events, categories, and account details from the app.',
        'Account deletion: deleting your account removes your data from the primary database. Residual copies in backups expire on the backup rotation schedule.',
        'Consent: optional features such as email reminders are opt-in per event and can be turned off at any time.',
      ],
    },
    {
      heading: '8. Data retention',
      content: [
        'We keep your data for as long as your account exists. Security logs are retained for a limited period for abuse investigation, then deleted. When you delete your account, associated data is removed as described in section 7.',
      ],
    },
    {
      heading: '9. Changes to this policy',
      content: [
        'We update this policy when our practices change. The date at the top reflects the latest revision, and substantive changes are announced in the product.',
      ],
    },
  ],
  cta: 'Have feedback or want to review how Zentra Calendar handles data?',
  github: 'Visit our GitHub repository',
  home: 'Return to home',
}

export default function PrivacyPolicy() {
  return <LegalPageShell {...privacyContent} />
}
