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
        full={home || page.data.full}
        breadcrumb={{ enabled: false }}
        footer={{ enabled: !home }}
        tableOfContentPopover={{ enabled: !home }}
        className={home ? 'docs-home' : 'docs-article'}
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
  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      title: `${page.data.title} | ${site.name}`,
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
