import { LandingHeader, LandingFooter } from '@/components/landing-navigation'
import {
  LandingHero,
  LandingFeatures,
  LandingAutomation,
  LandingTools,
  LandingFaq,
  LandingCallToAction,
} from '@/components/landing-sections'

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
        <LandingFaq />
        <LandingCallToAction />
      </main>
      <LandingFooter />
    </div>
  )
}
