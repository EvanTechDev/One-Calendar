import {
  LandingHeader,
  LandingHero,
  LandingFeatures,
  LandingDataShowcase,
  LandingComparison,
  LandingTestimonials,
  LandingDeepDive,
  LandingFaq,
  LandingCta,
  LandingFooter,
} from "@/components/landing";

export default function LandingPage() {
  return (
    <main className="landing-surface min-h-screen text-[var(--landing-text)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-5 md:px-10">
        <LandingHeader />
        <LandingHero />
        <LandingFeatures />
        <LandingDataShowcase />
        <LandingComparison />
        <LandingTestimonials />
        <LandingDeepDive />
        <LandingFaq />
        <LandingCta />
      </div>
      <LandingFooter />
    </main>
  );
}
