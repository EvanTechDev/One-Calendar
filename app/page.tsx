import {
  LandingHeader,
  LandingHero,
  LandingDataShowcase,
  LandingFeatures,
  LandingComparison,
  LandingTestimonials,
  LandingFaq,
  LandingCta,
  LandingFooter,
} from "@/components/landing";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)]">
      <div className="mx-auto flex w-full max-w-[1720px] flex-col px-6 md:px-10">
        <LandingHeader />
        <LandingHero />
        <LandingDataShowcase />
        <LandingFeatures />
        <LandingComparison />
        <LandingTestimonials />
        <LandingFaq />
        <LandingCta />
      </div>
      <LandingFooter />
    </main>
  );
}
