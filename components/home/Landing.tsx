"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { GithubIcon, CloudIcon, Share2Icon, BarChart3Icon, SunIcon, KeyboardIcon, ImportIcon } from "lucide-react"
import Image from "next/image"

export default function LandingPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useUser()
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    const hasSkippedLanding = localStorage.getItem("skip-landing") === "true"
    if (hasSkippedLanding || (isLoaded && isSignedIn)) {
      router.replace("/app")
    } else if (isLoaded) {
      setShouldRender(true)
    }
  }, [isLoaded, isSignedIn, router])

  const handleGetStarted = () => {
    localStorage.setItem("skip-landing", "true")
    router.push("/app")
  }

  if (!shouldRender) return null

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <div className="fixed -z-10 inset-0 overflow-hidden">
        <div className="absolute left-0 bottom-0 h-[300px] w-[300px] rounded-full bg-blue-400 opacity-20 blur-[80px]" />
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-purple-400 opacity-25 blur-[100px]" />
        <div className="absolute right-1/4 bottom-1/3 h-[250px] w-[250px] rounded-full bg-indigo-400 opacity-20 blur-[90px]" />
      </div>
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-24 px-4">
        <h1 className="text-5xl font-bold tracking-tight mb-2">One Calendar</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl mb-4">
          All your events in one place, beautifully organized.
        </p>
        <div className="flex gap-4 mb-6">
          <Button onClick={handleGetStarted} className="px-6">Get Started</Button>
          <Button variant="outline" onClick={() => router.push("/sign-in")} className="px-6">Login</Button>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-lg max-w-3xl w-full">
          <Image
            src="/Banner.jpg"
            alt="One Calendar Preview"
            layout="responsive"
            objectFit="cover"
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto py-16 px-6">
        <Feature icon={<CloudIcon className="h-6 w-6 text-blue-500" />} title="Cloud Sync" description="Access your events from anywhere with secure cloud storage." />
        <Feature icon={<Share2Icon className="h-6 w-6 text-green-500" />} title="Easy Sharing" description="Collaborate and share your schedule with ease." />
        <Feature icon={<BarChart3Icon className="h-6 w-6 text-purple-500" />} title="Analytics" description="Gain insights with smart event tracking and summaries." />
        <Feature icon={<SunIcon className="h-6 w-6 text-yellow-500" />} title="Weather Integration" description="See real-time weather in your calendar view." />
        <Feature icon={<KeyboardIcon className="h-6 w-6 text-red-500" />} title="Keyboard Shortcuts" description="Navigate quickly using customizable shortcuts." />
        <Feature icon={<ImportIcon className="h-6 w-6 text-pink-500" />} title="Import & Export" description="Easily move data in and out of One Calendar." />
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; 2025 One Calendar. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="/about" className="hover:underline">About</a>
            <a href="/privacy" className="hover:underline">Privacy</a>
            <a href="/terms" className="hover:underline">Terms</a>
            <a href="https://github.com/Dev-Huang1/One-Calendar" target="_blank" rel="noopener" className="flex items-center gap-1 hover:underline">
              <GithubIcon className="w-4 h-4" />
            </a>
            <a href="https://x.com/One__Cal" target="_blank" className="flex items-center gap-1 hover:underline">
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="16" height="16" viewBox="0 0 32 32">
                <path d="M 4.0175781 4 L 13.091797 17.609375 L 4.3359375 28 L 6.9511719 28 L 14.246094 19.34375 L 20.017578 28 L 20.552734 28 L 28.015625 28 L 18.712891 14.042969 L 27.175781 4 L 24.560547 4 L 17.558594 12.310547 L 12.017578 4 L 4.0175781 4 z M 7.7558594 6 L 10.947266 6 L 24.279297 26 L 21.087891 26 L 7.7558594 6 z"></path>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-start p-6 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-1">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300 text-sm">{description}</p>
    </div>
  )
}
