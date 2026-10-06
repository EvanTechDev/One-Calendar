import { cn } from '@zntr/utils'
import type { ReactNode } from 'react'
import { ZentraLogo } from '@zntr/calendar-ui/components/brand/zentra-logo'

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

export function Footer() {
  return (
    <footer
      className={cn(
        'md:rounded-t-6xl relative mx-auto flex w-full mt-20 pt-10 max-w-5xl flex-col items-center justify-center rounded-t-4xl border-t px-6 md:px-8',
        'dark:bg-[radial-gradient(35%_128px_at_50%_0%,--theme(--color-foreground/.1),transparent)]',
      )}
    >
      <div className="grid gap-8 py-6 md:py-8 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-4">
          <ZentraLogo className="h-9 w-9" variant="dark" />
          <p className="text-muted-foreground mt-8 text-sm md:mt-0">
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
      <div className="via-border h-px w-full bg-linear-to-r" />
      <div className="overflow-hidden pt-8">
        {/*
         * One wordmark, always white.
         *
         * `.landing` pins its own dark tokens (`oklch(0.05 0 0)` background)
         * and never flips with the theme, so the `dark:` pair here was reading
         * the ink-on-light variant on a near-black page — a 3558px grey slab.
         */}
        <img
          alt="Zentra"
          className="mx-auto w-full"
          height={627}
          src="/zentra-wordmark.svg"
          width={3558}
        />
      </div>
    </footer>
  )
}
