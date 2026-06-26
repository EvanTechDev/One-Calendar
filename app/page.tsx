import { Header } from "@/components/templates/orbit/sections/header";
import { HeroSection } from "@/components/templates/orbit/sections/hero";
import { LogosSection } from "@/components/templates/orbit/sections/logos-section";
import { FeatureSection } from "@/components/templates/orbit/sections/feature-section";
import { Integrations } from "@/components/templates/orbit/sections/integrations";
import { CallToAction } from "@/components/templates/orbit/sections/cta";
import { Footer } from "@/components/templates/orbit/sections/footer";

export default function OrbitDemoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center">
      <Header />
      <main className="flex w-full flex-col gap-20">
        <HeroSection />
        <LogosSection />
        <FeatureSection />
        <Integrations />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
