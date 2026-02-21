import {
  LandingHeader,
  LandingHero,
  LandingFeatures,
  LandingCta,
  LandingFooter,
} from "@/components/landing";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-6 md:px-10">
        <LandingHeader />
        <LandingHero />
        <LandingFeatures />
        <LandingCta />
      </div>
      <LandingFooter />
    </main>
  );
}
