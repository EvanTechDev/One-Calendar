'use client'

import type { FloatingReaction } from '@/hooks/use-room-signals'

/**
 * Reactions drifting up over the video area. Deliberately non-interactive and
 * pointer-transparent — a reaction must never sit between the user and a
 * control.
 */
export function ReactionOverlay({
  reactions,
}: {
  reactions: FloatingReaction[]
}) {
  if (reactions.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center gap-3 pb-4"
    >
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className="animate-in flex flex-col items-center duration-300 fade-in slide-in-from-bottom-4"
        >
          <span className="text-3xl">{reaction.emoji}</span>
          <span className="max-w-24 truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            {reaction.from}
          </span>
        </div>
      ))}
    </div>
  )
}
