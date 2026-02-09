"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Language } from "@/lib/i18n"

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown"
const COMMIT_HASH = process.env.NEXT_PUBLIC_GIT_COMMIT ?? "unknown"
const DEPLOYED_AT = process.env.NEXT_PUBLIC_BUILD_TIME ?? ""

const formatTimeAgo = (language: Language, deployedAt: string) => {
  const deployedDate = new Date(deployedAt)
  if (Number.isNaN(deployedDate.getTime())) {
    return language === "zh-CN" ? "未知" : "Unknown"
  }

  const diffMs = Date.now() - deployedDate.getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000))

  if (diffMinutes < 60) {
    return language === "zh-CN" ? `${diffMinutes} 分钟` : `${diffMinutes} minutes`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return language === "zh-CN" ? `${diffHours} 小时` : `${diffHours} hours`
  }

  const diffDays = Math.floor(diffHours / 24)
  return language === "zh-CN" ? `${diffDays} 天` : `${diffDays} days`
}

interface BuildInfoCardProps {
  language: Language
}

export default function BuildInfoCard({ language }: BuildInfoCardProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((value) => value + 1)
    }, 60000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const deployedAgo = useMemo(() => formatTimeAgo(language, DEPLOYED_AT), [language, tick])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === "zh-CN" ? "版本信息" : "Build Information"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{language === "zh-CN" ? "版本号" : "Version"}</span>
          <span className="font-mono">{APP_VERSION}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{language === "zh-CN" ? "提交号" : "Commit"}</span>
          <span className="font-mono">{COMMIT_HASH}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{language === "zh-CN" ? "部署时间" : "Deployment"}</span>
          <span>{language === "zh-CN" ? `${deployedAgo}前部署` : `Deployed ${deployedAgo} ago`}</span>
        </div>
      </CardContent>
    </Card>
  )
}
