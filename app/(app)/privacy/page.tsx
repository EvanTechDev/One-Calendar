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
      lastUpdated: "Last updated: May 2, 2025",
      intro: "At One Calendar, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect your data when you use our services, including our website and application.",
      sections: [
        {
          heading: "1. Information We Collect",
          content: [
            "Account Information: When you sign up using Clerk authentication (via GitHub, Google, or Microsoft), we collect your email address, name, and profile information provided by these services to create and manage your account.",
            "Calendar Data: Events, schedules, and related data you input into One Calendar are stored to provide our scheduling and collaboration features.",
            "Usage Data: We collect information about how you interact with our services, such as pages visited, features used, and device information (e.g., browser type, IP address).",
            "Files Uploaded: Any files you upload to One Calendar, stored via Vercel Blob or Misskey Drive, are used solely to enhance your experience, such as attaching documents to events.",
            "Location Data: We will request to collect your location data to get the weather in your area. This is optional and you can refuse it, but the weather component may not work properly."
          ]
        },
        {
          heading: "2. How We Use Your Information",
          content: [
            "To provide and improve our services, including personalizing your calendar experience and enabling collaboration features.",
            "To authenticate your identity via Clerk and ensure secure access to your account.",
            "To analyze usage patterns and optimize our platform's performance and user experience.",
            "To communicate with you, such as sending service-related notifications or responding to your inquiries."
          ]
        },
        {
          heading: "3. Data Storage and Security",
          content: [
            "Your data is stored securely using Vercel’s infrastructure, with encryption at rest and in transit.",
            "Files uploaded via Vercel Blob or Misskey Drive are stored in a manner that ensures only you (and those you explicitly share with) can access them.",
            "We implement industry-standard security measures to protect your data from unauthorized access, alteration, or disclosure.",
            "While we strive to protect your information, no system is completely secure, and we cannot guarantee absolute security."
          ]
        },
        {
          heading: "4. Third-Party Services",
          content: [
            "Clerk Authentication: We use Clerk to manage user authentication. When you log in via GitHub, Google, or Microsoft, Clerk processes your credentials and shares limited profile information with us. Please review Clerk’s Privacy Policy for details.",
            "Vercel Blob: Files you upload are stored using Vercel Blob. Vercel’s Privacy Policy governs their handling of your data.",
            "Misskey Drive: Files you upload are stored via Misskey Drive. Misskey's privacy policy governs how they handle your data.",
            "Groq: Your AI chat history is sent to Groq for AI replies. Groq's privacy policy governs what they do with your data.",
            "We do not share your data with other third parties except as necessary to provide our services or as required by law."
          ]
        },
        {
          heading: "5. Data Sharing and Disclosure",
          content: [
            "Your calendar data is private by default and only shared with others if you explicitly enable collaboration features.",
            "We may disclose your information if required by law, such as in response to a court order or subpoena.",
            "In the event of a merger, acquisition, or sale of assets, your data may be transferred as part of the transaction, with safeguards to maintain your privacy."
          ]
        },
        {
          heading: "6. Your Rights and Choices",
          content: [
            "You can access, update, or delete your account information at any time through your One Calendar account settings.",
            "You can opt out of non-essential communications by adjusting your notification preferences.",
            "If you’re in a region with specific data protection laws (e.g., GDPR or CCPA), you may have additional rights, such as requesting a copy of your data or restricting certain processing. Contact us to exercise these rights."
          ]
        },
        {
          heading: "7. Data Retention",
          content: [
            "We retain your data for as long as your account is active or as needed to provide our services.",
            "If you delete your account, we will remove your personal information and uploaded files within 30 days, except where required to retain data for legal purposes."
          ]
        },
        {
          heading: "8. Children’s Privacy",
          content: [
            "One Calendar is a simple and safe calendar tool designed to be suitable for users of all ages, including children. Parents or guardians can manage accounts for children to ensure appropriate use.",
            "We collect and process personal information from children in the same manner as adults, but we encourage parental supervision to ensure privacy and safety."
          ]
        },
        {
          heading: "9. Changes to This Privacy Policy",
          content: [
            "We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated 'Last updated' date.",
            "We encourage you to review this policy periodically to stay informed about how we protect your data."
          ]
        },
        {
          heading: "10. Contact Us",
          content: [
            "If you have questions or concerns about this Privacy Policy, please contact us at evan.huang000@proton.me or via GitHub.",
            "You can also reach out to provide feedback or report privacy-related issues."
          ]
        }
      ],
      cta: "Have feedback or want to contribute to One Calendar?",
      github: "Visit our GitHub",
      home: "Back to Home"
    },
    zh: {
      title: "One Calendar 隐私政策",
      lastUpdated: "最后更新：2025年5月2日",
      intro: "在 One Calendar，我们重视您的隐私，并致力于保护您的个人信息。本隐私政策说明了您使用我们的服务（包括网站和应用程序）时，我们如何收集、使用、存储和保护您的数据。",
      sections: [
        {
          heading: "1. 我们收集的信息",
          content: [
            "账户信息：当您通过 Clerk 认证（GitHub、Google 或 Microsoft）注册时，我们会收集这些服务提供的电子邮件地址、姓名和个人资料信息，以创建和管理您的账户。",
            "日历数据：您在 One Calendar 中输入的事件、日程和其他相关数据将被存储，以提供我们的日程安排和协作功能。",
            "使用数据：我们会收集您与我们服务交互的信息，例如访问的页面、使用的功能以及设备信息（例如浏览器类型、IP 地址）。",
            "上传的文件：您通过 Vercel Blob 或 Misskey Drive 上传的任何文件仅用于增强您的使用体验",
            "地点数据：我们会请求收集您的地点数据来获取您地区的天气，当然这是可选的，您可以拒绝它，不过天气组件可能不会正常工作。"
          ]
        },
        {
          heading: "2. 我们如何使用您的信息",
          content: [
            "提供和改进我们的服务，包括个性化您的日历体验和启用协作功能。",
            "通过 Clerk 验证您的身份，确保账户安全访问。",
            "分析使用模式，优化平台性能和用户体验。",
            "与您沟通，例如发送服务相关通知或回复您的询问。"
          ]
        },
        {
          heading: "3. 数据存储与安全",
          content: [
            "您的数据通过 Vercel 的基础设施或 Misskey Drive 安全存储，数据在传输和静态时均进行加密。",
            "通过 Vercel Blob 或 Misskey Drive 上传的文件以确保只有您（以及您明确共享的人）可以访问的方式存储。",
            "我们采用行业标准的安全措施，保护您的数据免受未经授权的访问、更改或披露。",
            "虽然我们努力保护您的信息，但没有任何系统是完全安全的，我们无法保证绝对的安全性。"
          ]
        },
        {
          heading: "4. 第三方服务",
          content: [
            "Clerk 认证：我们使用 Clerk 管理用户认证。当您通过 GitHub、Google 或 Microsoft 登录时，Clerk 会处理您的凭据并与我们共享有限的个人资料信息。请参阅 Clerk 的隐私政策以了解详情。",
            "Vercel Blob：您上传的文件通过 Vercel Blob 存储。Vercel 的隐私政策规定了他们对您数据的处理方式。",
            "Misskey Drive：您上传的文件通过 Misskey Drive 存储。Misskey 的隐私政策规定了他们对您数据的处理方式。",
            "Groq: 你的 AI 聊天记录会发送到 Groq 进行 AI 回复。Groq 的隐私政策规定了他们对你的数据的处理方式。",
            "除非为了提供我们的服务或法律要求，我们不会与其他第三方共享您的数据。"
          ]
        },
        {
          heading: "5. 数据共享与披露",
          content: [
            "您的日历数据默认是私密的，只有在您明确启用协作功能时才会与他人共享。",
            "如果法律要求，例如响应法院命令或传票，我们可能会披露您的信息。",
            "如果发生合并、收购或资产出售，您的信息可能会作为交易的一部分转移，我们将采取措施保护您的隐私。"
          ]
        },
        {
          heading: "6. 您的权利与选择",
          content: [
            "您可以随时通过 One Calendar 账户设置访问、更新或删除您的账户信息。",
            "您可以通过调整通知偏好来选择退出非必要通信。",
            "如果您所在地区有特定的数据保护法律（例如 GDPR 或 CCPA），您可能拥有额外权利，例如请求数据副本或限制某些处理。请联系我们以行使这些权利。"
          ]
        },
        {
          heading: "7. 数据保留",
          content: [
            "只要您的账户处于活跃状态或我们需要提供服务，我们就会保留您的数据。",
            "如果您删除账户，我们将在 30 天内删除您的个人信息和上传的文件，除非法律要求保留数据。"
          ]
        },
        {
          heading: "8. 儿童隐私",
          content: [
            "One Calendar 是一个简单且安全的日历工具，适合包括儿童在内的所有年龄段用户。家长或监护人可以管理儿童的账户，以确保适当使用。",
            "我们以与成人相同的方式收集和处理儿童的个人信息，但我们鼓励家长监督以确保隐私和安全。"
          ]
        },
        {
          heading: "9. 本隐私政策的变更",
          content: [
            "我们可能会不时更新本隐私政策。变更将在本页面发布，并更新“最后更新”日期。",
            "我们鼓励您定期查看本政策，以了解我们如何保护您的数据。"
          ]
        },
        {
          heading: "10. 联系我们",
          content: [
            "如果您对本隐私政策有任何疑问或担忧，请通过 evan.huang000@proton.me 或 GitHub 联系我们。",
            "您也可以联系我们提供反馈或报告与隐私相关的问题。"
          ]
        }
      ],
      cta: "有反馈或想为 One Calendar 做贡献？",
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
