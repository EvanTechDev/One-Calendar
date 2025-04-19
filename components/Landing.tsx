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
    <div className="flex flex-col min-h-screen bg-white text-black">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-24 px-4"> {/* Reduced padding */}
        <h1 className="text-5xl font-bold tracking-tight mb-2">One Calendar</h1> {/* Reduced bottom margin */}
        <p className="text-lg text-gray-600 max-w-xl mb-4"> {/* Reduced bottom margin */}
          All your events in one place, beautifully organized.
        </p>
        <div className="flex gap-4 mb-6"> {/* Reduced bottom margin */}
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
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto py-16 px-6"> {/* Reduced top padding */}
        <Feature icon={<CloudIcon className="h-6 w-6 text-blue-500" />} title="Cloud Sync" description="Access your events from anywhere with secure cloud storage." />
        <Feature icon={<Share2Icon className="h-6 w-6 text-green-500" />} title="Easy Sharing" description="Collaborate and share your schedule with ease." />
        <Feature icon={<BarChart3Icon className="h-6 w-6 text-purple-500" />} title="Analytics" description="Gain insights with smart event tracking and summaries." />
        <Feature icon={<SunIcon className="h-6 w-6 text-yellow-500" />} title="Weather Integration" description="See real-time weather in your calendar view." />
        <Feature icon={<KeyboardIcon className="h-6 w-6 text-red-500" />} title="Keyboard Shortcuts" description="Navigate quickly using customizable shortcuts." />
        <Feature icon={<ImportIcon className="h-6 w-6 text-pink-500" />} title="Import & Export" description="Easily move data in and out of One Calendar." />
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t text-sm text-gray-500 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; 2025 One Calendar. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="/about" className="hover:underline">About</a>
            <a href="https://github.com/Dev-Huang1/One-Calendar" target="_blank" rel="noopener" className="flex items-center gap-1 hover:underline">
              <GithubIcon className="w-4 h-4" /> GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-start p-6 border rounded-2xl shadow-sm bg-white hover:shadow-md transition">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-1">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )
}
