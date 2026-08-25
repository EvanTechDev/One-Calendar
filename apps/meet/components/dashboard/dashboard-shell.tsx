'use client'

import { useState } from 'react'
import { MeetShell } from '@/components/shell/meet-shell'
import { useStartMeeting } from '@/hooks/use-start-meeting'
import type { MeetSection } from '@/components/shell/meet-shell'

/**
 * Holds the Shell's client state around the dashboard's server-rendered
 * sections.
 *
 * The sections arrive as props rather than being fetched here so `Dashboard`
 * stays an async Server Component doing its DB reads (ADR 0020's dashboard
 * scope). All three are mounted at once and switched with `hidden`, so moving
 * between them never re-suspends work the server already did.
 */
export function DashboardShell({
  home,
  upcoming,
  history,
  identity,
}: {
  home: React.ReactNode
  upcoming: React.ReactNode
  history: React.ReactNode
  identity?: React.ReactNode
}) {
  const [section, setSection] = useState<MeetSection>('home')
  const { start, starting } = useStartMeeting()

  return (
    <MeetShell
      section={section}
      onSectionChange={setSection}
      onNewMeeting={() => start()}
      newMeetingPending={starting}
      identity={identity}
    >
      <div hidden={section !== 'home'}>{home}</div>
      <div hidden={section !== 'upcoming'}>{upcoming}</div>
      <div hidden={section !== 'history'}>{history}</div>
    </MeetShell>
  )
}
