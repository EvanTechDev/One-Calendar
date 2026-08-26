'use client'

import { useState } from 'react'
import { PortalShell } from '@/components/shell/portal-shell'
import {
  DevicesSection,
  OverviewSection,
  ProfileSection,
  SecuritySection,
} from '@/components/account/account-sections'
import { PortalIdentity } from '@/components/account/portal-identity'
import type { PortalSection } from '@/components/shell/portal-shell'
import type { PortalUser } from '@/components/account/account-sections'

/**
 * The portal's dashboard.
 *
 * Sections are mounted and hidden rather than swapped, matching meet's
 * dashboard: switching section is client state, and re-mounting would refetch
 * the session list every time a user glanced at Profile.
 */
export function AccountDashboard({ user }: { user: PortalUser }) {
  const [section, setSection] = useState<PortalSection>('overview')

  return (
    <PortalShell
      section={section}
      onSectionChange={setSection}
      identity={<PortalIdentity user={user} />}
    >
      <div hidden={section !== 'overview'}>
        <OverviewSection user={user} />
      </div>
      <div hidden={section !== 'profile'}>
        <ProfileSection user={user} />
      </div>
      <div hidden={section !== 'security'}>
        <SecuritySection user={user} />
      </div>
      {/* Mounted only when opened: it fetches sessions and grants, and doing
          that on every dashboard load would cost two requests nobody asked
          for. */}
      {section === 'apps' ? <DevicesSection /> : null}
      <div hidden={section !== 'about'}>
        <AboutSection />
      </div>
    </PortalShell>
  )
}

function AboutSection() {
  return (
    <section className="space-y-4 p-4 sm:p-6">
      <div className="space-y-1">
        <h2 className="font-heading text-base font-semibold">About</h2>
        <p className="text-sm text-muted-foreground">
          Zentra Account is the single sign-in for Zentra Calendar and Zentra
          Meet. Your name, email, password, and two-factor settings live here
          and apply everywhere.
        </p>
      </div>
    </section>
  )
}
