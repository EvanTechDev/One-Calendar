import Link from 'next/link'
import type { ReactNode } from 'react'
import { LandingFooter, LandingHeader } from './landing-navigation'
import { LandingSurface } from './landing-surface'
import { LandingAnchor } from './landing-anchor'
import { Button } from '@zntr/ui/button'
import { SiGithub } from 'react-icons/si'

type LegalPageShellProps = {
  title: string
  lastUpdated: string
  intro: string
  sections: Array<{ heading: string; content: ReactNode[] }>
  cta: string
  github: string
  home: string
}

export function LegalPageShell({
  title,
  lastUpdated,
  intro,
  sections,
  cta,
  github,
  home,
}: LegalPageShellProps) {
  return (
    <LandingSurface>
      <div className="landing-page">
        <a className="landing-skip-link" href="#legal-content">
          Skip to content
        </a>
        <LandingHeader homeLinks />
        <main
          id="legal-content"
          className="landing-legal landing-frame"
          tabIndex={-1}
        >
          <header className="landing-legal-heading">
            <p className="landing-eyebrow">Legal</p>
            <h1>{title}</h1>
            <p className="landing-legal-updated">{lastUpdated}</p>
            <p className="landing-legal-intro">{intro}</p>
          </header>
          <div className="landing-legal-layout">
            <nav className="landing-legal-contents" aria-label="On this page">
              <h2>On this page</h2>
              {sections.map((section, i) => (
                <LandingAnchor
                  key={section.heading}
                  href={`#legal-section-${i + 1}`}
                >
                  {section.heading}
                </LandingAnchor>
              ))}
            </nav>
            <div className="landing-legal-body">
              {sections.map((section, i) => (
                <section
                  key={section.heading}
                  id={`legal-section-${i + 1}`}
                  tabIndex={-1}
                >
                  <h2>{section.heading}</h2>
                  {section.content.map((item, j) => (
                    <p key={j}>{item}</p>
                  ))}
                </section>
              ))}
            </div>
          </div>
          <section className="landing-legal-contact">
            <h2>{cta}</h2>
            <div>
              <Button asChild size="sm" variant="outline">
                <a
                  href="https://github.com/EvanTechDev/One-Calendar"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <SiGithub aria-hidden="true" />
                  {github}
                </a>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/">{home}</Link>
              </Button>
            </div>
          </section>
        </main>
        <LandingFooter homeLinks />
      </div>
    </LandingSurface>
  )
}
