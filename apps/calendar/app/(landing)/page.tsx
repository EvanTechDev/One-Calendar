import { LandingHeader, LandingFooter } from '@/components/landing-navigation'
import {
  LandingHero,
  LandingFeatures,
  LandingAutomation,
  LandingTools,
  LandingTestimonials,
  LandingFaq,
  LandingCallToAction,
} from '@/components/landing-sections'
import { LandingReveal } from '@/components/landing-motion'

export default function LandingPage() {
  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#main-content">
        Skip to content
      </a>
      <LandingHeader />
      <main className="landing-frame" id="main-content" tabIndex={-1}>
        <LandingHero />
        <LandingFeatures />
        <LandingAutomation />
        <LandingTools />
        <LandingTestimonials />
        <LandingReveal>
          <LandingFaq />
        </LandingReveal>
        <LandingReveal>
          <LandingCallToAction />
        </LandingReveal>
      </main>
      <LandingFooter />
    </div>
  )
}
