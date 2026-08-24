'use client'

import { useCallback, useState } from 'react'
import { PreJoinScreen } from '@/components/room/pre-join-screen'
import { ActiveRoom } from '@/components/room/active-room'
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

  const handleJoin = useCallback(
    async (userChoices: UserChoices) => {
      setError(undefined)
      try {
        const response = await fetch('/api/connection-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            participantName: userChoices.username,
            region: options.region,
          }),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error ?? 'Failed to join the meeting')
        }
        const details = (await response.json()) as ConnectionDetails
        setChoices(userChoices)
        setConnection(details)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join')
      }
    },
    [roomName, options.region],
  )

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
    />
  )
}
