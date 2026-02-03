"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { GithubIcon } from "lucide-react"

const privacyContent = {
  title: "One Calendar Privacy Policy",
  lastUpdated: "Last updated: February 2, 2026",
  intro: "One Calendar rigorously adheres to the highest standards of information security, privacy governance, and operational integrity. This comprehensive policy delineates the detailed protocols, methodological approaches, and technical safeguards applied in the collection, processing, storage, and protection of personal data across our web and mobile platforms. It emphasizes a research-informed and compliance-oriented approach to privacy preservation, including considerations for advanced encryption methodologies, zero trust principles, and ISO 27001-aligned frameworks.",
  sections: [
    {
      heading: "1. Self-Hosted Instances",
      content: ["Users operating One Calendar in self-hosted environments retain complete sovereignty over their data, system architecture, and operational configurations. The platform provides exhaustive guidance on secure deployment practices, encompassing network segmentation, firewall hardening, server and database configuration best practices, cryptographic key management, and granular access controls. Adherence to these guidelines ensures both operational resilience and regulatory compliance. Users are responsible for continuous monitoring, timely application of security patches, and regular audits to maintain system integrity and mitigate potential vulnerabilities. Detailed documentation and implementation examples are provided to support administrators in establishing a security-conscious operational environment."]
    },
    {
      heading: "2. Data Processing Location",
      content: ["All personal data is processed and stored on physically secured servers located in Sweden, within the European Economic Area (EEA). This geographic placement ensures strict compliance with GDPR and other European data protection standards. Swedish data centers are subject to comprehensive regulatory oversight, regular security audits, and strict physical access controls. Furthermore, environmental and operational monitoring is continuously performed to ensure the integrity, availability, and confidentiality of user data. This location strategy also provides legal clarity and operational transparency for cross-border data governance scenarios."]
    },
    {
      heading: "3. Information We Collect",
      content: [
        "Account Authentication Data: Through integration with Clerk, One Calendar collects necessary credentials, including email identifiers, display names, and third-party profile information from providers such as GitHub, Google, and Microsoft, exclusively to enable secure account provisioning, authentication, and recovery processes.",
        "Calendar and Scheduling Data: All user-generated scheduling information—including event descriptions, recurring appointments, reminders, participant metadata, and associated timestamps—is protected through client-side end-to-end encryption (E2EE). This ensures no plaintext content is accessible by servers, staff, or third-party providers. Minimal operational metadata, such as backup timestamps, are retained solely to facilitate synchronization and system reliability without compromising user confidentiality.",
        "Usage Analytics and Telemetry: Aggregated, anonymized telemetry data is collected to evaluate platform performance, usage patterns, feature interaction, error rates, and device compatibility metrics. These analytics inform data-driven improvements to platform functionality, security features, and user experience design, while strictly preserving individual privacy.",
        "File Storage and Backup Data: Documents, attachments, and supplementary files uploaded to the platform are encrypted using strong cryptographic protocols and stored exclusively within Swedish infrastructure. Access to decrypted content is strictly prohibited for service operators, ensuring complete data confidentiality.",
        "Optional Geolocation Data: Geospatial information is collected only with explicit user consent, enabling features such as local time zone adjustment, location-based event suggestions, and contextualized notifications. Users can fully opt out of this collection at any time without degradation of core functionality.",
        "Communication Data: All correspondence with support channels, including feedback submissions, technical inquiries, and issue reports, is securely stored and encrypted. This information is solely used to provide responsive support, investigate technical incidents, and enhance the platform's service quality."
      ]
    },
    {
      heading: "4. Processing Methodologies",
      content: [
        "Service Provisioning: Calendar data processing is strictly limited to facilitating essential platform functionalities, such as event creation, reminders, notification delivery, synchronization across devices, and secure collaboration between authorized participants.",
        "Zero Trust and E2EE Paradigm: One Calendar enforces a Zero Trust architecture, wherein all sensitive user data is encrypted at the client endpoint before transmission. This approach ensures that even if infrastructure components are compromised, encrypted data remains unintelligible to unauthorized actors. The platform does not maintain decryption keys on servers, eliminating the possibility of inadvertent exposure.",
        "Data Minimization Strategy: Collection is restricted to only the minimal metadata required to ensure operational continuity, such as backup timestamps or synchronization status. All other personal content, identifiers, and event details remain inaccessible to both internal personnel and third-party service providers.",
        "Third-Party Integrations: Clerk, Supabase, and Neon are utilized exclusively for authentication, encrypted storage, and operational support under contractual obligations that prohibit access to unencrypted content. Regular compliance reviews ensure these providers adhere to equivalent security and privacy standards."
      ]
    },
    {
      heading: "5. Data Protection and Security Framework",
      content: [
        "One Calendar operates a comprehensive Information Security Management System (ISMS) aligned with ISO 27001 standards, integrating systematic risk assessments, hierarchical access control, encryption management, backup orchestration, and incident response protocols. Regular internal and external audits are conducted to validate adherence to these standards.",
        "Zero Trust enforcement ensures that servers cannot access encrypted event content, complementing client-side E2EE to mitigate risks of unauthorized disclosure or interception.",
        "Continuous security validation is maintained through rigorous penetration testing, vulnerability scanning, code audits, and operational monitoring. Findings are remediated promptly according to a risk-based prioritization framework, ensuring sustained operational integrity and resilience against evolving threats."
      ]
    },
    {
      heading: "6. Infrastructure Security Measures",
      content: [
        "Physical and logical safeguards include multilayer firewall configurations, intrusion detection and prevention systems, environmental monitoring, and comprehensive logging and alerting mechanisms. Data in transit is protected using Transport Layer Security (TLS), while server-side encryption complements client-side E2EE to provide layered defense-in-depth.",
        "Administrative access is tightly controlled through role-based permissions, multi-factor authentication, and continuous audit trails. All access attempts are logged and reviewed periodically to ensure accountability and adherence to established security policies. Detailed operational playbooks define escalation procedures for anomalous activities."
      ]
    },
    {
      heading: "7. Data Sharing and Disclosure Policy",
      content: [
        "No personal data is sold, leased, or traded. Third-party sharing is strictly limited to authentication and encrypted storage purposes, governed by legally enforceable contracts prohibiting access to unencrypted data.",
        "Disclosure is permissible only to comply with statutory obligations, regulatory directives, legal processes, or to protect the rights, property, or safety of One Calendar, its users, or other stakeholders. All disclosure actions are logged, assessed for proportionality, and documented for audit purposes."
      ]
    },
    {
      heading: "8. Data Storage and Security",
      content: [
        "All data resides within Swedish data centers, leveraging server-side encryption in conjunction with client-side E2EE to maintain confidentiality and integrity of scheduling content. High-availability configurations, redundant storage arrays, and continuous operational monitoring ensure resilience against hardware failures, natural disasters, and service disruptions.",
        "Access to stored data is strictly governed by role-based controls, audit logging, and periodic review processes in alignment with ISO 27001 frameworks. Encryption keys are managed according to best-practice key management protocols, ensuring cryptographic strength and separation of duties."
      ]
    },
    {
      heading: "9. User Rights and Control",
      content: [
        "Data Access and Portability: Users may access, review, and export their encrypted data at any time through standardized, interoperable formats.",
        "Correction and Erasure: Users can modify or delete calendar entries, associated files, and account information. Server-side retention systems honor these actions, ensuring complete alignment with user requests.",
        "Consent Revocation: Optional consents, including geolocation tracking, may be withdrawn without disrupting primary service functions.",
        "Data Protection Inquiries: Users are encouraged to engage support channels for clarification, assistance, or reporting potential privacy or security concerns, with all inquiries tracked and addressed in accordance with compliance protocols."
      ]
    },
    {
      heading: "10. Data Retention and Erasure",
      content: [
        "Personal data is retained only for as long as necessary to deliver services, fulfill legal obligations, and maintain operational continuity. Retention policies incorporate automated lifecycle management to ensure data is securely deleted when no longer required.",
        "Users may request comprehensive data deletion at any time, with backup systems purged according to verified procedures to prevent residual retention of personal information. These processes are periodically audited to confirm full compliance."
      ]
    },
    {
      heading: "11. International Data Transfers",
      content: [
        "While all primary data processing occurs within the EEA, certain authentication services may involve cross-border transfers. All such transfers are governed by Standard Contractual Clauses (SCCs), Binding Corporate Rules (BCRs), or equivalent mechanisms, ensuring that data protection standards remain consistent irrespective of geographic location.",
        "Users are informed of the specific jurisdictions involved in data processing, and appropriate legal safeguards are applied to prevent unauthorized access or disclosure during transit or processing."
      ]
    },
    {
      heading: "12. Compliance and Regulatory Oversight",
      content: ["One Calendar maintains continuous compliance with applicable data protection regulations, including GDPR, CCPA, and other jurisdiction-specific frameworks. Regular third-party audits, internal compliance reviews, and engagement with regulatory authorities ensure that the platform operates in full alignment with legal and ethical standards. Documentation of compliance efforts is maintained to demonstrate accountability and facilitate regulatory inquiries."]
    },
    {
      heading: "13. Policy Revisions",
      content: ["This Privacy Policy undergoes periodic review and amendment to reflect evolving regulatory requirements, technological advancements, and operational improvements. Substantive changes are communicated to users, with the effective date updated to reflect the most recent revision. Users are encouraged to review the policy periodically to remain informed of their rights and One Calendar's data protection practices."]
    }
  ],
  cta: "Have feedback or want to contribute to One Calendar's privacy initiatives?",
  github: "Visit our GitHub Repository",
  home: "Return to Home"
}

