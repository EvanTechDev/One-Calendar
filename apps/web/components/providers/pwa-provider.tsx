'use client'

import { useEffect } from 'react'

export function PwaProvider() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const clearCaches = async () => {
      if (!('caches' in window)) return
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        await clearCaches()

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          if (!worker) return

          worker.addEventListener('statechange', () => {
            if (
              worker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              worker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload()
        })

        const updateTimer = window.setInterval(() => {
          registration.update().catch(() => undefined)
        }, 60 * 1000)

        return () => {
          window.clearInterval(updateTimer)
        }
      } catch {
        return undefined
      }
    }

    let cleanup: (() => void) | undefined

    registerServiceWorker().then((fn) => {
      cleanup = fn
    })

    return () => {
      cleanup?.()
    }
  }, [])

  return null
}
