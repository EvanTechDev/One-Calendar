'use client'

import { LegalPageShell } from '@/components/landing/legal-page-shell'

const termsContent = {
  title: 'Zentra Calendar terms of service',
  lastUpdated: 'Last updated: August 24, 2026',
  intro:
    'These terms govern your use of the hosted Zentra Calendar service. By using the service, you agree to them.',
  sections: [
    {
      heading: '1. Use of the service',
      content: [
        'You may use Zentra Calendar for lawful scheduling and collaboration.',
        'You are responsible for activity on your account and for keeping your credentials secure.',
      ],
    },
    {
      heading: '2. Open-source license',
      content: [
        'The Zentra Calendar source code is distributed under the MIT License.',
        'If you redistribute modified versions, you must comply with the MIT License obligations.',
        "License details are available at <a href='https://github.com/EvanTechDev/One-Calendar/blob/main/LICENSE' target='_blank' class='text-blue-600 hover:underline'>https://github.com/EvanTechDev/One-Calendar/blob/main/LICENSE</a>.",
      ],
    },
    {
      heading: '3. Self-hosting',
      content: [
        'You may self-host Zentra Calendar. In self-hosted environments, you are responsible for security, compliance, and operations.',
      ],
    },
    {
      heading: '4. Acceptable use',
      content: [
        'You must not use Zentra Calendar to violate laws, abuse systems, distribute malware, or interfere with service availability.',
        'We may suspend access for abuse, fraud, or serious violations.',
      ],
    },
    {
      heading: '5. Connected agents and third-party services',
      content: [
        'Zentra Calendar integrates with third-party services (for example authentication, email delivery, and hosting providers). Your use of those services is also subject to their own terms.',
        'If you connect an AI agent to your calendar through MCP (Model Context Protocol), you are responsible for the actions that agent takes within the scopes you grant it. Revoke API keys or OAuth sessions you no longer use.',
      ],
    },
    {
      heading: '6. Intellectual property',
      content: [
        'You retain rights to the data and content you create.',
        'You grant us the minimum rights needed to process that content to provide the service.',
      ],
    },
    {
      heading: '7. Disclaimer',
      content: [
        "The service is provided on an 'as is' and 'as available' basis to the fullest extent permitted by law.",
      ],
    },
    {
      heading: '8. Limitation of liability',
      content: [
        'To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from use of the service.',
      ],
    },
    {
      heading: '9. Changes to these terms',
      content: [
        'We may update these terms as the product changes. The date at the top reflects the latest revision.',
      ],
    },
    {
      heading: '10. Contact',
      content: [
        'For questions about these terms, contact us on GitHub or by email at evan.huang000@proton.me.',
      ],
    },
  ],
  cta: 'Want to contribute or review the latest source?',
  github: 'Visit our GitHub',
  home: 'Back to home',
}

export default function TermsOfService() {
  return <LegalPageShell {...termsContent} allowHtml />
}