export default function PrivacyPolicy() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col text-black dark:text-white">
      <main className="max-w-3xl mx-auto px-6 py-24">
        <div className="fixed -z-10 inset-0">
          <div className="absolute inset-0 bg-white dark:bg-black">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
            <div className="absolute inset-0 dark:block hidden" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-center mb-12">{privacyContent.title}</h1>
        <p className="text-sm text-gray-500 text-center mb-8 dark:text-white">{privacyContent.lastUpdated}</p>
        <div className="space-y-8 text-left">
          <p className="text-lg text-gray-700 leading-relaxed dark:text-white">{privacyContent.intro}</p>
          {privacyContent.sections.map((section, i) => (
            <div key={i} className="space-y-4">
              <h2 className="text-2xl font-semibold">{section.heading}</h2>
              {section.content.map((item, j) => (
                <p key={j} className="text-lg text-gray-700 leading-relaxed dark:text-white">
                  {item}
                </p>
              ))}
            </div>
          ))}
        </div>
      </main>

      <section className="text-center px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-xl font-medium dark:text-white">{privacyContent.cta}</h2>
          <div className="flex justify-center gap-4 pt-4">
            <Link
              href="https://github.com/EvanTechDev/One-Calendar"
              target="_blank"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <GithubIcon className="w-4 h-4" />
              {privacyContent.github}
            </Link>
            <Link href="/" className="text-sm text-gray-500 underline hover:text-black">
              {privacyContent.home}
            </Link>
          </div>
        </div>
      </section>

      <footer className="mt-auto py-8 border-t border-black/10 dark:border-white/10 text-gray-600 dark:text-white/70 text-sm px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; 2025 One Calendar. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="/about" className="hover:text-gray-900 dark:hover:text-white">About</a>
            <a href="/privacy" className="hover:text-gray-900 dark:hover:text-white">Privacy</a>
            <a href="/terms" className="hover:text-gray-900 dark:hover:text-white">Terms</a>
            <a href="https://github.com/EvanTechDev/One-Calendar" target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
              <GithubIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
