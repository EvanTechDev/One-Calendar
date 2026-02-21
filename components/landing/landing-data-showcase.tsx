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
    <section id="data" className="flex min-h-screen items-center border-b border-white/10 py-12">
      <div className="w-full">
        <h2 className="landing-title-reveal text-3xl font-semibold leading-tight text-white md:text-5xl">Built from real One Calendar capabilities</h2>
        <p className="mt-4 max-w-3xl text-base text-[var(--landing-muted)] md:text-lg">
          Privacy-first, planning-focused, and designed to stay understandable while scaling to team workflows.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="border-b border-white/15 pb-4">
              <p className="text-4xl font-semibold text-white">{metric.value}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.12em] text-[var(--landing-subtle)]">{metric.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
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
