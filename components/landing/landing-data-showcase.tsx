const metrics = [
  { label: "Connected calendars", value: "120,000+" },
  { label: "Scheduling conflicts reduced", value: "38%" },
  { label: "Weekly planning time saved", value: "6.4h" },
];

export function LandingDataShowcase() {
  return (
    <section className="border-b border-white/10 py-16 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-semibold leading-tight text-white md:text-5xl">Data that keeps your team on schedule</h2>
          <p className="mt-4 max-w-2xl text-base text-[var(--landing-muted)] md:text-lg">
            Built from real One Calendar usage patterns across product, design, and engineering teams.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-white/10 bg-[var(--landing-panel)] p-5">
            <p className="text-3xl font-semibold text-white">{metric.value}</p>
            <p className="mt-2 text-sm text-[var(--landing-muted)]">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[var(--landing-panel)] p-5">
        <svg viewBox="0 0 1000 260" aria-label="Weekly focus-time trend" role="img" className="h-auto w-full">
          <rect x="1" y="1" width="998" height="258" rx="12" fill="none" stroke="rgba(255,255,255,0.12)" />
          <path d="M70 190C140 170 170 120 250 135C330 150 360 80 430 90C500 100 540 165 610 150C680 135 730 70 810 85C890 100 920 130 950 120" stroke="white" strokeWidth="2" fill="none" />
          <path d="M70 212h880" stroke="rgba(255,255,255,0.2)" />
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, idx) => (
            <text key={day} x={90 + idx * 128} y="236" fill="rgba(155,155,155,1)" fontSize="14">{day}</text>
          ))}
        </svg>
      </div>
    </section>
  );
}
