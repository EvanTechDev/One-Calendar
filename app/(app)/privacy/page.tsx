"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { GithubIcon } from "lucide-react"

export default function PrivacyPolicy() {
  const [lang, setLang] = useState<"en" | "zh">("en")

  useEffect(() => {
    if (navigator.language.startsWith("zh")) {
      setLang("zh")
    }
  }, [])

  const content = {
    en: {
      title: "One Calendar Privacy Policy",
      lastUpdated: "Last updated: July 18, 2025",
      intro: "At One Calendar, we are committed to maintaining the highest standards of privacy protection and data security. This comprehensive Privacy Policy outlines our practices regarding the collection, processing, storage, and protection of your personal information when you utilize our services, including our web platform, mobile applications, and self-hosted instances.",
      sections: [
        {
          heading: "1. Information We Collect",
          content: [
            "Account Authentication Data: Through our integration with Clerk authentication services, we collect essential account credentials including your email address, display name, and profile information provided by third-party authentication providers (GitHub, Google, Microsoft) to establish and maintain your user account securely.",
            "Calendar and Scheduling Data: All calendar events, appointments, scheduling information, recurring patterns, reminders, and associated metadata that you create, modify, or import into One Calendar are processed and stored to deliver our core scheduling and collaboration functionality.",
            "Usage Analytics and Telemetry: We collect comprehensive usage patterns, feature interaction data, performance metrics, error logs, and technical information including browser specifications, operating system details, IP addresses, and device identifiers to optimize platform performance and user experience.",
            "File Storage and Backup Data: Documents, attachments, images, and other files you upload or backup to One Calendar through our Supabase integration are securely stored and processed solely to enhance your calendar experience and enable document attachment capabilities.",
            "Geolocation Data: With your explicit consent, we collect precise or approximate location information to provide localized weather data, timezone detection, and location-based event suggestions. This collection is entirely optional and can be disabled without affecting core functionality.",
            "Communication Data: Messages, support inquiries, feedback submissions, and any correspondence you initiate with our support team are retained to provide customer service and improve our offerings."
          ]
        },
        {
          heading: "2. How We Process Your Information",
          content: [
            "Service Delivery and Enhancement: We utilize your information to provide, maintain, and continuously improve our calendar services, including personalizing your user experience, enabling collaborative features, and developing new functionality based on user needs and behavior patterns.",
            "Identity Verification and Security: Through Clerk's robust authentication infrastructure, we verify your identity and maintain secure access controls to protect your account from unauthorized access and ensure data integrity.",
            "Platform Optimization: We analyze aggregated usage patterns, performance metrics, and user feedback to optimize our platform's reliability, speed, and user interface design while maintaining individual privacy.",
            "Communication and Support: We process your contact information to deliver important service notifications, security alerts, feature updates, and respond to your support requests and inquiries in a timely manner.",
            "Legal Compliance: We may process your data to comply with applicable laws, regulations, legal processes, and governmental requests while maintaining transparency about such requirements."
          ]
        },
        {
          heading: "3. Self-Hosted Instances",
          content: [
            "Complete Data Sovereignty: When utilizing our self-hosted solution, you maintain absolute control and ownership over all your data, including calendar information, and uploaded files stored within your own infrastructure environment.",
            "No Third-Party Data Transmission: Unless explicitly configured and consented to by you, self-hosted instances operate independently without transmitting any personal data to our servers, third-party services, or external analytics platforms.",
            "Infrastructure Independence: You retain full responsibility for data security, backup strategies, server maintenance, and compliance with applicable data protection regulations within your chosen hosting environment.",
            "Comprehensive Documentation: We provide detailed technical documentation, security best practices, configuration guides, and deployment instructions to ensure secure and reliable self-hosting implementation.",
            "Flexible Data Management: Self-hosted users can implement custom data retention policies, backup schedules, access controls, and security measures tailored to their specific organizational requirements.",
            "Optional Telemetry Services: You may optionally enable anonymized telemetry data collection to help us improve platform stability and feature development while maintaining complete control over what information is shared.",
            "Enterprise Support: Dedicated technical support, custom integration assistance, and priority security updates are available for enterprise self-hosted deployments."
          ]
        },
        {
          heading: "4. Data Processing Locations",
          content: [
            "Primary Data Centers: All hosted service data processing occurs within enterprise-grade, SOC 2 Type II certified data centers located in the United States, ensuring compliance with stringent security and operational standards.",
            "Self-Hosted Flexibility: Organizations utilizing self-hosted instances have complete autonomy to select their preferred data processing locations, whether on-premises, private cloud, or specific geographic regions to meet regulatory requirements.",
            "International Compliance: We adhere to international data transfer regulations including GDPR, CCPA, and other applicable privacy frameworks, implementing appropriate safeguards for cross-border data transfers when necessary.",
            "Data Processing Agreements: Comprehensive Data Processing Agreements (DPAs) are available for enterprise customers, outlining specific data handling procedures, security measures, and compliance obligations.",
            "Regulatory Alignment: Our data processing practices are designed to comply with major privacy regulations worldwide, including provisions for data localization requirements in various jurisdictions."
          ]
        },
        {
          heading: "5. Data Protection and Security Framework",
          content: [
            "Advanced Encryption Protocols: All data communications utilize industry-leading end-to-end encryption using TLS 1.3 protocols, while stored data is protected with AES-256 encryption standards, ensuring your information remains secure both in transit and at rest.",
            "Comprehensive Security Auditing: We conduct regular third-party security assessments, penetration testing, vulnerability scans, and compliance audits to identify and address potential security vulnerabilities proactively.",
            "Open Source Transparency: Our commitment to transparency is demonstrated through our open-source codebase, enabling community security reviews, independent audits, and collaborative security improvements.",
            "Real-Time Threat Monitoring: Advanced security monitoring systems continuously analyze network traffic, user behavior patterns, and system activities to detect and respond to potential security threats in real-time.",
            "Automated Security Updates: Our infrastructure employs automated security patching, dependency updates, and vulnerability remediation processes to maintain the highest security standards without service interruption.",
            "Multi-Factor Authentication: All administrative access requires multi-factor authentication, hardware security keys, and role-based access controls to prevent unauthorized system access."
          ]
        },
        {
          heading: "6. Infrastructure Security Measures",
          content: [
            "Certified Data Centers: All server infrastructure is hosted within SOC 2 Type II certified facilities that meet or exceed industry standards for physical security, environmental controls, and operational procedures.",
            "Network Security Architecture: Enterprise-grade firewall systems, intrusion detection and prevention systems (IDS/IPS), DDoS protection, and network segmentation provide multiple layers of security defense.",
            "Backup and Disaster Recovery: Automated, encrypted backup systems with geographically distributed storage ensure data availability and business continuity, with regular disaster recovery testing and validation procedures.",
            "Access Control Management: Strict administrative access controls utilizing principle of least privilege, mandatory multi-factor authentication, session monitoring, and comprehensive audit logging for all system interactions.",
            "Data Encryption Standards: All stored data is encrypted using AES-256 encryption algorithms with secure key management systems, while database connections utilize encrypted channels and certificate-based authentication."
          ]
        },
        {
          heading: "7. Third-Party Service Integration",
          content: [
            "Clerk Authentication Services: Our user authentication is managed through Clerk's secure platform. When you authenticate via GitHub, Google, or Microsoft, Clerk processes your credentials and shares only essential profile information required for account creation. Please review Clerk's Privacy Policy for detailed information about their data handling practices.",
            "Supabase Database Services: File uploads and data backup functionality utilize Supabase's PostgreSQL database infrastructure. All data stored through Supabase is governed by their privacy policy and security standards, with encryption and access controls in place.",
            "Groq AI Services: AI-powered chat functionality sends conversation history to Groq's servers for processing and response generation. Please refer to Groq's privacy policy to understand how they handle your interaction data.",
            "Limited Data Sharing: We maintain strict data sharing policies and only share information with third-party services when necessary to provide our core functionality or when required by legal obligations. We do not sell or commercialize your personal data."
          ]
        },
        {
          heading: "8. Data Sharing and Disclosure Policies",
          content: [
            "Privacy by Default: Your calendar data, personal information, and uploaded files are private by default and are only shared with other users when you explicitly enable collaboration features or grant specific permissions.",
            "Legal Compliance Requirements: We may disclose your information when required by applicable law, legal process, court orders, subpoenas, or governmental requests, while providing you with notice when legally permissible.",
            "Business Continuity: In the event of corporate reorganization, merger, acquisition, or asset transfer, your data may be transferred as part of the transaction, with contractual obligations to maintain equivalent privacy protections.",
            "Security Incident Response: We may disclose information when necessary to investigate security breaches, prevent fraud, protect our legal rights, or ensure the safety and security of our users and platform."
          ]
        },
        {
          heading: "9. Your Privacy Rights and Choices",
          content: [
            "Account Management: You have comprehensive control over your account information and can access, modify, export, or delete your data at any time through your One Calendar account settings or by contacting our support team.",
            "Communication Preferences: You can customize your notification settings, opt out of non-essential communications, and manage your email preferences through your account dashboard.",
            "Regional Privacy Rights: Depending on your location, you may have additional rights under data protection laws such as GDPR, CCPA, or other applicable regulations, including the right to data portability, rectification, erasure, and processing restrictions.",
            "Data Access Requests: You can request copies of your personal data, information about our processing activities, or exercise other privacy rights by contacting us through our designated privacy channels."
          ]
        },
        {
          heading: "10. Data Retention and Deletion",
          content: [
            "Active Account Retention: We retain your personal data for as long as your account remains active and is necessary to provide our services, maintain security, and comply with legal obligations.",
            "Account Deletion Process: Upon account deletion, we will permanently remove your personal information, calendar data, and uploaded files within 30 days, except where retention is required for legal, regulatory, or legitimate business purposes.",
            "Backup Data Handling: Deleted data may persist in encrypted backup systems for up to 90 days to ensure system integrity and disaster recovery capabilities before permanent deletion.",
            "Legal Retention Requirements: Certain data may be retained longer when required by applicable laws, ongoing legal proceedings, or legitimate business interests such as security incident investigation."
          ]
        },
        {
          heading: "11. Children's Privacy Protection",
          content: [
            "All-Ages Accessibility: One Calendar is designed as a safe, intuitive calendar tool suitable for users of all ages, with parental or guardian oversight recommended for users under 18 years of age.",
            "Parental Controls: Parents and guardians can create and manage accounts for minors, monitor usage, and implement appropriate privacy and safety measures to ensure responsible use of our services.",
            "Educational Use: We support educational institutions and family use cases while maintaining the same high privacy standards for all users regardless of age.",
            "COPPA Compliance: For users under 13 years of age, we comply with the Children's Online Privacy Protection Act (COPPA) requirements and encourage parental involvement in account management."
          ]
        },
        {
          heading: "12. International Data Transfers",
          content: [
            "Cross-Border Safeguards: When personal data is transferred internationally, we implement appropriate safeguards such as Standard Contractual Clauses (SCCs), adequacy decisions, or other approved transfer mechanisms.",
            "Regional Compliance: We maintain compliance with regional data protection requirements including GDPR for European users, PIPEDA for Canadian users, and other applicable privacy frameworks.",
            "Data Localization Options: Self-hosted instances provide complete control over data location and can be configured to meet specific geographic data residency requirements."
          ]
        },
        {
          heading: "13. Privacy Policy Updates",
          content: [
            "Change Notification Process: We will notify you of material changes to this Privacy Policy through email, in-app notifications, or prominent website notices at least 30 days before the changes take effect.",
            "Version Control: All policy updates include version dating and change summaries to help you understand what has been modified since your last review.",
            "Continued Use Agreement: Your continued use of One Calendar after policy changes take effect constitutes your acceptance of the updated terms, unless you choose to discontinue use of our services."
          ]
        },
        {
          heading: "14. Contact Information and Privacy Inquiries",
          content: [
            "Primary Contact: For privacy-related questions, concerns, or requests, please contact our at evan.huang000@proton.me with detailed information about your inquiry.",
            "Technical Support: Technical issues, account problems, and general support can be addressed through our GitHub repository or support channels.",
            "Regulatory Inquiries: For compliance-related questions or regulatory inquiries, please use our designated privacy contact methods with appropriate documentation.",
            "Response Timeline: We strive to respond to all privacy inquiries within 30 days and will provide updates if additional time is required for complex requests."
          ]
        }
      ],
      cta: "Have feedback or want to contribute to One Calendar's privacy initiatives?",
      github: "Visit our GitHub Repository",
      home: "Return to Home"
    },
    zh: {
      title: "One Calendar 隐私政策",
      lastUpdated: "最后更新：2025年7月18日",
      intro: "在 One Calendar，我们致力于维持最高标准的隐私保护和数据安全。本综合隐私政策概述了我们在您使用我们的服务时关于个人信息收集、处理、存储和保护的做法，包括我们的网络平台、移动应用程序和自托管实例。",
      sections: [
        {
          heading: "1. 我们收集的信息",
          content: [
            "账户认证数据：通过与 Clerk 认证服务的集成，我们收集必要的账户凭据，包括您的电子邮件地址、显示名称以及第三方认证提供商（GitHub、Google、Microsoft）提供的个人资料信息，以安全地建立和维护您的用户账户。",
            "日历和日程数据：您在 One Calendar 中创建、修改或导入的所有日历事件、预约、日程信息、重复模式、提醒和相关元数据都将被处理和存储，以提供我们的核心日程安排和协作功能。",
            "使用分析和遥测数据：我们收集全面的使用模式、功能交互数据、性能指标、错误日志和技术信息，包括浏览器规格、操作系统详细信息、IP地址和设备标识符，以优化平台性能和用户体验。",
            "文件存储和备份数据：您通过我们的 Supabase 集成上传或备份到 One Calendar 的文档、附件、图像和其他文件将被安全存储和处理，仅用于增强您的日历体验并启用文档附件功能。",
            "地理位置数据：经过您的明确同意，我们收集精确或近似的位置信息，以提供本地化的天气数据、时区检测和基于位置的事件建议。这种收集是完全可选的，可以在不影响核心功能的情况下禁用。",
            "通信数据：您发起的消息、支持询问、反馈提交以及与我们支持团队的任何通信都将被保留，以提供客户服务并改进我们的产品。"
          ]
        },
        {
          heading: "2. 我们如何处理您的信息",
          content: [
            "服务交付和增强：我们利用您的信息来提供、维护和持续改进我们的日历服务，包括个性化您的用户体验、启用协作功能，以及根据用户需求和行为模式开发新功能。",
            "身份验证和安全：通过 Clerk 强大的认证基础设施，我们验证您的身份并维护安全访问控制，以保护您的账户免受未经授权的访问并确保数据完整性。",
            "平台优化：我们分析汇总的使用模式、性能指标和用户反馈，以优化我们平台的可靠性、速度和用户界面设计，同时维护个人隐私。",
            "通信和支持：我们处理您的联系信息，以传递重要的服务通知、安全警报、功能更新，并及时回应您的支持请求和询问。",
            "法律合规：我们可能会处理您的数据以遵守适用的法律、法规、法律程序和政府要求，同时对此类要求保持透明度。"
          ]
        },
        {
          heading: "3. 自托管实例",
          content: [
            "完全数据主权：当使用我们的自托管解决方案时，您对存储在自己基础设施环境中的所有数据保持绝对控制和所有权，包括日历信息和上传的文件。",
            "无第三方数据传输：除非您明确配置和同意，自托管实例独立运行，不会向我们的服务器、第三方服务或外部分析平台传输任何个人数据。",
            "基础设施独立性：您对数据安全、备份策略、服务器维护以及在您选择的托管环境中遵守适用的数据保护法规承担全部责任。",
            "全面文档：我们提供详细的技术文档、安全最佳实践、配置指南和部署说明，以确保安全可靠的自托管实施。",
            "灵活的数据管理：自托管用户可以实施定制的数据保留政策、备份计划、访问控制和针对其特定组织要求的安全措施。",
            "可选遥测服务：您可以选择性地启用匿名遥测数据收集，以帮助我们改进平台稳定性和功能开发，同时保持对共享信息的完全控制。",
            "企业支持：为企业自托管部署提供专门的技术支持、定制集成协助和优先安全更新。"
          ]
        },
        {
          heading: "4. 数据处理位置",
          content: [
            "主要数据中心：所有托管服务数据处理都在位于美国的企业级、SOC 2 Type II 认证数据中心内进行，确保符合严格的安全和运营标准。",
            "自托管灵活性：使用自托管实例的组织完全有权选择其首选的数据处理位置，无论是本地、私有云还是特定地理区域，以满足监管要求。",
            "国际合规：我们遵守国际数据传输法规，包括 GDPR、CCPA 和其他适用的隐私框架，在必要时为跨境数据传输实施适当的保障措施。",
            "数据处理协议：为企业客户提供全面的数据处理协议（DPA），概述具体的数据处理程序、安全措施和合规义务。",
            "监管对齐：我们的数据处理实践旨在符合全球主要隐私法规，包括各司法管辖区数据本地化要求的规定。"
          ]
        },
        {
          heading: "5. 数据保护和安全框架",
          content: [
            "高级加密协议：所有数据通信都使用行业领先的端到端加密，采用 TLS 1.3 协议，而存储的数据则受到 AES-256 加密标准的保护，确保您的信息在传输和静态存储时都保持安全。",
            "全面安全审计：我们定期进行第三方安全评估、渗透测试、漏洞扫描和合规审计，以主动识别和解决潜在的安全漏洞。",
            "开源透明度：我们通过开源代码库展示对透明度的承诺，使社区安全审查、独立审计和协作安全改进成为可能。",
            "实时威胁监控：先进的安全监控系统持续分析网络流量、用户行为模式和系统活动，以实时检测和响应潜在的安全威胁。",
            "自动安全更新：我们的基础设施采用自动安全补丁、依赖更新和漏洞修复流程，在不中断服务的情况下维持最高的安全标准。",
            "多因素认证：所有管理访问都需要多因素认证、硬件安全密钥和基于角色的访问控制，以防止未经授权的系统访问。"
          ]
        },
        {
          heading: "6. 基础设施安全措施",
          content: [
            "认证数据中心：所有服务器基础设施都托管在符合或超过物理安全、环境控制和运营程序行业标准的 SOC 2 Type II 认证设施内。",
            "网络安全架构：企业级防火墙系统、入侵检测和防护系统（IDS/IPS）、DDoS 保护和网络分段提供多层安全防护。",
            "备份和灾难恢复：自动化、加密的备份系统具有地理分布式存储，确保数据可用性和业务连续性，并定期进行灾难恢复测试和验证程序。",
            "访问控制管理：严格的管理访问控制采用最小权限原则、强制多因素认证、会话监控和对所有系统交互的全面审计日志记录。",
            "数据加密标准：所有存储的数据都使用 AES-256 加密算法和安全密钥管理系统进行加密，而数据库连接使用加密通道和基于证书的认证。"
          ]
        },
        {
          heading: "7. 第三方服务集成",
          content: [
            "Clerk 认证服务：我们的用户认证通过 Clerk 的安全平台管理。当您通过 GitHub、Google 或 Microsoft 进行认证时，Clerk 处理您的凭据并仅共享创建账户所需的基本个人资料信息。请查看 Clerk 的隐私政策，了解其数据处理实践的详细信息。",
            "Supabase 数据库服务：文件上传和数据备份功能使用 Supabase 的 PostgreSQL 数据库基础设施。通过 Supabase 存储的所有数据都受其隐私政策和安全标准的管辖，并实施了加密和访问控制。",
            "Groq AI 服务：AI 驱动的聊天功能将对话历史发送到 Groq 的服务器进行处理和响应生成。请参阅 Groq 的隐私政策，了解他们如何处理您的交互数据。",
            "有限数据共享：我们维持严格的数据共享政策，仅在提供核心功能必需时或法律义务要求时与第三方服务共享信息。我们不出售或商业化您的个人数据。"
          ]
        },
        {
          heading: "8. 数据共享和披露政策",
          content: [
            "默认隐私：您的日历数据、个人信息和上传的文件默认为私有，仅在您明确启用协作功能或授予特定权限时才与其他用户共享。",
            "法律合规要求：当适用法律、法律程序、法院命令、传票或政府要求时，我们可能会披露您的信息，在法律允许的情况下会提前通知您。",
            "业务连续性：在企业重组、合并、收购或资产转移的情况下，您的数据可能作为交易的一部分被转移，但有合同义务维持同等的隐私保护。",
            "安全事件响应：当需要调查安全漏洞、防止欺诈、保护我们的合法权益或确保用户和平台的安全时，我们可能会披露信息。"
          ]
        },
        {
          heading: "9. 您的隐私权利和选择",
          content: [
            "账户管理：您可以通过 One Calendar 账户设置或联系我们的支持团队，随时全面控制您的账户信息，包括访问、修改、导出或删除您的数据。",
            "通信偏好：您可以通过账户仪表板自定义通知设置、选择退出非必要通信并管理您的电子邮件偏好。",
            "地区隐私权利：根据您的位置，您可能在 GDPR、CCPA 或其他适用法规等数据保护法律下享有额外权利，包括数据可携性、更正、删除和处理限制的权利。",
            "数据访问请求：您可以通过我们指定的隐私渠道请求您的个人数据副本、我们的处理活动信息或行使其他隐私权利。"
          ]
        },
        {
          heading: "10. 数据保留和删除",
          content: [
            "活跃账户保留：只要您的账户保持活跃状态，并且提供我们的服务、维护安全和遵守法律义务所必需，我们就会保留您的个人数据。",
            "账户删除过程：账户删除后，我们将在 30 天内永久删除您的个人信息、日历数据和上传的文件，除非法律、监管或合法商业目的要求保留。",
            "备份数据处理：已删除的数据可能在加密备份系统中持续存在长达 90 天，以确保系统完整性和灾难恢复能力，然后才会永久删除。",
            "法律保留要求：当适用法律、正在进行的法律程序或合法商业利益（如安全事件调查）要求时，某些数据可能会保留更长时间。"
          ]
        },
        {
          heading: "11. 儿童隐私保护",
          content: [
            "全年龄段可访问性：One Calendar 被设计为适合所有年龄段用户的安全、直观的日历工具，建议 18 岁以下用户在家长或监护人监督下使用。",
            "家长控制：家长和监护人可以为未成年人创建和管理账户、监控使用情况，并实施适当的隐私和安全措施，确保负责任地使用我们的服务。",
            "教育用途：我们支持教育机构和家庭使用场景，同时为所有用户维持相同的高隐私标准，无论年龄如何。",
            "COPPA 合规：对于 13 岁以下的用户，我们遵守《儿童在线隐私保护法》（COPPA）的要求，并鼓励家长参与账户管理。"
          ]
        },
        {
          heading: "12. 国际数据传输",
          content: [
            "跨境保障措施：当个人数据进行国际传输时，我们实施适当的保障措施，如标准合同条款（SCC）、充分性决定或其他批准的传输机制。",
            "地区合规：我们保持与地区数据保护要求的合规，包括欧洲用户的 GDPR、加拿大用户的 PIPEDA 和其他适用的隐私框架。",
            "数据本地化选项：自托管实例提供对数据位置的完全控制，可以配置为满足特定的地理数据驻留要求。"
          ]
        },
        {
          heading: "13. 隐私政策更新",
          content: [
            "变更通知流程：我们将通过电子邮件、应用内通知或显著的网站通知，在变更生效前至少 30 天通知您本隐私政策的重大变更。",
            "版本控制：所有政策更新都包括版本日期和变更摘要，以帮助您了解自上次审查以来的修改内容。",
            "继续使用协议：在政策变更生效后，您继续使用 One Calendar 构成您对更新条款的接受，除非您选择停止使用我们的服务。"
          ]
        },
        {
          heading: "14. 联系信息和隐私查询",
          content: [
            "主要联系方式：对于隐私相关的问题、担忧或请求，请联系我们，邮箱：evan.huang000@proton.me，并提供您查询的详细信息。",
            "技术支持：技术问题、账户问题和一般支持可以通过我们的 GitHub 存储库或支持渠道解决。",
            "监管查询：对于合规相关问题或监管查询，请使用我们指定的隐私联系方式并提供适当的文档。",
            "响应时间：我们努力在 30 天内回应所有隐私查询，如果复杂请求需要额外时间，我们会提供更新。"
          ]
        }
      ],
      cta: "有反馈或想为 One Calendar 做出贡献吗？",
      github: "访问我们的 GitHub 存储库",
      home: "返回主页"
    }
  }
  

  const t = content[lang]

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
        <h1 className="text-4xl font-bold text-center mb-12">{t.title}</h1>
        <p className="text-sm text-gray-500 text-center mb-8 dark:text-white">{t.lastUpdated}</p>
        <div className="space-y-8 text-left">
          <p className="text-lg text-gray-700 leading-relaxed dark:text-white">{t.intro}</p>
          {t.sections.map((section, i) => (
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
          <h2 className="text-xl font-medium dark:text-white">{t.cta}</h2>
          <div className="flex justify-center gap-4 pt-4">
            <Link
              href="https://github.com/Dev-Huang1/One-Calendar"
              target="_blank"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <GithubIcon className="w-4 h-4" />
              {t.github}
            </Link>
            <Link href="/" className="text-sm text-gray-500 underline hover:text-black">
              {t.home}
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
            <a href="https://x.com/One__Cal" target="_blank" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="16" height="16" viewBox="0 0 32 32">
                <path fill="currentColor" d="M 4.0175781 4 L 13.091797 17.609375 L 4.3359375 28 L 6.9511719 28 L 14.246094 19.34375 L 20.017578 28 L 20.552734 28 L 28.015625 28 L 18.712891 14.042969 L 27.175781 4 L 24.560547 4 L 17.558594 12.310547 L 12.017578 4 L 4.0175781 4 z M 7.7558594 6 L 10.947266 6 L 24.279297 26 L 21.087891 26 L 7.7558594 6 z"></path>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
