"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { MailIcon, CalendarIcon, StarIcon, Share2Icon, Trash2Icon, GithubIcon, InfoIcon } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white py-24 px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">One Calendar</h1>
        <p className="text-lg md:text-2xl mb-6">
          A unified, efficient, and cool calendar experience – managing your time has never been easier.
        </p>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 bg-white text-gray-900">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <FeatureCard
            icon={<CalendarIcon className="w-6 h-6 text-indigo-600" />}
            title="Multi-View Calendar"
            description="View events by day, week, or month, seamlessly switch between them, and take full control of your schedule."
          />
          <FeatureCard
            icon={<StarIcon className="w-6 h-6 text-yellow-500" />}
            title="Bookmark Favorites"
            description="Add bookmarks in one click, keeping your important events front and center."
          />
          <FeatureCard
            icon={<Share2Icon className="w-6 h-6 text-green-500" />}
            title="Easy Sharing"
            description="Share your schedule with your team or friends, making collaboration more efficient."
          />
          <FeatureCard
            icon={<Trash2Icon className="w-6 h-6 text-red-500" />}
            title="Smart Deletion"
            description="Use right-click menus to quickly remove outdated events, no hassle."
          />
        </div>
      </section>

      <Separator />

      {/* Footer */}
      <footer className="bg-gray-100 py-6 px-6 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-gray-600">
          <p>&copy; 2025 One Calendar. All rights reserved.</p>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <a href="/about" className="flex items-center gap-1 hover:underline">
              <InfoIcon className="w-4 h-4" /> About
            </a>
            <a href="https://github.com/Dev-Huang1/One-Calendar" target="_blank" className="flex items-center gap-1 hover:underline">
              <GithubIcon className="w-4 h-4" /> GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Card className="shadow-md hover:shadow-xl transition-all">
      <CardContent className="p-6 space-y-3">
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="text-xl font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-gray-700">{description}</p>
      </CardContent>
    </Card>
  )
}
