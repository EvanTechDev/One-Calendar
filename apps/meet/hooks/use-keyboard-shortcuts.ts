'use client'

import { useEffect } from 'react'
import { useLocalParticipant } from '@livekit/components-react'

export interface RoomShortcutHandlers {
  onToggleChat?: () => void
  onTogglePeople?: () => void
  onToggleHand?: () => void
}

/**
 * In-room keyboard shortcuts, matching Google Meet's bindings:
 *
 * - Ctrl/Cmd + Shift + A — toggle microphone
 * - Ctrl/Cmd + Shift + V — toggle camera
 * - Ctrl/Cmd + Alt + H — raise or lower hand
 * - Ctrl/Cmd + Alt + P — people panel
 * - Ctrl/Cmd + Alt + C — chat panel
 */
export function useKeyboardShortcuts(handlers: RoomShortcutHandlers = {}) {
  const { localParticipant } = useLocalParticipant()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey
      if (!modifier) return
      // Holding a shortcut would otherwise fire racing toggle calls.
      if (event.repeat) return

      // Never steal a keystroke from the chat composer or any other field.
      const target = event.target as HTMLElement | null
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA'
      ) {
        return
      }

      if (event.shiftKey) {
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
        return
      }

      if (event.altKey) {
        if (event.code === 'KeyH' && handlers.onToggleHand) {
          event.preventDefault()
          handlers.onToggleHand()
        } else if (event.code === 'KeyP' && handlers.onTogglePeople) {
          event.preventDefault()
          handlers.onTogglePeople()
        } else if (event.code === 'KeyC' && handlers.onToggleChat) {
          event.preventDefault()
          handlers.onToggleChat()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [localParticipant, handlers])
}
