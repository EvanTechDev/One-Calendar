import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import { PageActions } from '@/components/ai/page-actions'
import { getPageImage, source } from '@/lib/source'
import { site } from '@/lib/site'
import { getMDXComponents } from '@/mdx-components'

type Props = { params: Promise<{ slug?: string[] }> }

export default async function Page({ params }: Props) {
  const page = source.getPage((await params).slug)
  if (!page) notFound()
  const MDX = page.data.body
  const home = page.url === '/docs'

  return (
    <DocsPage
      toc={page.data.toc}
      full={home || page.data.full}
      breadcrumb={{ enabled: !home }}
      footer={{ enabled: !home }}
      tableOfContentPopover={{ enabled: !home }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DocsTitle>{page.data.title}</DocsTitle>
        {!home && (
          <PageActions
            key={page.url}
            markdownUrl={`${page.url}.mdx`}
            githubUrl={`${site.repository}/blob/${site.branch}/${site.contentPath}/${page.path}`}
          />
        )}
      </div>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
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
