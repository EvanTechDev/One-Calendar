import { changelog as entries } from 'fumadocs-mdx:collections/server'
import { toFumadocsSource } from 'fumadocs-mdx/runtime/server'
import { loader } from 'fumadocs-core/source'
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page'
import { DocsToolbar } from '@/components/docs-toolbar'
import { TOC, TOCPopover, TOCProvider } from '@/components/toc-slots'

const changelogSource = loader({
  baseUrl: '/changelog',
  source: toFumadocsSource(entries, []),
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export default function ChangelogPage() {
  const releases = [...changelogSource.getPages()].sort(
    (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime(),
  )
  const toc = releases.map((release) => {
    const id = release.url.split('/').at(-1) ?? ''
    return { title: release.data.title, url: `#${id}`, depth: 2 }
  })

  return (
    <>
      <DocsToolbar
        title="Changelog"
        section="Docs"
        sectionUrl="/docs"
        pageUrl="/changelog"
        githubUrl=""
        showPageActions={false}
      />
      <DocsPage
        toc={toc}
        slots={{
          toc: { provider: TOCProvider, main: TOC, popover: TOCPopover },
        }}
        breadcrumb={{ enabled: false }}
        footer={{ enabled: false }}
        className="docs-article"
      >
        <DocsTitle>Changelog</DocsTitle>
        <DocsDescription>
          Product updates and fixes, newest first.
        </DocsDescription>
        <DocsBody>
          {releases.length === 0 ? (
            <p className="text-sm text-fd-muted-foreground">
              No releases have been published yet.
            </p>
          ) : (
            <div className="relative">
              {releases.map((release) => {
                const Body = release.data.body

                return (
                  <article
                    key={release.url}
                    className="relative grid gap-5 pb-12 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8"
                  >
                    <div className="md:sticky md:top-8 md:self-start">
                      <time
                        className="mb-3 block text-sm text-fd-muted-foreground"
                        dateTime={release.data.date}
                      >
                        {dateFormatter.format(new Date(release.data.date))}
                      </time>
                      {release.data.version ? (
                        <span className="inline-flex min-h-9 items-center rounded-lg border border-fd-border px-3 text-sm font-semibold">
                          {release.data.version}
                        </span>
                      ) : null}
                    </div>

                    <div className="relative min-w-0 md:border-l md:border-fd-border md:pl-8">
                      <span
                        aria-hidden="true"
                        className="absolute -left-[6px] top-1 hidden size-3 rounded-full bg-fd-primary md:block"
                      />
                      <h2
                        id={release.url.split('/').at(-1)}
                        className="text-2xl font-semibold tracking-tight"
                      >
                        {release.data.title}
                      </h2>
                      {release.data.tags?.length ? (
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {release.data.tags.map((tag) => (
                            <li
                              key={tag}
                              className="rounded-full border border-fd-border bg-fd-muted px-2 py-1 text-xs text-fd-muted-foreground"
                            >
                              {tag}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-6">
                        <Body />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </DocsBody>
      </DocsPage>
    </>
  )
}
