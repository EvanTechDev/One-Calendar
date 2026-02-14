"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { translations, type Language } from "@/lib/i18n"
import { useEffect, useMemo, useState } from "react"

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown"
const COMMIT_HASH = process.env.NEXT_PUBLIC_GIT_COMMIT ?? "unknown"
const DEPLOYED_AT = process.env.NEXT_PUBLIC_BUILD_TIME ?? ""

const formatTimeAgo = (language: Language, deployedAt: string) => {
  const t = translations[language]
  const deployedDate = new Date(deployedAt)
  if (Number.isNaN(deployedDate.getTime())) {
    return t.buildInfoUnknown
  }

  const diffMs = Date.now() - deployedDate.getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000))

  if (diffMinutes < 60) {
    return `${diffMinutes} ${t.buildInfoMinutes}`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} ${t.buildInfoHours}`
  }

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} ${t.buildInfoDays}`
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

  const t = translations[language]
  const deployedAgo = useMemo(() => formatTimeAgo(language, DEPLOYED_AT), [language, tick])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.buildInfoTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{t.buildInfoVersion}</span>
          <span className="font-mono">{APP_VERSION}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{t.buildInfoCommit}</span>
          <span className="font-mono">{COMMIT_HASH}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{t.buildInfoDeployment}</span>
          <span>{t.buildInfoDeployedAgo.replace("{time}", deployedAgo)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
