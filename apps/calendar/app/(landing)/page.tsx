import { Header } from '@/components/header'
import { HeroSection } from '@/components/hero'
import { TestimonialsSection } from '@/components/testimonials-section'
import { FaqSection } from '@/components/faq-section'
import { FeatureSection } from '@/components/feature-section'
import { WorkflowSection } from '@/components/workflow-section'
import { ResultsSection } from '@/components/results-section'
import { CallToAction } from '@/components/cta'
import { Footer } from '@/components/footer'

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
