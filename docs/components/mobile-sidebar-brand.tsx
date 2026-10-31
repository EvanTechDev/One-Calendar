'use client'

import Link from 'next/link'
import { useSidebar } from 'fumadocs-ui/layouts/docs/slots/sidebar'

export function MobileSidebarBrand() {
  const { setOpen } = useSidebar()

  return (
    <Link
      href="/docs"
      className="docs-mobile-brand"
      onClick={() => setOpen(false)}
    >
      <img src="/logo-light.svg" alt="" className="size-7 dark:hidden" />
      <img src="/logo-dark.svg" alt="" className="hidden size-7 dark:block" />
      <span>Zentra</span>
      <span className="docs-wordmark">Docs</span>
    </Link>
  )
}
