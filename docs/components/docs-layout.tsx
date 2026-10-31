import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { MobileSidebarBrand } from '@/components/mobile-sidebar-brand'
import { baseOptions, SidebarResources } from '@/lib/layout.shared'
import { source } from '@/lib/source'

export function ZentraDocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      tabs={false}
      sidebar={{
        collapsible: false,
        banner: <MobileSidebarBrand />,
        footer: <SidebarResources />,
      }}
      containerProps={{
        className: 'zentra-docs',
        style: {
          gridTemplate:
            '"sidebar header header" auto "sidebar toc-popover toc-popover" auto "sidebar main toc" 1fr / var(--fd-sidebar-col) minmax(0, 1fr) var(--fd-toc-width)',
        },
      }}
    >
      {children}
    </DocsLayout>
  )
}
