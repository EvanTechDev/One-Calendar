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
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="basics">{t.basicFeatures}</TabsTrigger>
            <TabsTrigger value="time-analytics">{t.timeAnalyticsFeatures}</TabsTrigger>
            <TabsTrigger value="schedule-suggestions">{t.scheduleSuggestionsFeatures}</TabsTrigger>
            <TabsTrigger value="mood-tracker">{t.moodTrackerFeatures}</TabsTrigger>
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

          <TabsContent value="time-analytics" className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">{t.howToAccessTimeAnalytics}</h3>
              <p className="text-sm text-muted-foreground">{t.timeAnalyticsDesc}</p>
              <div className="mt-2">
                <h4 className="text-sm font-medium">{t.keyFeatures || "主要功能"}：</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                  <li>{t.timeDistributionFeature || "查看时间分布图表"}</li>
                  <li>{t.productivityAnalysisFeature || "分析高效时段和日期"}</li>
                  <li>{t.customCategoriesFeature || "创建自定义时间分类"}</li>
                  <li>{t.timeUsageTrendsFeature || "查看时间使用趋势"}</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="schedule-suggestions" className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">{t.howToUseSmartSchedule}</h3>
              <p className="text-sm text-muted-foreground">{t.smartScheduleDesc}</p>
              <div className="mt-2">
                <h4 className="text-sm font-medium">{t.keyFeatures || "主要功能"}：</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                  <li>{t.preferenceSettingFeature || "设置工作日和时间偏好"}</li>
                  <li>{t.meetingDurationFeature || "调整会议时长和缓冲时间"}</li>
                  <li>{t.intelligentSuggestionsFeature || "获取智能排序的时间建议"}</li>
                  <li>{t.quickEventCreationFeature || "从建议直接创建事件"}</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mood-tracker" className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">{t.howToUseMoodTracker}</h3>
              <p className="text-sm text-muted-foreground">{t.moodTrackerDesc}</p>
              <div className="mt-2">
                <h4 className="text-sm font-medium">{t.keyFeatures || "主要功能"}：</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                  <li>{t.dailyMoodRecordingFeature || "记录每日心情和备注"}</li>
                  <li>{t.eventAssociationFeature || "关联心情与日历事件"}</li>
                  <li>{t.moodTrendAnalysisFeature || "查看心情趋势图表"}</li>
                  <li>{t.activityImpactFeature || "分析活动对心情的影响"}</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              const tabs = ["basics", "time-analytics", "schedule-suggestions", "mood-tracker"]
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
              const tabs = ["basics", "time-analytics", "schedule-suggestions", "mood-tracker"]
              const currentIndex = tabs.indexOf(activeTab)
              if (currentIndex < tabs.length - 1) {
                setActiveTab(tabs[currentIndex + 1])
              } else {
                handleClose()
              }
            }}
          >
            {activeTab === "mood-tracker" ? t.startUsing : t.nextStep}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

