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
import { Button } from "@/components/ui/button"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="basics">{t.basicFeatures}</TabsTrigger>
            <TabsTrigger value="import-export">{t.importExportFeatures}</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="space-y-8">
            {/* Feature Grid */}
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

            {/* Basic Usage Guide */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t.createEventGuide}</h3>
                <p className="text-sm text-muted-foreground">{t.createEventDesc}</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t.switchViewGuide}</h3>
                <p className="text-sm text-muted-foreground">{t.switchViewDesc}</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t.manageCalendarCategoriesGuide}</h3>
                <p className="text-sm text-muted-foreground">{t.manageCalendarCategoriesDesc}</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t.setReminderGuide}</h3>
                <p className="text-sm text-muted-foreground">{t.setReminderDesc}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="import-export" className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">{t.importExportGuide}</h3>
              <p className="text-sm text-muted-foreground">{t.importExportDesc}</p>
              <div className="mt-2">
                <h4 className="text-sm font-medium">{t.mainFeatures}:</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mt-1">
                  <li>{t.importExportFeaturesList1}</li>
                  <li>{t.importExportFeaturesList2}</li>
                  <li>{t.importExportFeaturesList3}</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              const tabs = ["basics", "import-export"]
              const currentIndex = tabs.indexOf(activeTab)
              if (currentIndex > 0) {
                setActiveTab(tabs[currentIndex - 1])
              }
            }}
            disabled={activeTab === "basics"}
          >
            {t.previousStep}
          </Button>
          <Button
            onClick={() => {
              const tabs = ["basics", "import-export"]
              const currentIndex = tabs.indexOf(activeTab)
              if (currentIndex < tabs.length - 1) {
                setActiveTab(tabs[currentIndex + 1])
              } else {
                handleClose()
              }
            }}
          >
            {activeTab === "import-export" ? t.startUsing : t.nextStep}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
