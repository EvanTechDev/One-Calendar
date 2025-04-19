"use client"

import { useEffect, useState } from "react"
import { GithubIcon } from "lucide-react"
import Link from "next/link"

export default function AboutPage() {
  const [lang, setLang] = useState<"en" | "zh">("en")

  useEffect(() => {
    const userLang = navigator.language
    if (userLang.startsWith("zh")) {
      setLang("zh")
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <header className="text-center py-20 px-6">
        <h1 className="text-4xl font-bold mb-4">
          {lang === "zh" ? "关于 One Calendar" : "About One Calendar"}
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          {lang === "zh"
            ? "一个重新定义日程管理体验的日历应用。"
            : "A calendar app reimagining how you manage your time."}
        </p>
      </header>

      <section className="max-w-3xl mx-auto text-center px-6 py-24">
        {lang === "zh" ? (
          <>
            <h2 className="text-3xl font-semibold mb-6">
              我们正在重新定义日历的未来，欢迎你加入我们的旅程。
            </h2>
            <p className="text-lg text-gray-600 mb-4">
              日历几十年来几乎没有改变，但我们的生活早已今非昔比。传统日历繁琐、杂乱，不再适应现代的节奏与协作方式。
            </p>
            <p className="text-lg text-gray-600 mb-4">
              One Calendar 是一个全新的开始：简洁、美观、流畅，并为真实生活而设计。不论你是管理工作会议、与家人共享活动，还是记录生活中的小确幸，我们都为你考虑到了。
            </p>
            <p className="text-lg text-gray-600 mb-4">
              我们的使命很明确：帮你高效管理时间，而不是制造更多干扰。我们正在打造一个你真正想用的日历工具，而这仅仅是开始。
            </p>
            <p className="text-lg text-gray-700 font-medium mt-8">
              欢迎使用 One Calendar，和我们一起让时间变得更有序、更轻松。
            </p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-semibold mb-6">
              We’re rethinking the way you organize time — and we’d love for you to be part of it.
            </h2>
            <p className="text-lg text-gray-600 mb-4">
              Calendars haven't kept up with the pace of our lives. They're cluttered, hard to manage, and often disconnected from how we actually plan our days.
            </p>
            <p className="text-lg text-gray-600 mb-4">
              One Calendar is a fresh take on personal scheduling — minimalist, fast, collaborative, and designed with real-life routines in mind. Whether you're managing meetings, sharing events with your team, or just trying to keep track of birthdays, we've got you covered.
            </p>
            <p className="text-lg text-gray-600 mb-4">
              Our mission is simple: help you stay organized without adding more noise. We’re building a calendar you’ll actually enjoy using — and we’re just getting started.
            </p>
            <p className="text-lg text-gray-700 font-medium mt-8">
              Welcome to One Calendar. Let’s make time work better for you.
            </p>
          </>
        )}
      </section>

      <section className="text-center py-12 px-6 bg-gray-100">
        <h2 className="text-2xl font-semibold mb-2">
          {lang === "zh" ? "想参与项目或联系我们？" : "Want to contribute or get in touch?"}
        </h2>
        <p className="text-gray-600 mb-4">
          {lang === "zh"
            ? "欢迎访问我们的 GitHub 项目或发送反馈意见。"
            : "Check out the project on GitHub or send us feedback."}
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="https://github.com/Dev-Huang1/One-Calendar"
            target="_blank"
            className="flex items-center gap-2 text-blue-600 hover:underline"
          >
            <GithubIcon className="w-4 h-4" />
            GitHub
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-500 underline hover:text-black"
          >
            {lang === "zh" ? "返回首页" : "Back to Home"}
          </Link>
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
