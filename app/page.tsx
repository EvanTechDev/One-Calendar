import {
  Navigation,
  HeroSection,
  FeaturesSection,
  HowItWorksSection,
  InfrastructureSection,
  MetricsSection,
  IntegrationsSection,
  DevelopersSection,
  TestimonialsSection,
  PricingSection,
  CtaSection,
  FooterSection,
} from "@/components/landing";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <InfrastructureSection />
      <MetricsSection />
      <IntegrationsSection />
      <DevelopersSection />
      <TestimonialsSection />
      <PricingSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}
