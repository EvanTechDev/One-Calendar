import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { LandingMobileMenu } from './landing-mobile-menu'

export const LANDING_DOCS_URL = 'https://xyehr.cn/docs'
export const LANDING_REPOSITORY_URL =
  'https://github.com/EvanTechDev/One-Calendar'

const navigation = [
  { label: 'Calendar', href: '/#calendar' },
  { label: 'Features', href: '/#features' },
  { label: 'AI & MCP', href: '/#automation' },
  { label: 'Docs', href: LANDING_DOCS_URL },
]

function LandingBrand() {
  return (
    <Link className="landing-brand" href="/" aria-label="Zentra Calendar home">
      <img src="/logo-light.svg" alt="" width={30} height={30} />
      <span>
        Zentra <span className="landing-brand-product">Calendar</span>
      </span>
    </Link>
  )
}

export function LandingHeader() {
  return (
    <header className="landing-header">
      <div className="landing-header-inner">
        <LandingBrand />
        <nav className="landing-desktop-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
              {item.label === 'Docs' ? (
                <ArrowUpRight aria-hidden="true" />
              ) : null}
            </a>
          ))}
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-sign-in" href="/sign-in">
            Sign in
          </Link>
          <Link className="landing-button landing-button-small" href="/sign-up">
            Create account <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <LandingMobileMenu>
          <nav aria-label="Mobile navigation">
            {navigation.map((item) => (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ))}
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up">
              Create account <ArrowRight aria-hidden="true" />
            </Link>
          </nav>
        </LandingMobileMenu>
      </div>
    </header>
  )
}

export function LandingFooter() {
  return (
    <footer className="landing-footer landing-frame">
      <div className="landing-footer-top">
        <div>
          <LandingBrand />
          <p>Events, invitations, and the time between them.</p>
        </div>
        <nav aria-label="Resources">
          <h2>Resources</h2>
          <a href={LANDING_DOCS_URL}>Documentation</a>
          <a href="https://xyehr.cn/changelog">Changelog</a>
          <a href={LANDING_REPOSITORY_URL}>
            GitHub <ArrowUpRight aria-hidden="true" />
          </a>
        </nav>
        <nav aria-label="Legal">
          <h2>Legal</h2>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of service</Link>
        </nav>
      </div>
      <div className="landing-footer-bottom">
        <span>Zentra Calendar</span>
        <a href={`${LANDING_REPOSITORY_URL}/blob/dev/LICENSE`}>
          Open source · MIT License <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
    </footer>
  )
}
