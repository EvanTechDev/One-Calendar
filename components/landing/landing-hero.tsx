function HeroPreview() {
  return (
    <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d0d0d] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" />
      <svg
        viewBox="0 0 640 420"
        role="img"
        aria-label="Calendar dashboard preview"
        className="h-auto w-full"
      >
        <rect x="1" y="1" width="638" height="418" rx="18" stroke="rgba(255,255,255,0.2)" fill="none" />
        <rect x="30" y="32" width="170" height="20" rx="8" fill="rgba(255,255,255,0.08)" />
        <rect x="30" y="72" width="580" height="1" fill="rgba(255,255,255,0.15)" />
        {Array.from({ length: 5 }).map((_, row) => (
          <g key={row}>
            <rect x="30" y={100 + row * 58} width="580" height="42" rx="10" fill="none" stroke="rgba(255,255,255,0.14)" />
            <rect x="48" y={116 + row * 58} width="120" height="10" rx="5" fill="rgba(255,255,255,0.12)" />
            <rect x="470" y={116 + row * 58} width="120" height="10" rx="5" fill="rgba(255,255,255,0.08)" />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="grid gap-12 py-20 md:grid-cols-2 md:items-center md:py-28">
      <div>
        <h1 className="text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">
          Plan less.
          <br />
          Execute more.
          <br />
          Stay in sync.
        </h1>
        <p className="mt-6 max-w-md text-base text-[var(--landing-muted)] md:text-lg">
          One Calendar unifies work and personal schedules into a single, elegant view built for teams that move fast.
        </p>
      </div>
      <HeroPreview />
    </section>
  );
}
