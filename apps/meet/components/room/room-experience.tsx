'use client'

import { useCallback, useState } from 'react'
import { PreJoinScreen } from '@/components/room/pre-join-screen'
import { ActiveRoom } from '@/components/room/active-room'
import { getCreatorToken } from '@/lib/creator-token'
import type { ConnectionDetails, RoomPageOptions } from '@/lib/types'
import type { UserChoices } from '@/lib/user-choices'

interface RoomExperienceProps {
  roomName: string
  options: RoomPageOptions
  userName?: string
}

export function RoomExperience({
  roomName,
  options,
  userName,
}: RoomExperienceProps) {
  const [choices, setChoices] = useState<UserChoices>()
  const [connection, setConnection] = useState<ConnectionDetails>()
  const [error, setError] = useState<string>()

  const fetchConnection = useCallback(
    async (userChoices: UserChoices) => {
      const response = await fetch('/api/connection-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          participantName: userChoices.username,
          region: options.region,
          // Presented so the server can confirm guest Organiser authority
          // and mark the token's metadata accordingly (ADR 0016).
          creatorToken: getCreatorToken(roomName),
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to join the meeting')
      }
      return (await response.json()) as ConnectionDetails
    },
    [roomName, options.region],
  )

  const handleJoin = useCallback(
    async (userChoices: UserChoices) => {
      setError(undefined)
      try {
        const details = await fetchConnection(userChoices)
        setChoices(userChoices)
        setConnection(details)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join')
      }
    },
    [fetchConnection],
  )

  /**
   * Rejoining mints a fresh token rather than reusing the old one: join
   * tokens live for five minutes, so a retry after a long drop would fail.
   */
  const handleRetry = useCallback(() => {
    if (!choices) return
    setConnection(undefined)
    handleJoin(choices)
  }, [choices, handleJoin])

  if (!connection || !choices) {
    return (
      <PreJoinScreen
        roomName={roomName}
        defaultUsername={userName}
        error={error}
        onJoin={handleJoin}
      />
    )
  }

  return (
    <ActiveRoom
      connectionDetails={connection}
      userChoices={choices}
      options={options}
      onRetry={handleRetry}
    />
  )
}
