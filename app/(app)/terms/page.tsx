"use client"

import Link from "next/link"
import { GithubIcon } from "lucide-react"
import { translations, useLanguage } from "@/lib/i18n"

export default function TermsOfService() {
  const [language] = useLanguage()
  const t = translations[language]

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
        <h1 className="text-4xl font-bold text-center mb-12">{t.termsTitle}</h1>
        <p className="text-sm text-gray-500 text-center mb-8 dark:text-white">{t.termsLastUpdated}</p>
        <div className="space-y-8 text-left">
          <p className="text-lg text-gray-700 leading-relaxed dark:text-white">{t.termsIntro}</p>
          {t.termsSections.map((section, i) => (
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
          <h2 className="text-xl font-medium">{t.termsCta}</h2>
          <div className="flex justify-center gap-4 pt-4">
            <Link
              href="https://github.com/Dev-Huang1/One-Calendar"
              target="_blank"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <GithubIcon className="w-4 h-4" />
              {t.termsGithub}
            </Link>
            <Link href="/" className="text-sm text-gray-500 underline hover:text-black dark:text-white">
              {t.termsHome}
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
