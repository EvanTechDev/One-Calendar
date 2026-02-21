function HeroPreview() {
  return (
    <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[var(--landing-panel)] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
      <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
      <svg viewBox="0 0 760 460" role="img" aria-label="One Calendar dashboard preview" className="h-auto w-full">
        <rect x="1" y="1" width="758" height="458" rx="16" fill="none" stroke="rgba(255,255,255,0.18)" />
        <rect x="24" y="22" width="712" height="36" rx="8" fill="rgba(255,255,255,0.06)" />
        <rect x="24" y="74" width="190" height="362" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" />
        <rect x="232" y="74" width="504" height="362" rx="10" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" />
        <rect x="42" y="98" width="120" height="10" rx="5" fill="rgba(255,255,255,0.12)" />
        <rect x="42" y="126" width="90" height="8" rx="4" fill="rgba(255,255,255,0.08)" />
        {Array.from({ length: 5 }).map((_, i) => (
          <g key={i}>
            <rect x="256" y={98 + i * 62} width="456" height="44" rx="8" fill="none" stroke="rgba(255,255,255,0.14)" />
            <rect x="274" y={114 + i * 62} width="140" height="10" rx="5" fill="rgba(255,255,255,0.11)" />
            <rect x="620" y={114 + i * 62} width="72" height="10" rx="5" fill="rgba(255,255,255,0.08)" />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
      <div>
        <h1 className="text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">
          All calendars.
          <br />
          One command
          <br />
          center.
        </h1>
        <p className="mt-6 max-w-xl text-base text-[var(--landing-muted)] md:text-lg">
          One Calendar unifies Google, Outlook and team schedules into one clean workflow so you can plan faster and ship on time.
        </p>
        <div className="mt-8 flex gap-3">
          <a href="/sign-up" aria-label="Get started" className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition duration-200 hover:-translate-y-0.5 hover:brightness-110">
            Get started
          </a>
          <a href="#" aria-label="View product demo" className="rounded-md border border-white/15 px-5 py-2.5 text-sm text-[var(--landing-muted)] transition duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:text-white">
            Watch demo
          </a>
        </div>
      </div>
      <HeroPreview />
    </section>
  );
}
