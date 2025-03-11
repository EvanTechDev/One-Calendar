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
import { translations, useLanguage } from "@/lib/i18n"

export default function AnalyticsGuide() {
  const [open, setOpen] = useState(false)
  const [hasSeenGuide, setHasSeenGuide] = useLocalStorage("has-seen-analytics-guide", true) // 默认设为true，不显示弹窗
  const [language] = useLanguage() // 使用useLanguage替代直接从localStorage读取
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.welcomeToAnalytics}</DialogTitle>
          <DialogDescription>{t.analyticsDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">1. {t.timeAnalytics}</h3>
            <p className="text-sm text-muted-foreground">{t.timeAnalyticsDesc}</p>
          </div>
          <div>
            <h3 className="font-medium">2. {t.importExport}</h3>
            <p className="text-sm text-muted-foreground">{t.importExportDesc}</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleClose}>{t.getStarted}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

