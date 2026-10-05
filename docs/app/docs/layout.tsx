import { source } from '@/lib/source'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { baseOptions, SidebarResources } from '@/lib/layout.shared'
import { MobileSidebarBrand } from '@/components/mobile-sidebar-brand'

export default function Layout({ children }: LayoutProps<'/docs'>) {
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
