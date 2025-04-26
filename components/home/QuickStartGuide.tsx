"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { translations } from "@/lib/i18n"
import { useLanguage } from "@/hooks/useLanguage"
import {
  CloudIcon,
  Share2Icon,
  BarChart3Icon,
  SunIcon,
  KeyboardIcon,
  ImportIcon,
} from "lucide-react"

export default function QuickStartGuide() {
  const [open, setOpen] = useState(false)
  const [hasSeenGuide, setHasSeenGuide] = useLocalStorage("has-seen-quick-start-guide", true)
  const [activeTab, setActiveTab] = useState("basics")
  const [language] = useLanguage()
  const t = translations[language]

  useEffect(() => {
    if (!hasSeenGuide) {
      setOpen(true)
    }
  }, [hasSeenGuide])

  const handleClose = () => {
    setOpen(false)
    setHasSeenGuide(true)
  }

  const Feature = ({
    icon,
    title,
    description,
  }: {
    icon: React.ReactNode
    title: string
    description: string
  }) => (
    <div className="flex flex-col items-start p-6 border rounded-2xl shadow-sm bg-white hover:shadow-md transition">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-1">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t.welcomeToOneCalendar}</DialogTitle>
          <DialogDescription>{t.powerfulCalendarApp}</DialogDescription>
        </DialogHeader>


            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Feature
                icon={<CloudIcon className="h-6 w-6 text-blue-500" />}
                title="Cloud Sync"
                description="Access your events from anywhere with secure cloud storage."
              />
              <Feature
                icon={<Share2Icon className="h-6 w-6 text-green-500" />}
                title="Easy Sharing"
                description="Collaborate and share your schedule with ease."
              />
              <Feature
                icon={<BarChart3Icon className="h-6 w-6 text-purple-500" />}
                title="Analytics"
                description="Gain insights with smart event tracking and summaries."
              />
              <Feature
                icon={<SunIcon className="h-6 w-6 text-yellow-500" />}
                title="Weather Integration"
                description="See real-time weather in your calendar view."
              />
              <Feature
                icon={<KeyboardIcon className="h-6 w-6 text-red-500" />}
                title="Keyboard Shortcuts"
                description="Navigate quickly using customizable shortcuts."
              />
              <Feature
                icon={<ImportIcon className="h-6 w-6 text-pink-500" />}
                title="Import & Export"
                description="Easily move data in and out of One Calendar."
              />
            </section>

      </DialogContent>
    </Dialog>
  )
}
