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
    <section id="data" className="border-b border-white/10 py-16 md:py-20">
      <h2 className="text-3xl font-semibold leading-tight text-white md:text-5xl">Built from real One Calendar capabilities</h2>
      <p className="mt-4 max-w-3xl text-base text-[var(--landing-muted)] md:text-lg">
        Privacy-first, planning-focused, and designed to stay understandable while scaling to team workflows.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-white/10 bg-[var(--landing-panel)] p-5">
            <p className="text-3xl font-semibold text-white">{metric.value}</p>
            <p className="mt-2 text-sm text-[var(--landing-muted)]">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-[var(--landing-panel)] p-6">
        <ul className="grid gap-3 md:grid-cols-2">
          {stack.map((item) => (
            <li key={item} className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-[var(--landing-muted)]">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
