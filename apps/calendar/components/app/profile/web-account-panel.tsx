'use client'

import { AccountPanel, type AccountSection } from '@zntr/auth/account'
import { AccountHost } from './account-host'

export default function WebAccountPanel({
  section,
  embedded = false,
}: {
  section?: string | null
  embedded?: boolean
}) {
  return (
    <AccountHost embedded={embedded}>
      <AccountPanel focusSection={section as AccountSection | null} />
    </AccountHost>
  )
}
