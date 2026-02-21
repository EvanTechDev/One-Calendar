function DashboardPreview() {
  return (
    <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-[var(--landing-panel)]">
      <div className="grid min-h-[390px] md:grid-cols-[280px_1fr]">
        <aside className="border-b border-white/10 bg-white/[0.02] p-5 md:border-b-0 md:border-r">
          <div className="text-lg text-white">One Calendar</div>
          <ul className="mt-8 space-y-4 text-lg text-[var(--landing-muted)]">
            <li>Inbox</li>
            <li>My issues</li>
            <li>Reviews</li>
            <li>Pulse</li>
          </ul>
        </aside>
        <div className="p-8 md:p-10">
          <div className="flex items-center justify-between border-b border-white/10 pb-5">
            <p className="text-xl text-white">Faster app launch</p>
            <p className="text-sm text-[var(--landing-subtle)]">ENG-2703</p>
          </div>
          <h3 className="mt-8 text-5xl font-semibold leading-tight text-white">Faster app launch</h3>
          <p className="mt-5 max-w-2xl text-2xl text-[var(--landing-muted)]">
            Render UI before <span className="rounded border border-white/15 bg-white/5 px-2 py-1 text-white">vehicle_state</span> sync when required
            state exists, instead of blocking on full refresh.
          </p>
          <div className="mt-10 grid gap-4 text-lg text-[var(--landing-muted)] md:grid-cols-3">
            <div className="rounded-lg border border-white/10 p-4">In Progress</div>
            <div className="rounded-lg border border-white/10 p-4">Priority: High</div>
            <div className="rounded-lg border border-white/10 p-4">Assignee: Jori</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingDataShowcase() {
  return (
    <section className="border-b border-white/10 py-20">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <h2 className="max-w-5xl text-5xl font-semibold leading-tight text-white md:text-7xl">Built for the future. Available today.</h2>
          <p className="mt-6 text-2xl text-[var(--landing-muted)]">Work in one command center across planning, reviews, and release.</p>
        </div>
        <a href="#" className="text-3xl text-[var(--landing-muted)] transition hover:-translate-y-0.5 hover:text-white" aria-label="Read updates">
          New · Calendar Reviews (Beta) →
        </a>
      </div>
      <DashboardPreview />
    </section>
  );
}
