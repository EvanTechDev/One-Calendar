'use client'

import { useEffect, useRef } from 'react'
import { useIsRecording } from '@livekit/components-react'
import { toast } from 'sonner'

/**
 * Shows a persistent banner while the meeting is being recorded
 * (server-side egress) and a toast when recording starts.
 */
export function RecordingBanner() {
  const isRecording = useIsRecording()
  const wasRecording = useRef(false)

  useEffect(() => {
    if (isRecording && !wasRecording.current) {
      toast.info('This meeting is being recorded')
    }
    wasRecording.current = isRecording
  }, [isRecording])

  if (!isRecording) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-destructive px-4 py-1.5 text-xs font-medium text-white">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-white" />
      </span>
      Recording in progress
    </div>
  )
}
