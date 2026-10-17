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
            <div className="not-prose relative">
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-[5.5px] top-1 w-px bg-fd-border"
              />
              {releases.map((release) => {
                const Body = release.data.body
                const id = release.url.split('/').at(-1) ?? ''

                return (
                  <article
                    key={release.url}
                    className="relative grid grid-cols-[12px_minmax(0,1fr)] gap-4 pb-12 last:pb-0 md:gap-6"
                  >
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1 size-3 rounded-full bg-fd-primary"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <time
                          className="text-sm text-fd-muted-foreground"
                          dateTime={release.data.date}
                        >
                          {dateFormatter.format(new Date(release.data.date))}
                        </time>
                        {release.data.version ? (
                          <span className="rounded-md border border-fd-border px-2 py-0.5 text-xs font-medium text-fd-muted-foreground">
                            {release.data.version}
                          </span>
                        ) : null}
                      </div>
                      <h2
                        id={id}
                        className="m-0 text-xl font-semibold tracking-tight text-fd-foreground"
                      >
                        {release.data.title}
                      </h2>
                      <div className="prose mt-4 max-w-none">
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
