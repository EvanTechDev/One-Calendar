export function LandingHero() {
  return (
    <section id="top" className="grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--landing-subtle)]">Privacy-first calendar</p>
        <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight text-white md:text-[72px]">
          Plan clearly.
          <br />
          Stay focused.
          <br />
          Ship calmly.
        </h1>
        <p className="mt-6 max-w-xl text-base text-[var(--landing-muted)] md:text-lg">
          One Calendar gives individuals and small teams a clean planning command center with local-first behavior, sync options, and portable data.
        </p>
        <div className="mt-8 flex gap-3">
          <a href="/sign-up" aria-label="Get started" className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition duration-200 hover:-translate-y-0.5 hover:brightness-110">
            Get started
          </a>
          <a href="#features" aria-label="View product features" className="rounded-md border border-white/15 px-5 py-2.5 text-sm text-[var(--landing-muted)] transition duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:text-white">
            View features
          </a>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[var(--landing-panel)] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
        <img
          src="https://github.com/user-attachments/assets/cb179685-f792-42c8-bad8-ef1739659906"
          alt="One Calendar dark preview"
          className="h-auto w-full rounded-xl border border-white/10"
        />
      </div>
    </section>
  );
}
