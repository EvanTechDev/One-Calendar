import { loader } from 'fumadocs-core/source'
import { docs } from 'collections/server'
import { ThemeToggle } from '@zntr/ui/theme-toggle'
import { formatDate } from '@zntr/utils'
import { cn } from '@zntr/utils'
import type { ReactNode } from 'react'
import { ZentraLogo } from '@/components/brand/zentra-logo'
import { generalSansBold } from '@/lib/font'

type FooterLink = {
  title: string
  href: string
  icon?: ReactNode
}

type FooterSection = {
  label: string
  links: FooterLink[]
}

const footerLinks: FooterSection[] = [
  {
    label: 'Company',
    links: [
      { title: 'FAQs', href: '#' },
      { title: 'About Us', href: '#' },
      { title: 'Privacy Policy', href: '/privacy' },
      { title: 'TOS', href: '/terms' },
    ],
  },
  {
    label: 'Resources',
    links: [
      { title: 'Docs', href: '#' },
      { title: 'Changelog', href: '/changelog' },
      { title: 'Brand', href: '#' },
      { title: 'Help', href: 'mailto:evan.huang000@proton.me' },
      { title: 'Status', href: 'https://calendarstatus.xyehr.cn' },
    ],
  },
]

const docsSource = loader({
  baseUrl: '/changelog',
  source: docs.toFumadocsSource(),
})

export default function HomePage() {
  const allPages = docsSource.getPages()

  const sortedChangelogs = [...allPages].sort((a, b) => {
    return new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
  })

  return (
    <>
      <div className="min-h-screen bg-background relative">
        {/* Header */}
        <div className="border-b border-border/50">
          <div className="max-w-5xl mx-auto relative">
            <div className="p-3 flex items-center justify-between">
              <h1 className="text-3xl font-semibold tracking-tight">
                Changelog
              </h1>
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="max-w-5xl mx-auto px-6 lg:px-10 pt-10">
          <div className="relative">
            {sortedChangelogs.map((changelog) => {
              const MDX = changelog.data.body
              const date = new Date(changelog.data.date)
              const formattedDate = formatDate(date)

              return (
                <div key={changelog.url} className="relative">
                  <div className="flex flex-col md:flex-row gap-y-6">
                    <div className="md:w-48 flex-shrink-0">
                      <div className="md:sticky md:top-8 pb-10">
                        <time className="text-sm font-medium text-muted-foreground block mb-3">
                          {formattedDate}
                        </time>

                        {changelog.data.version && (
                          <div className="inline-flex relative z-10 items-center justify-center w-10 h-10 text-foreground border border-border rounded-lg text-sm font-bold">
                            {changelog.data.version}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side - Content */}
                    <div className="flex-1 md:pl-8 relative pb-10">
                      {/* Vertical timeline line */}
                      <div className="hidden md:block absolute top-2 left-0 w-px h-full bg-border">
                        {/* Timeline dot */}
                        <div className="hidden md:block absolute -translate-x-1/2 size-3 bg-primary rounded-full z-10" />
                      </div>

                      <div className="space-y-6">
                        <div className="relative z-10 flex flex-col gap-2">
                          <h2 className="text-2xl font-semibold tracking-tight text-balance">
                            {changelog.data.title}
                          </h2>

                          {/* Tags */}
                          {changelog.data.tags &&
                            changelog.data.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {changelog.data.tags.map((tag: string) => (
                                  <span
                                    key={tag}
                                    className="h-6 w-fit px-2 text-xs font-medium bg-muted text-muted-foreground rounded-full border flex items-center justify-center"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                        <div className="prose dark:prose-invert max-w-none prose-headings:scroll-mt-8 prose-headings:font-semibold prose-a:no-underline prose-headings:tracking-tight prose-headings:text-balance prose-p:tracking-tight prose-p:text-balance">
                          <MDX />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <footer
        className={cn(
          'relative mx-auto mt-20 flex w-full max-w-5xl flex-col items-center justify-center rounded-t-4xl border-t border-border px-6 pt-10 md:rounded-t-6xl md:px-8',
          'bg-[radial-gradient(35%_128px_at_50%_0%,hsl(var(--foreground)/0.06),transparent)]',
        )}
      >
        <div className="bg-foreground/20 absolute top-0 left-1/2 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur" />

        <div className="grid gap-8 py-6 md:py-8 lg:grid-cols-3 lg:gap-8">
          <div className="space-y-4">
            <ZentraLogo className="h-9 w-9" />

            <p className="mt-8 text-sm text-muted-foreground md:mt-0">
              Schedule everything. Own your time.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4 lg:col-span-2 lg:mt-0">
            {footerLinks.map((section, _index) => (
              <div className="mb-10 md:mb-0" key={section.label}>
                <h3 className="text-xs">{section.label}</h3>
                <ul className="text-muted-foreground mt-4 space-y-2 text-sm">
                  {section.links.map((link) => (
                    <li key={link.title}>
                      <a
                        className="hover:text-foreground inline-flex items-center duration-250 [&_svg]:me-1 [&_svg]:size-4"
                        href={link.href}
                        key={`${section.label}-${link.title}`}
                      >
                        {link.icon}
                        {link.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="via-border h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="overflow-hidden pt-8">
          <h2
            className={`${generalSansBold.className} text-center text-8xl tracking-tight text-foreground md:text-[10rem] lg:text-[14rem]`}
          >
            ZENTRA
          </h2>
        </div>
      </footer>
    </>
  )
}
