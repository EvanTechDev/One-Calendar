"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { GithubIcon } from "lucide-react"
import Image from "next/image"

export default function LandingPage() {
  const router = useRouter()
  const { isSignedIn } = useUser()

  useEffect(() => {
    const hasSkippedLanding = localStorage.getItem("skip-landing") === "true"
    if (hasSkippedLanding || isSignedIn) {
      router.replace("/app")
    }
  }, [isSignedIn, router])

  const handleGetStarted = () => {
    localStorage.setItem("skip-landing", "true")
    router.push("/app")
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-32 px-4">
        <h1 className="text-5xl font-bold tracking-tight mb-4">One Calendar</h1>
        <p className="text-lg text-gray-600 max-w-xl mb-6">
          All your events in one place, beautifully organized.
        </p>
        <div className="flex gap-4 mb-8">
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
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto py-20 px-6">
        <Feature title="Unified View" description="Combine all your calendars seamlessly in one place." />
        <Feature title="Smart Reminders" description="Get intelligent notifications so you never miss what's important." />
        <Feature title="Effortless Sharing" description="Share your schedule with friends and teams in one click." />
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

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )
}
