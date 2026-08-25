'use client'

import { useState } from 'react'
import { MeetShell } from '@/components/shell/meet-shell'
import { NewMeetingDialog } from '@/components/dashboard/new-meeting-dialog'
import { HomeSection } from '@/components/dashboard/home-section'
import { UpcomingMeetings } from '@/components/dashboard/upcoming-meetings'
import { useUpcomingMeetings } from '@/hooks/use-upcoming-meetings'
import type { MeetSection } from '@/components/shell/meet-shell'

/**
 * Holds the Shell's client state around the dashboard's server-rendered
 * sections.
 *
 * The data-dependent sections arrive as props rather than being fetched here so
 * `Dashboard` stays an async Server Component doing its DB reads (ADR 0020's
 * dashboard scope). All sections are mounted at once and switched with
 * `hidden`, so moving between them never re-suspends work the server already
 * did.
 *
 * Home is composed here instead: it needs the same client state the sidebar
 * does (open the New meeting dialog, jump to another section) and reads the
 * upcoming list from the one fetch this component owns, so home's "next
 * meeting" and the Upcoming list cannot disagree.
 */
export function DashboardShell({
  calendarOrigin,
  userName,
  recentPreview,
  history,
  identity,
}: {
  calendarOrigin: string
  userName?: string
  recentPreview: React.ReactNode
  history: React.ReactNode
  identity?: React.ReactNode
}) {
  const [section, setSection] = useState<MeetSection>('home')
  const [newMeetingOpen, setNewMeetingOpen] = useState(false)
  const upcoming = useUpcomingMeetings(calendarOrigin)

  return (
    <>
      <MeetShell
        section={section}
        onSectionChange={setSection}
        onNewMeeting={() => setNewMeetingOpen(true)}
        identity={identity}
      >
        <div hidden={section !== 'home'}>
          <HomeSection
            userName={userName}
            upcoming={upcoming}
            recentPreview={recentPreview}
            onNewMeeting={() => setNewMeetingOpen(true)}
            onSectionChange={setSection}
          />
        </div>
        <div hidden={section !== 'upcoming'}>
          <Section title="Next 7 days">
            <UpcomingMeetings {...upcoming} />
          </Section>
        </div>
        <div hidden={section !== 'history'}>{history}</div>
      </MeetShell>
      <NewMeetingDialog
        open={newMeetingOpen}
        onOpenChange={setNewMeetingOpen}
      />
    </>
  )
}

/**
 * One section of the Shell's main column. The `h-16` header already names the
 * active section, so this heading is the section's own sub-structure.
 */
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4 p-4 sm:p-6">
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}
