'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { SidebarTrigger } from 'fumadocs-ui/layouts/docs/slots/sidebar'
import { SearchTrigger } from 'fumadocs-ui/layouts/shared/slots/search-trigger'
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch'
import { PageActions } from './ai/page-actions'
import { site } from '@/lib/site'

export function DocsSearch() {
  return <SearchTrigger className="docs-search" aria-label="Search docs" />
}

export function DocsToolbar({
  title,
  section,
  sectionUrl,
  pageUrl,
  githubUrl,
}: {
  title: string
  section: string
  sectionUrl: string
  pageUrl: string
  githubUrl: string
}) {
  const home = pageUrl === '/docs'

  return (
    <header className="docs-toolbar">
      <SidebarTrigger className="docs-menu" aria-label="Open navigation">
        <Menu size={20} aria-hidden />
      </SidebarTrigger>
      <nav aria-label="Breadcrumb" className="docs-breadcrumb">
        {!home && sectionUrl !== pageUrl && (
          <>
            <Link href={sectionUrl}>{section}</Link>
            <span aria-hidden>/</span>
          </>
        )}
        <span aria-current="page">{home ? 'Home' : title}</span>
      </nav>
      <div className="docs-toolbar-actions">
        <div className="docs-mobile-search">
          <DocsSearch />
        </div>
        <ThemeSwitch mode="light-dark" className="docs-theme" />
        {!home && (
          <PageActions
            key={pageUrl}
            markdownUrl={`${pageUrl}.mdx`}
            githubUrl={githubUrl}
          />
        )}
        <a className="docs-open-app" href={site.calendarUrl}>
          Open app
        </a>
      </div>
    </header>
  )
}
