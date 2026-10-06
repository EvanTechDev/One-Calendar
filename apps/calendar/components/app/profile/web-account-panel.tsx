'use client'

import { AccountPanel, type AccountSection } from '@zntr/auth/account'
import { AccountHost } from './account-host'

export default function WebAccountPanel({
  section,
}: {
  section?: string | null
}) {
  return (
    <AccountHost>
      <AccountPanel focusSection={section as AccountSection | null} />
    </AccountHost>
  )
}
