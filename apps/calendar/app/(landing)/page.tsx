import { Header } from "@/components/landing/header";
import { HeroSection } from "@/components/landing/hero";
import { LogosSection } from "@/components/landing/logos-section";
import { FeatureSection } from "@/components/landing/feature-section";
import { CallToAction } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import styles from "./page.module.css"

export default function LandingPage() {
  return (
    <div className={`${styles.page} flex min-h-screen flex-col items-center`}>
      <Header />
      <main className="flex w-full flex-col gap-20">
        <HeroSection />
        <LogosSection />
        <FeatureSection />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
