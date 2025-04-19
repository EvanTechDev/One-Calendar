"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { GithubIcon } from "lucide-react"

export default function AboutPage() {
  const [lang, setLang] = useState<"en" | "zh">("en")

  useEffect(() => {
    if (navigator.language.startsWith("zh")) {
      setLang("zh")
    }
  }, [])

  const content = {
    en: {
      title: "About One Calendar",
      heading: "One Calendar is designed for the way people actually plan.",
      paragraphs: [
        "Time management shouldn't feel like a chore. That's why we built One Calendar — a clean, simple, and powerful calendar that adapts to your life.",
        "We believe great tools should get out of your way. No clutter, no friction — just a fast, intuitive experience that helps you stay focused and in control.",
        "From personal planning to team collaboration, One Calendar gives you the features you need without the complexity you don’t.",
        "We’re excited to build a better future for time — and we’d love to have you along for the journey."
      ],
      contact: "Want to contribute or get in touch?",
      cta: "Check out the project on GitHub or send us feedback.",
      home: "Back to Home",
    },
    zh: {
      title: "关于 One Calendar",
      heading: "我们正在打造一个真正符合现代节奏的日历工具。",
      paragraphs: [
        "管理时间不该是一件麻烦事。One Calendar 致力于打造一个干净、简单而强大的日历，真正贴合你的生活节奏。",
        "我们相信，优秀的工具应该“隐形”——不打扰、不复杂，只带来快速流畅的体验，帮助你专注当下、掌握全局。",
        "无论是个人安排，还是团队协作，One Calendar 都提供恰到好处的功能，而不会堆砌无用选项。",
        "我们正在重新构想时间的未来，期待你一同加入这段旅程。"
      ],
      contact: "想参与项目或联系我们？",
      cta: "欢迎访问我们的 GitHub 项目或发送反馈。",
      home: "返回首页",
    },
  }

  const t = content[lang]

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <main className="max-w-3xl mx-auto px-6 py-24">
        <div className="fixed -z-10 inset-0 overflow-hidden">
          <div className="absolute left-0 bottom-0 h-[300px] w-[300px] rounded-full bg-blue-400 opacity-20 blur-[80px]" />
          <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-purple-400 opacity-25 blur-[100px]" />
          <div className="absolute right-1/4 bottom-1/3 h-[250px] w-[250px] rounded-full bg-indigo-400 opacity-20 blur-[90px]" />
        </div>
        <h1 className="text-4xl font-bold text-center mb-12">{t.title}</h1>
        <div className="space-y-5 text-left">
          <h2 className="text-2xl font-semibold">{t.heading}</h2>
          {t.paragraphs.map((p, i) => (
            <p key={i} className="text-lg text-gray-700 leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </main>

      <section className="text-center px-6 py-16 bg-gray-100">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-xl font-medium">{t.contact}</h2>
          <p className="text-gray-600">{t.cta}</p>
          <div className="flex justify-center gap-4 pt-4">
            <Link
              href="https://github.com/Dev-Huang1/One-Calendar"
              target="_blank"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <GithubIcon className="w-4 h-4" />
              GitHub
            </Link>
            <Link href="/" className="text-sm text-gray-500 underline hover:text-black">
              {t.home}
            </Link>
          </div>
        </div>
      </section>

      <footer className="mt-auto py-8 border-t text-sm text-gray-500 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; 2025 One Calendar. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:underline">
              {lang === "zh" ? "首页" : "Home"}
            </Link>
            <Link
              href="https://github.com/Dev-Huang1/One-Calendar"
              target="_blank"
              className="flex items-center gap-1 hover:underline"
            >
              <GithubIcon className="w-4 h-4" /> GitHub
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
