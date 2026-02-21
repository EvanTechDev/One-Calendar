export function LandingCta() {
  return (
    <section className="py-20 text-center md:py-28">
      <p className="text-sm uppercase tracking-[0.28em] text-[var(--landing-subtle)]">Built for modern teams</p>
      <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
        Replace calendar chaos with crisp daily clarity.
      </h2>
      <div className="mt-10 flex justify-center gap-4">
        <a
          href="/sign-up"
          aria-label="Create your free account"
          className="rounded-full bg-white px-7 py-3 text-sm font-medium text-black transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
        >
          Start free
        </a>
        <a
          href="#"
          aria-label="Read product documentation"
          className="rounded-full border border-white/20 px-7 py-3 text-sm text-[var(--landing-muted)] transition duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:text-white"
        >
          Learn more
        </a>
      </div>
    </section>
  );
}
