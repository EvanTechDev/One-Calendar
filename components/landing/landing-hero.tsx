import Image from "next/image";
import bannerDark from "@/public/Banner-dark.jpg";
import { LandingHeroDemo } from "./landing-hero-demo";
import { LandingTitle } from "./landing-title";

export function LandingHero() {
  return (
    <section id="top" className="py-16 md:py-24">
      <div className="mx-auto max-w-4xl text-center">
        <LandingTitle as="h1" className="text-4xl font-semibold leading-tight tracking-tight text-white md:text-[56px]">
          The calendar that keeps
          <br />
          your life private
        </LandingTitle>
        <p className="mx-auto mt-5 max-w-2xl text-sm text-[var(--landing-muted)] md:text-base">
          Secure by design. Powerful by default.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a href="/sign-up" aria-label="Get started" className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition duration-200 hover:-translate-y-0.5 hover:brightness-110">
            Get started
          </a>
          <a href="#features" aria-label="View product features" className="rounded-md border border-white/15 px-5 py-2.5 text-sm text-[var(--landing-muted)] transition duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:text-white">
            View features
          </a>
        </div>
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-[var(--landing-panel)] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <Image
          src={bannerDark}
          alt="One Calendar dark preview"
          className="h-auto w-full rounded-xl border border-white/10"
          priority
          placeholder="blur"
          sizes="(max-width: 1024px) 100vw, 1200px"
        />
      </div>

      <LandingHeroDemo />
    </section>
  );
}
