import Link from 'next/link'
import { Button } from '@zntr/ui/button'
import { LandingMobileMenu } from './landing-mobile-menu'
import { LandingAnchor } from './landing-anchor'

export const LANDING_REPOSITORY_URL =
  'https://github.com/EvanTechDev/One-Calendar'

const navigation = [
  { label: 'Product', href: '#features' },
  { label: 'Integrations', href: '#integrations' },
  { label: 'Updates', href: `${LANDING_REPOSITORY_URL}/commits/dev` },
]

function LandingBrand() {
  return (
    <Link className="landing-brand" href="/" aria-label="Zentra Calendar home">
      <img src="/logo-light.svg" alt="" width={30} height={30} />
      <span>Zentra Calendar</span>
    </Link>
  )
}

export function LandingHeader({ homeLinks = false }: { homeLinks?: boolean }) {
  return (
    <header className="landing-header">
      <div className="landing-header-inner">
        <LandingBrand />
        <nav className="landing-desktop-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <LandingAnchor
              key={item.label}
              href={
                homeLinks && item.href.startsWith('#')
                  ? `/${item.href}`
                  : item.href
              }
            >
              {item.label}
            </LandingAnchor>
          ))}
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-sign-in" href="/sign-in">
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
        <LandingMobileMenu>
          <nav aria-label="Mobile navigation">
            {navigation.map((item) => (
              <LandingAnchor
                key={item.label}
                href={
                  homeLinks && item.href.startsWith('#')
                    ? `/${item.href}`
                    : item.href
                }
              >
                {item.label}
              </LandingAnchor>
            ))}
            <Link href="/sign-in">Sign in</Link>
            <Button asChild size="sm">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </nav>
        </LandingMobileMenu>
      </div>
    </header>
  )
}

export function LandingFooter({ homeLinks = false }: { homeLinks?: boolean }) {
  return (
    <footer className="landing-footer landing-frame">
      <div className="landing-footer-top">
        <div>
          <LandingBrand />
          <p>
            Five calendar views. Recurring events, invitations, and reminders.
          </p>
        </div>
        <nav aria-label="Product">
          <h2>Product</h2>
          <LandingAnchor href={`${homeLinks ? '/' : ''}#calendar`}>
            Calendar preview
          </LandingAnchor>
          <LandingAnchor href={`${homeLinks ? '/' : ''}#features`}>
            Planning tools
          </LandingAnchor>
          <LandingAnchor href={`${homeLinks ? '/' : ''}#integrations`}>
            AI & MCP
          </LandingAnchor>
          <LandingAnchor href={`${homeLinks ? '/' : ''}#tools`}>
            More tools
          </LandingAnchor>
          <LandingAnchor href={`${homeLinks ? '/' : ''}#questions`}>
            Frequently asked questions
          </LandingAnchor>
        </nav>
        <nav aria-label="Resources">
          <h2>Resources</h2>
          <a href={LANDING_REPOSITORY_URL}>GitHub</a>
          <a href={`${LANDING_REPOSITORY_URL}/tree/dev`}>Source code</a>
          <a href={`${LANDING_REPOSITORY_URL}/issues`}>Issues & feedback</a>
          <a href={`${LANDING_REPOSITORY_URL}/commits/dev`}>Commit history</a>
        </nav>
        <nav aria-label="Legal">
          <h2>Legal</h2>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of service</Link>
          <a href={`${LANDING_REPOSITORY_URL}/blob/dev/LICENSE`}>MIT License</a>
        </nav>
      </div>
    </footer>
  )
}
