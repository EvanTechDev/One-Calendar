export function LandingCta() {
  return (
    <section className="py-24 md:py-28">
      <div className="grid gap-8 border border-[var(--landing-line)] bg-[var(--landing-panel-soft)] p-7 md:grid-cols-[1.3fr_0.7fr] md:p-10">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
            ready when you are
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-[var(--landing-text)] md:text-6xl">
            Own your schedule,
            <br />
            not someone else’s dashboard.
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-[var(--landing-muted)] md:text-base">
            现在开始，把时间管理拉回你手里。没有花哨流程，只有能落地的日程动作。
          </p>
        </div>
        <div className="flex flex-col items-start justify-end gap-3 md:items-end">
          <a
            href="/sign-up"
            aria-label="Create your free account"
            className="rounded-sm border border-[var(--landing-accent)] bg-[var(--landing-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--landing-ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] hover:-translate-y-0.5"
          >
            start free
          </a>
          <a
            href="https://docs.xyehr.cn/docs/one-calendar"
            aria-label="Read product documentation"
            className="rounded-sm border border-[var(--landing-line)] px-6 py-2.5 text-sm text-[var(--landing-muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] hover:translate-x-1 hover:text-[var(--landing-text)]"
          >
            read docs
          </a>
        </div>
      </div>
    </section>
  );
}
