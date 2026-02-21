export function LandingHero() {
  return (
    <section className="flex min-h-[72vh] flex-col items-center justify-center border-b border-white/10 text-center">
      <h1 className="max-w-5xl text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl xl:text-8xl">
        The product development
        <br />
        system for teams and agents
      </h1>
      <p className="mt-8 max-w-2xl text-lg text-[var(--landing-muted)]">
        Purpose-built for planning and building products. Designed for the AI era.
      </p>
      <div className="mt-12 flex flex-wrap justify-center gap-4">
        <a
          href="/sign-up"
          aria-label="Get started with One Calendar"
          className="rounded-md bg-white px-10 py-4 text-lg font-medium text-black transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
        >
          Get started
        </a>
        <a
          href="#"
          aria-label="Contact sales"
          className="rounded-md border border-white/15 bg-white/5 px-10 py-4 text-lg text-white transition duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10"
        >
          Contact sales
        </a>
      </div>
    </section>
  );
}
