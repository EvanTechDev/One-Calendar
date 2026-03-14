import Image from "next/image";
import bannerDark from "@/public/Banner-dark.jpg";
import { LandingHeroDemo } from "./hero-demo";
import { LandingTitle } from "./title";

const manifesto = [
  "日程不是 KPI 看板，它该像你的纸质手账。",
  "每个动作都快，不靠十层弹窗。",
  "隐私是默认值，不是额外付费项。",
];

export function LandingHero() {
  return (
    <section id="top" className="py-14 md:py-20">
      <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
        <div className="space-y-7">
          <p className="inline-block border border-[var(--landing-line)] bg-[var(--landing-panel-soft)] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--landing-muted)]">
            anti-template scheduling
          </p>
          <LandingTitle
            as="h1"
            className="max-w-4xl text-4xl font-semibold leading-[0.95] tracking-[-0.02em] text-[var(--landing-text)] md:text-7xl"
          >
            Keep your calendar
            <br />
            rough, fast,
            <br />
            and yours.
          </LandingTitle>
          <p className="max-w-xl text-base text-[var(--landing-muted)] md:text-lg">
            One Calendar strips the fake productivity glow. You open it, place
            time blocks, move on.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/sign-up"
              aria-label="Get started"
              className="rounded-sm border border-[var(--landing-accent)] bg-[var(--landing-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--landing-ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] hover:-translate-y-0.5"
            >
              get started
            </a>
            <a
              href="#features"
              aria-label="View product features"
              className="rounded-sm border border-[var(--landing-line)] bg-[var(--landing-panel-soft)] px-6 py-2.5 text-sm text-[var(--landing-text)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] hover:translate-x-1"
            >
              see the workflow
            </a>
          </div>
        </div>

        <aside className="landing-scratch-card rotate-[-1.6deg] p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--landing-subtle)]">
            manifesto
          </p>
          <ul className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--landing-muted)] md:text-base">
            {manifesto.map((item) => (
              <li key={item} className="border-l border-[var(--landing-line)] pl-4">
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="mt-12 overflow-hidden border border-[var(--landing-line)] bg-[var(--landing-panel)] p-2">
        <Image
          src={bannerDark}
          alt="One Calendar dark preview"
          className="h-auto w-full"
          priority
          placeholder="blur"
          sizes="(max-width: 1024px) 100vw, 1200px"
        />
      </div>

      <LandingHeroDemo />
    </section>
  );
}
