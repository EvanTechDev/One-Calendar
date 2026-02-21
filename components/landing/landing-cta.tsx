export function LandingCta() {
  return (
    <section className="py-16 text-center md:py-20">
      <p className="text-xs uppercase tracking-[0.28em] text-[var(--landing-subtle)]">Ready to simplify planning</p>
      <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
        Move to a calmer,
        <br />
        focus-first workflow.
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--landing-muted)] md:text-base">
        Keep your schedule clear with privacy-first defaults, portable formats, and dependable sync.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a
          href="/sign-up"
          aria-label="Create your free account"
          className="rounded-md bg-white px-6 py-2.5 text-sm font-medium text-black transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
        >
          Start free
        </a>
        <a
          href="https://docs.xyehr.cn/docs/one-calendar"
          aria-label="Read product documentation"
          className="rounded-md border border-white/20 px-6 py-2.5 text-sm text-[var(--landing-muted)] transition duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:text-white"
        >
          Read docs
        </a>
      </div>
    </section>
  );
}
