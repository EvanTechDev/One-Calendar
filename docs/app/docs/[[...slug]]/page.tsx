import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import { DocsToolbar } from '@/components/docs-toolbar'
import { TOC, TOCPopover, TOCProvider } from '@/components/toc-slots'
import { getPageImage, source } from '@/lib/source'
import { site } from '@/lib/site'
import { getMDXComponents } from '@/mdx-components'

type Props = { params: Promise<{ slug?: string[] }> }

export default async function Page({ params }: Props) {
  const page = source.getPage((await params).slug)
  if (!page) notFound()
  const MDX = page.data.body
  const home = page.url === '/docs'
  const category = page.data.meta.category
  const sectionUrl =
    category === 'Calendar'
      ? '/docs/calendar'
      : category === 'Meet'
        ? '/docs/meet'
        : '/docs'

  return (
    <>
      <DocsToolbar
        title={page.data.title}
        section={sectionUrl === '/docs' ? 'Docs' : category}
        sectionUrl={sectionUrl}
        pageUrl={page.url}
        githubUrl={`${site.repository}/blob/${site.branch}/${site.contentPath}/${page.path}`}
      />
      <DocsPage
        toc={page.data.toc}
        slots={{
          toc: { provider: TOCProvider, main: TOC, popover: TOCPopover },
        }}
        full={home || page.data.full}
        breadcrumb={{ enabled: false }}
        footer={{ enabled: !home }}
        tableOfContentPopover={{ enabled: !home }}
        className={home ? 'docs-home' : 'docs-article'}
        tableOfContent={{
          footer: (
            <p className="mt-4 pt-5 border-t border-fd-border text-fd-muted-foreground text-xs">
              <span>
                Made with
                <svg
                  aria-label="love"
                  className="pointer-events-none inline-block size-[19px] mx-1 text-fd-foreground"
                  fill="currentColor"
                  viewBox="0 0 19 19"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Heart</title>
                  <path d="M7 2H4V3.5H2.5V5H1V9.5H2.5V11H4V12.5H5.5V14H7V15.6H8.5V17H10V15.6H11.5V14H13.0455V12.5H14.5V11H16V9.5H17.5V5H16V3.5H14.5V2H11.5V3.5H10V5H8.5V3.5H7V2ZM7 3.5V5H8.5V6.5H10V5H11.5V3.5H14.5V5H16V9.5H14.5V11H13.0455V12.5H11.5V14H10V15.6H8.5V14H7V12.5H5.5V11H4V9.5H2.5V5H4V3.5H7Z" />
                </svg>
                by{' '}
                <a
                  className="font-medium text-fd-foreground underline underline-offset-2 decoration-dotted decoration-fd-foreground/20 hover:decoration-fd-foreground/60"
                  href={site.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Zentra
                </a>
              </span>
            </p>
          ),
        }}
      >
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody>
          <MDX
            components={getMDXComponents({
              a: createRelativeLink(source, page),
            })}
          />
        </DocsBody>
      </DocsPage>
    </>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = source.getPage((await params).slug)
  if (!page) notFound()
  const title =
    page.url === '/docs' ? site.name : `${page.data.title} | ${site.name}`
  return {
    title: { absolute: title },
    description: page.data.description,
    openGraph: {
      title,
      description: page.data.description,
      siteName: site.name,
      locale: 'en_US',
      url: page.url,
      images: [
        {
          url: getPageImage(page).url,
          alt: site.name,
          width: 1200,
          height: 630,
        },
      ],
    },
    alternates: { canonical: page.url },
  }
}
