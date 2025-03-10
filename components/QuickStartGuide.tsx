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
import { translations, type Language } from "@/lib/i18n"

export default function QuickStartGuide() {
  const [open, setOpen] = useState(false)
  const [hasSeenGuide, setHasSeenGuide] = useLocalStorage("has-seen-quick-start-guide", false)
  const [activeTab, setActiveTab] = useState("basics")
  const [language] = useLocalStorage<Language>("preferred-language", "zh")
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t.welcomeToOneCalendar}</DialogTitle>
          <DialogDescription>{t.powerfulCalendarApp}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="basics">{t.basicFeatures}</TabsTrigger>
            <TabsTrigger value="import-export">{t.importExportFeatures}</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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

