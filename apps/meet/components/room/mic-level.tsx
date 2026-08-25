'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@zntr/utils'

const BAR_COUNT = 5

/**
 * A live level meter for the microphone the user is about to join with.
 *
 * Without it, a muted-in-the-OS or wrong-device microphone is undetectable
 * until someone in the meeting says "we can't hear you". Reads the raw stream
 * with an AnalyserNode rather than a LiveKit track, because pre-join has no
 * room yet.
 */
export function MicLevel({
  deviceId,
  enabled,
}: {
  deviceId?: string
  enabled: boolean
}) {
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string>()
  const frame = useRef<number>(0)

  useEffect(() => {
    if (!enabled) {
      setLevel(0)
      setError(undefined)
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null
    let context: AudioContext | null = null

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        setError(undefined)

        context = new AudioContext()
        const source = context.createMediaStreamSource(stream)
        const analyser = context.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)
        const samples = new Uint8Array(analyser.frequencyBinCount)

        const tick = () => {
          analyser.getByteFrequencyData(samples)
          // Mean magnitude is steadier to look at than a peak, which flickers
          // on consonants.
          let sum = 0
          for (const sample of samples) sum += sample
          setLevel(Math.min(1, sum / samples.length / 96))
          frame.current = requestAnimationFrame(tick)
        }
        tick()
      } catch (cause: unknown) {
        if (cancelled) return
        // The camera path already explains its failures; the microphone had no
        // equivalent, so a denied mic was completely silent.
        const name = cause instanceof Error ? cause.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Microphone permission denied'
            : name === 'NotFoundError'
              ? 'No microphone found'
              : 'Microphone unavailable',
        )
      }
    }
    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame.current)
      stream?.getTracks().forEach((track) => track.stop())
      context?.close().catch(() => {})
    }
  }, [deviceId, enabled])

  if (error) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MicOff className="size-3.5" />
        {error}
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2" aria-hidden={!enabled}>
      {enabled ? (
        <Mic className="size-3.5 text-muted-foreground" />
      ) : (
        <MicOff className="size-3.5 text-muted-foreground" />
      )}
      <div className="flex items-end gap-0.5" role="presentation">
        {Array.from({ length: BAR_COUNT }, (_, index) => {
          const lit = enabled && level * BAR_COUNT > index
          return (
            <span
              key={index}
              className={cn(
                'w-1 rounded-sm bg-muted transition-colors',
                lit && 'bg-primary',
              )}
              style={{ height: `${6 + index * 3}px` }}
            />
          )
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {enabled ? 'Speak to test your mic' : 'Microphone off'}
      </span>
    </div>
  )
}
