import { Header } from '@/components/landing/header'
import { HeroSection } from '@/components/landing/hero'
import { TestimonialsSection } from '@/components/landing/testimonials-section'
import { FaqSection } from '@/components/landing/faq-section'
import { FeatureSection } from '@/components/landing/feature-section'
import { WorkflowSection } from '@/components/landing/workflow-section'
import { ResultsSection } from '@/components/landing/results-section'
import { CallToAction } from '@/components/landing/cta'
import { Footer } from '@/components/landing/footer'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center">
      <Header />
      <main className="flex w-full flex-col gap-20">
        <HeroSection />
        <WorkflowSection />
        <FeatureSection />
        <ResultsSection />
        <TestimonialsSection />
        <CallToAction />
        <FaqSection />
      </main>
      <Footer />
    </div>
  )
}
