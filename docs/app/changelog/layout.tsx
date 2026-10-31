import type { ReactNode } from 'react'
import { ZentraDocsLayout } from '@/components/docs-layout'

export default function ChangelogLayout({ children }: { children: ReactNode }) {
  return <ZentraDocsLayout>{children}</ZentraDocsLayout>
}
