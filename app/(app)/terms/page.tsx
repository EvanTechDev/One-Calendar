"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { GithubIcon } from "lucide-react"

export default function TermsOfService() {
  const [lang, setLang] = useState<"en" | "zh">("en")

  useEffect(() => {
    if (navigator.language.startsWith("zh")) {
      setLang("zh")
    }
  }, [])

  const content = {
    en: {
      title: "One Calendar Terms of Service",
      lastUpdated: "Last updated: April 22, 2025",
      intro: "Welcome to One Calendar! These Terms of Service ('Terms') govern your use of our website, application, and services. By accessing or using One Calendar, you agree to be bound by these Terms. If you do not agree, please do not use our services.",
      sections: [
        {
          heading: "1. Use of One Calendar",
          content: [
            "One Calendar is a scheduling and collaboration tool designed for users of all ages. You may use our services to create, manage, and share calendars, subject to these Terms.",
            "You must provide accurate information when creating an account via Clerk authentication (GitHub, Google, or Microsoft).",
            "You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account."
          ]
        },
        {
          heading: "2. License (GNU GPLv3)",
          content: [
            "One Calendar is open-source software licensed under the GNU General Public License v3.0 (GPLv3). You are free to use, modify, and distribute the software in accordance with the terms of the GPLv3.",
            "The source code is available on our GitHub repository. Any modifications or derivative works must also be licensed under GPLv3 and made publicly available.",
            "For details, please review the full GPLv3 license at <a href='https://www.gnu.org/licenses/gpl-3.0.en.html' target='_blank' class='text-blue-600 hover:underline'>https://www.gnu.org/licenses/gpl-3.0.en.html</a>."
          ]
        },
        {
          heading: "3. Self-Hosting",
          content: [
            "You may self-host One Calendar on your own servers. Instructions and source code are available on our GitHub repository.",
            "When self-hosting, you are responsible for ensuring compliance with these Terms, the GPLv3 license, and applicable laws, including data protection regulations.",
            "We provide no warranties or support for self-hosted instances unless explicitly agreed upon."
          ]
        },
        {
          heading: "4. Third-Party Services",
          content: [
            "One Calendar integrates with third-party services, including Clerk for authentication (via GitHub, Google, or Microsoft) and Vercel Blob for file storage.",
            "We are not responsible for any interruptions, downtime, or issues caused by these third-party services. Your use of these services is subject to their respective terms and privacy policies.",
            "We strive to maintain reliable integrations but cannot guarantee the availability or performance of third-party services."
          ]
        },
        {
          heading: "5. User Responsibilities",
          content: [
            "You agree to use One Calendar in compliance with applicable laws and regulations.",
            "You are responsible for the content you create, upload, or share, including calendar events and files stored via Vercel Blob.",
            "You must not use One Calendar for illegal, harmful, or abusive purposes, including but not limited to distributing malware, engaging in harassment, or violating intellectual property rights."
          ]
        },
        {
          heading: "6. Community Guidelines",
          content: [
            "We encourage a respectful and inclusive community. When collaborating or contributing to One Calendar (e.g., via GitHub), you agree to:",
            "- Be respectful and considerate in your interactions.",
            "- Refrain from posting offensive, discriminatory, or inappropriate content.",
            "- Follow our contribution guidelines outlined in the GitHub repository.",
            "Violations of these guidelines may result in account suspension or termination."
          ]
        },
        {
          heading: "7. Intellectual Property",
          content: [
            "Content you create in One Calendar (e.g., events, uploaded files) remains your property. By uploading content, you grant us a non-exclusive, worldwide, royalty-free license to store, display, and process it as needed to provide our services.",
            "One Calendar’s software, design, and branding are licensed under GPLv3 or owned by us, except where third-party licenses apply."
          ]
        },
        {
          heading: "8. Limitation of Liability",
          content: [
            "One Calendar is provided 'as is' without warranties of any kind, express or implied, including fitness for a particular purpose.",
            "We are not liable for any damages arising from your use of One Calendar, including data loss, service interruptions, or third-party actions.",
            "Our liability is limited to the maximum extent permitted by law."
          ]
        },
        {
          heading: "9. Termination",
          content: [
            "You may stop using One Calendar at any time. You can delete your account via the account settings.",
            "We reserve the right to suspend or terminate your access if you violate these Terms or engage in harmful behavior.",
            "Upon termination, your data will be deleted in accordance with our Privacy Policy."
          ]
        },
        {
          heading: "10. Changes to These Terms",
          content: [
            "We may update these Terms from time to time. Changes will be posted on this page with an updated 'Last updated' date.",
            "Continued use of One Calendar after changes constitutes acceptance of the updated Terms."
          ]
        },
        {
          heading: "11. Contact Us",
          content: [
            "If you have questions about these Terms, please contact us at evan.huang000@proton.me or via GitHub.",
            "We welcome feedback and contributions to improve One Calendar."
          ]
        }
      ],
      cta: "Want to contribute or learn more about One Calendar?",
      github: "Visit our GitHub",
      home: "Back to Home"
    },
    zh: {
      title: "One Calendar 服务条款",
      lastUpdated: "最后更新：2025年4月22日",
      intro: "欢迎使用 One Calendar！本服务条款（“条款”）规范您对我们的网站、应用程序和服务的访问和使用。使用 One Calendar 即表示您同意受本条款约束。如果您不同意，请勿使用我们的服务。",
      sections: [
        {
          heading: "1. 使用 One Calendar",
          content: [
            "One Calendar 是一个为所有年龄段用户设计的日程安排和协作工具。您可以根据本条款使用我们的服务来创建、管理和共享日历。",
            "通过 Clerk 认证（GitHub、Google 或 Microsoft）创建账户时，您必须提供准确的信息。",
            "您有责任保护账户凭据的机密性，并对账户下的所有活动负责。"
          ]
        },
        {
          heading: "2. 许可证 (GNU GPLv3)",
          content: [
            "One Calendar 是根据 GNU 通用公共许可证 v3.0 (GPLv3) 许可的开源软件。您可以根据 GPLv3 的条款自由使用、修改和分发软件。",
            "源代码可在我们的 GitHub 仓库中获取。任何修改或衍生作品也必须根据 GPLv3 许可并公开提供。",
            "详情请查看完整的 GPLv3 许可证：<a href='https://www.gnu.org/licenses/gpl-3.0.en.html' target='_blank' class='text-blue-600 hover:underline'>https://www.gnu.org/licenses/gpl-3.0.en.html</a>。"
          ]
        },
        {
          heading: "3. 自托管",
          content: [
            "您可以在自己的服务器上自托管 One Calendar。相关说明和源代码可在我们的 GitHub 仓库中找到。",
            "自托管时，您有责任确保遵守本条款、GPLv3 许可证及适用的法律，包括数据保护法规。",
            "除非另有明确约定，我们不对自托管实例提供任何保证或支持。"
          ]
        },
        {
          heading: "4. 第三方服务",
          content: [
            "One Calendar 集成了第三方服务，包括用于身份验证的 Clerk（通过 GitHub、Google 或 Microsoft）和用于文件存储的 Vercel Blob。",
            "我们不对第三方服务的中断、停机或问题负责。您对这些服务的使用受其各自条款和隐私政策的约束。",
            "我们努力维护可靠的集成，但无法保证第三方服务的可用性或性能。"
          ]
        },
        {
          heading: "5. 用户责任",
          content: [
            "您同意遵守适用法律法规使用 One Calendar。",
            "您对创建、上传或共享的内容（包括日历事件和通过 Vercel Blob 存储的文件）负责。",
            "您不得将 One Calendar 用于非法、有害或滥用的目的，包括但不限于分发恶意软件、进行骚扰或侵犯知识产权。"
          ]
        },
        {
          heading: "6. 社区准则",
          content: [
            "我们鼓励建立一个尊重和包容的社区。在协作或为 One Calendar 做贡献（例如通过 GitHub）时，您同意：",
            "- 在互动中保持尊重和体贴。",
            "- 不发布冒犯性、歧视性或不适当的内容。",
            "- 遵循 GitHub 仓库中概述的贡献指南。",
            "违反这些准则可能导致账户暂停或终止。"
          ]
        },
        {
          heading: "7. 知识产权",
          content: [
            "您在 One Calendar 中创建的内容（例如事件、上传的文件）仍归您所有。通过上传内容，您授予我们非独占的、全球性的、免版税的许可，以存储、显示和处理内容，以提供我们的服务。",
            "One Calendar 的软件、设计和品牌根据 GPLv3 许可或由我们拥有，除非适用第三方许可。"
          ]
        },
        {
          heading: "8. 责任限制",
          content: [
            "One Calendar 按“现状”提供，不提供任何明示或暗示的保证，包括特定用途的适用性。",
            "我们不对您使用 One Calendar 所产生的任何损害负责，包括数据丢失、服务中断或第三方行为。",
            "我们的责任在法律允许的最大范围内受到限制。"
          ]
        },
        {
          heading: "9. 终止",
          content: [
            "您可以随时停止使用 One Calendar，并通过账户设置删除您的账户。",
            "如果您违反本条款或从事有害行为，我们保留暂停或终止您访问的权利。",
            "终止后，您的信息将根据我们的隐私政策删除。"
          ]
        },
        {
          heading: "10. 本条款的变更",
          content: [
            "我们可能会不时更新本条款。变更将在本页面发布，并更新“最后更新”日期。",
            "在变更后继续使用 One Calendar 即表示接受更新后的条款。"
          ]
        },
        {
          heading: "11. 联系我们",
          content: [
            "如对本条款有任何疑问，请通过 evan.huang000@proton.me 或 GitHub 联系我们。",
            "我们欢迎反馈和贡献，以改进 One Calendar。"
          ]
        }
      ],
      cta: "想为 One Calendar 做贡献或了解更多？",
      github: "访问我们的 GitHub",
      home: "返回首页"
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
                <p
                  key={j}
                  className="text-lg text-gray-700 leading-relaxed dark:text-white"
                  dangerouslySetInnerHTML={{ __html: item }}
                />
              ))}
            </div>
          ))}
        </div>
      </main>

      <section className="text-center px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-xl font-medium">{t.cta}</h2>
          <div className="flex justify-center gap-4 pt-4">
            <Link
              href="https://github.com/Dev-Huang1/One-Calendar"
              target="_blank"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <GithubIcon className="w-4 h-4" />
              {t.github}
            </Link>
            <Link href="/" className="text-sm text-gray-500 underline hover:text-black dark:text-white">
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
