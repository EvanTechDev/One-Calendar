'use client'

import { translations, type Language } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { useEffect, useMemo, useState } from 'react'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown'
const COMMIT_HASH = process.env.NEXT_PUBLIC_GIT_COMMIT ?? 'unknown'
const DEPLOYED_AT = process.env.NEXT_PUBLIC_BUILD_TIME ?? ''

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
  const [updateRegistration, setUpdateRegistration] =
    useState<ServiceWorkerRegistration | null>(null)
  const [hasUpdate, setHasUpdate] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [hasCloudUpdate, setHasCloudUpdate] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((value) => value + 1)
    }, 60000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const checkForUpdate = (registration: ServiceWorkerRegistration) => {
      setUpdateRegistration(registration)
      setHasUpdate(Boolean(registration.waiting))
    }

    const handleControllerChange = () => {
      window.location.reload()
    }

    const initializeServiceWorkerUpdate = async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) return

      checkForUpdate(registration)

      const handleUpdateFound = () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            setHasUpdate(true)
          }
        })
      }

      registration.addEventListener('updatefound', handleUpdateFound)
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        handleControllerChange,
      )

      return () => {
        registration.removeEventListener('updatefound', handleUpdateFound)
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          handleControllerChange,
        )
      }
    }

    const cleanupPromise = initializeServiceWorkerUpdate()

    return () => {
      cleanupPromise.then((cleanup) => cleanup?.()).catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    const checkCloudBuildInfo = async () => {
      try {
        const response = await fetch(`/api/build-info?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!response.ok) return

        const nextBuild = (await response.json()) as {
          version?: string
          commit?: string
          deployedAt?: string
        }

        const changedByCommit =
          Boolean(nextBuild.commit) && nextBuild.commit !== COMMIT_HASH
        const changedByDeployTime =
          Boolean(nextBuild.deployedAt) && nextBuild.deployedAt !== DEPLOYED_AT
        const changedByVersion =
          Boolean(nextBuild.version) && nextBuild.version !== APP_VERSION

        setHasCloudUpdate(
          changedByCommit || changedByDeployTime || changedByVersion,
        )
      } catch {
        // Ignore transient network errors to keep the card non-blocking.
      }
    }

    void checkCloudBuildInfo()
    const timer = window.setInterval(() => {
      void checkCloudBuildInfo()
    }, 120000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const t = translations[language]
  const deployedAgo = useMemo(
    () => formatTimeAgo(language, DEPLOYED_AT),
    [language, tick],
  )

  const handleUpdateStatic = async () => {
    if ((!updateRegistration && !hasCloudUpdate) || isUpdating) return

    setIsUpdating(true)
    try {
      if (updateRegistration) {
        await updateRegistration.update()
      }
      const waitingWorker = updateRegistration?.waiting
      if (waitingWorker) {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' })
        return
      }

      if (hasCloudUpdate && 'caches' in window) {
        const cacheKeys = await caches.keys()
        await Promise.all(
          cacheKeys
            .filter((key) => key.startsWith('one-calendar-shell-'))
            .map((key) => caches.delete(key)),
        )
      }

      window.location.reload()
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h2 className="text-base font-semibold">{t.buildInfoTitle}</h2>
      <div className="space-y-3 text-sm">
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
          <span>{t.buildInfoDeployedAgo.replace('{time}', deployedAgo)}</span>
        </div>
        {hasUpdate || hasCloudUpdate ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">
              {t.buildInfoUpdateAvailable}
            </span>
            <Button
              size="sm"
              onClick={handleUpdateStatic}
              disabled={isUpdating}
            >
              {isUpdating ? t.buildInfoUpdating : t.buildInfoUpdateButton}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
