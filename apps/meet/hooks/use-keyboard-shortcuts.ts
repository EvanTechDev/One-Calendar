'use client'

import { useEffect } from 'react'
import { useLocalParticipant } from '@livekit/components-react'

/**
 * In-room keyboard shortcuts:
 * - Ctrl/Cmd + Shift + A — toggle microphone
 * - Ctrl/Cmd + Shift + V — toggle camera
 */
export function useKeyboardShortcuts() {
  const { localParticipant } = useLocalParticipant()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey
      if (!modifier || !event.shiftKey) return
      // Holding the shortcut would otherwise fire racing toggle calls.
      if (event.repeat) return
      if (event.code === 'KeyA') {
        event.preventDefault()
        localParticipant
          .setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)
          .catch(() => {})
      } else if (event.code === 'KeyV') {
        event.preventDefault()
        localParticipant
          .setCameraEnabled(!localParticipant.isCameraEnabled)
          .catch(() => {})
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [localParticipant])
}
