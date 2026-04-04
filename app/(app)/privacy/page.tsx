import { LegalPageShell } from "@/components/landing/legal-page-shell"

const privacyContent = {
  title: "One Calendar Privacy Policy",
  lastUpdated: "Last updated: April 4, 2026",
  intro:
    "This Privacy Policy explains how One Calendar handles data for the current product, including local-first calendar usage, optional account login, optional cloud sync features, and sharing tools.",
  sections: [
    {
      heading: "1. Scope",
      content: [
        "This policy applies to the One Calendar web app, authentication flows, optional sharing features, and support channels.",
        "If you self-host One Calendar, you control your own infrastructure and data practices for that deployment.",
      ],
    },
    {
      heading: "2. Data We Process",
      content: [
        "Account data: if you sign in, authentication data is processed through Clerk (for example, provider identity, email, and account identifier).",
        "Calendar content: events and related fields you create in the app.",
        "Shared data: when you create public share links, only the information needed to render the shared view is exposed via the sharing endpoint.",
        "Files/attachments: if you upload assets, they are processed through configured blob storage endpoints.",
      ],
    },
    {
      heading: "3. How We Use Data",
      content: [
        "To provide core calendar features, including creating, editing, displaying, importing, exporting, and sharing schedule data.",
        "To authenticate users, secure sessions, and prevent abuse.",
        "To diagnose reliability issues and maintain service quality.",
      ],
    },
    {
      heading: "4. Third-Party Services",
      content: [
        "One Calendar may rely on third-party services such as Clerk (authentication) and hosting/storage providers configured by the deployment.",
        "These providers process data according to their own terms and privacy policies.",
      ],
    },
    {
      heading: "5. Data Retention",
      content: [
        "We retain data only as long as needed to operate the service, comply with legal obligations, and resolve security or abuse issues.",
        "Self-hosted operators define their own retention schedules.",
      ],
    },
    {
      heading: "6. Your Controls",
      content: [
        "You can update or delete calendar content from within the app.",
        "You can stop using shared links by disabling or removing the shared resource.",
        "You can request account-related support through the contact channels listed below.",
      ],
    },
    {
      heading: "7. Security",
      content: [
        "We use technical and operational safeguards appropriate to the current product architecture, including authenticated access controls and transport security.",
        "No system can be guaranteed 100% secure, but we continuously improve protections.",
      ],
    },
    {
      heading: "8. Policy Changes",
      content: [
        "We may update this policy as the product evolves. Material changes will be reflected by updating the date on this page.",
      ],
    },
  ],
  cta: "Questions about privacy or data handling?",
  github: "Visit our GitHub Repository",
  home: "Return to Home",
}

export default function PrivacyPolicy() {
  return <LegalPageShell {...privacyContent} />
}
