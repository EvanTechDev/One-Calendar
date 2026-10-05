import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { site } from './site'
import Link from 'next/link'
import { BookOpen, CodeXml, MessageCircle } from 'lucide-react'
import { DocsSearch } from '@/components/docs-toolbar'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      enabled: false,
      url: '/docs',
      title: (
        <>
          <img src="/logo-light.svg" alt="" className="size-7 dark:hidden" />
          <img
            src="/logo-dark.svg"
            alt=""
            className="hidden size-7 dark:block"
          />
          <span className="docs-wordmark">
            <span className="sr-only">Zentra </span>Docs
          </span>
        </>
      ),
      children: <DocsSearch />,
    },
    searchToggle: { enabled: false },
    themeSwitch: { enabled: false },
  }
}

export function SidebarResources() {
  return (
    <nav className="docs-resources" aria-label="Resources">
      <Link href="/docs">
        <BookOpen aria-hidden />
        Docs
      </Link>
      <a href={site.repository}>
        <CodeXml aria-hidden />
        GitHub
      </a>
      <a href={`${site.repository}/issues`}>
        <MessageCircle aria-hidden />
        Report an issue
      </a>
    </nav>
  )
}
