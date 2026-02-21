import { LandingTitle } from "./landing-title";

const metrics = [
  { label: "Locale packs", value: "35" },
  { label: "Theme options", value: "5" },
  { label: "Import formats", value: "3" },
];

const stack = [
  "Open-source and privacy-first",
  "Optional cloud sync with PostgreSQL",
  "Authentication with Clerk",
  "Import/export support for .ics, .json, .csv",
];

export function LandingDataShowcase() {
  return (
    <section id="data" className="border-b border-white/10 py-24 md:py-28">
      <LandingTitle as="h2" className="text-3xl font-semibold leading-tight text-white md:text-5xl">
        Trusted data.
        <br />
        Clear architecture.
      </LandingTitle>
      <p className="mt-4 max-w-3xl text-base text-[var(--landing-muted)] md:text-lg">
        Practical metrics and straightforward infrastructure choices, without black-box behavior.
      </p>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-6 md:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="border-b border-white/15 pb-4">
              <p className="text-4xl font-semibold text-white">{metric.value}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.12em] text-[var(--landing-subtle)]">{metric.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {stack.map((item, idx) => (
            <div key={item} className="flex items-start gap-3 border-l border-white/15 pl-4">
              <span className="mt-0.5 text-xs text-[var(--landing-subtle)]">0{idx + 1}</span>
              <p className="text-sm text-[var(--landing-muted)] md:text-base">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
