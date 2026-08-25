'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useChat } from '@livekit/components-react'
import type { ReceivedChatMessage } from '@livekit/components-react'
import { toast } from 'sonner'

export interface RoomChat {
  messages: ReceivedChatMessage[]
  send: (message: string) => Promise<boolean>
  /** Messages that arrived while the panel was closed. */
  unread: number
  markRead: () => void
}

interface RoomChatOptions {
  roomName: string
  /**
   * Encrypted rooms never retain chat — the server would only ever see
   * ciphertext, and pretending otherwise would weaken the E2EE promise
   * (ADR 0020).
   */
  retainMessages: boolean
  /**
   * The LiveKit join token, sent with each retained message as proof of room
   * membership. The endpoint reads the sender's identity out of it — a
   * client-supplied identity would be trivially forgeable.
   */
  participantToken: string
  /** Whether the viewer is currently looking at the chat. */
  isOpen: boolean
}

/**
 * Chat for the lifetime of the room, not the panel.
 *
 * `useChat` accumulates messages in its own state, so owning it inside the
 * panel meant closing the panel unmounted the history and discarded anything
 * that arrived while it was shut. That is the reported "message was sent but
 * they never got it": the recipient simply had chat closed.
 */
export function useRoomChat({
  roomName,
  retainMessages,
  participantToken,
  isOpen,
}: RoomChatOptions): RoomChat {
  const { chatMessages, send: sendToRoom } = useChat()
  const [readCount, setReadCount] = useState(0)

  // While the panel is open, everything is read as it arrives.
  useEffect(() => {
    if (isOpen) setReadCount(chatMessages.length)
  }, [isOpen, chatMessages.length])

  // Read through a ref so `send` does not change identity on every message.
  const retain = useRef({ retainMessages, participantToken, roomName })
  retain.current = { retainMessages, participantToken, roomName }

  const send = useCallback(
    async (message: string): Promise<boolean> => {
      try {
        await sendToRoom(message)
      } catch {
        toast.error('Message failed to send')
        return false
      }
      const {
        retainMessages: retaining,
        participantToken: token,
        roomName: room,
      } = retain.current
      if (retaining) {
        // Best-effort: the live message already went through, so a failed
        // retention post must not surface as a send failure.
        void fetch(`/api/meetings/${room}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Identity is derived server-side from this token's claims, so it is
          // deliberately NOT sent alongside it.
          body: JSON.stringify({ message, participantToken: token }),
        }).catch(() => {})
      }
      return true
    },
    [sendToRoom],
  )

  const markRead = useCallback(() => {
    setReadCount(chatMessages.length)
  }, [chatMessages.length])

  return {
    messages: chatMessages,
    send,
    unread: Math.max(0, chatMessages.length - readCount),
    markRead,
  }
}
