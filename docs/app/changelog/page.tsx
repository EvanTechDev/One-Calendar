import Link from 'next/link'
import { changelog as entries } from 'fumadocs-mdx:collections/server'
import { toFumadocsSource } from 'fumadocs-mdx/runtime/server'
import { loader } from 'fumadocs-core/source'
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch'

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

  return (
    <main className="min-h-dvh bg-fd-background text-fd-foreground">
      <header className="border-b border-fd-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-sm text-fd-muted-foreground hover:text-fd-foreground"
            >
              Zentra Docs
            </Link>
            <span aria-hidden="true" className="text-fd-muted-foreground">
              /
            </span>
            <h1 className="text-lg font-semibold">Changelog</h1>
          </div>
          <ThemeSwitch mode="light-dark" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 pb-16 pt-10 md:px-10">
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
                  className="relative grid gap-5 pb-12 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8"
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
                    <h2 className="text-2xl font-semibold tracking-tight">
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
                    <div className="prose mt-6 max-w-none dark:prose-invert">
                      <Body />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
