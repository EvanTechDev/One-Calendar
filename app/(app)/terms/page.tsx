"use client"

import { LegalPageShell } from "@/components/landing/legal-page-shell"

const termsContent = {
  title: "One Calendar Terms of Service",
  lastUpdated: "Last updated: April 4, 2026",
  intro:
    "These Terms of Service govern your use of One Calendar. By using the service, you agree to these terms.",
  sections: [
    {
      heading: "1. Use of Service",
      content: [
        "You may use One Calendar for lawful scheduling and collaboration purposes.",
        "You are responsible for account activity and for maintaining the security of your credentials.",
      ],
    },
    {
      heading: "2. Open-Source License",
      content: [
        "One Calendar source code is distributed under GNU GPLv3.",
        "If you redistribute modified versions, you must comply with GPLv3 obligations.",
        "License details are available at <a href='https://www.gnu.org/licenses/gpl-3.0.en.html' target='_blank' class='text-blue-600 hover:underline'>https://www.gnu.org/licenses/gpl-3.0.en.html</a>.",
      ],
    },
    {
      heading: "3. Self-Hosting",
      content: [
        "You may self-host One Calendar. In self-hosted environments, you are responsible for security, compliance, and operations.",
      ],
    },
    {
      heading: "4. Acceptable Use",
      content: [
        "You must not use One Calendar to violate laws, abuse systems, distribute malware, or interfere with service availability.",
        "We may suspend access for abuse, fraud, or serious violations.",
      ],
    },
    {
      heading: "5. Third-Party Services",
      content: [
        "One Calendar may integrate with third-party services (for example authentication and storage providers).",
        "Your use of third-party services is also subject to their own terms and policies.",
      ],
    },
    {
      heading: "6. Intellectual Property",
      content: [
        "You retain rights to the data and content you create.",
        "You grant the minimum rights needed for us to process that content to provide the service.",
      ],
    },
    {
      heading: "7. Disclaimer",
      content: [
        "The service is provided on an 'as is' and 'as available' basis to the fullest extent permitted by law.",
      ],
    },
    {
      heading: "8. Limitation of Liability",
      content: [
        "To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from service use.",
      ],
    },
    {
      heading: "9. Changes to Terms",
      content: [
        "We may update these terms as the product changes. The latest version date is shown on this page.",
      ],
    },
    {
      heading: "10. Contact",
      content: [
        "For questions about these terms, contact us via GitHub or email at evan.huang000@proton.me.",
      ],
    },
  ],
  cta: "Want to contribute or review the latest source?",
  github: "Visit our GitHub",
  home: "Back to Home",
}

export default function TermsOfService() {
  return <LegalPageShell {...termsContent} allowHtml />
}
