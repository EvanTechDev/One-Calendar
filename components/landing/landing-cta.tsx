export function LandingCta() {
  return (
    <section className="py-24 text-center md:py-28">
      <p className="text-sm uppercase tracking-[0.28em] text-[var(--landing-subtle)]">Ready to switch</p>
      <h2 className="mx-auto mt-4 max-w-4xl text-5xl font-semibold leading-tight text-white md:text-7xl">
        Replace calendar chaos with
        <br />
        crisp daily clarity.
      </h2>
      <div className="mt-12 flex flex-wrap justify-center gap-4">
        <a
          href="/sign-up"
          aria-label="Create your free account"
          className="rounded-md bg-white px-8 py-3 text-lg font-medium text-black transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
        >
          Start free
        </a>
        <a
          href="#"
          aria-label="Read product documentation"
          className="rounded-md border border-white/20 px-8 py-3 text-lg text-[var(--landing-muted)] transition duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:text-white"
        >
          Read docs
        </a>
      </div>
    </section>
  );
}
