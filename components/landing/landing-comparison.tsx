const rows = [
  { label: "Meeting conflicts", old: "Resolved manually", next: "Auto-detected with suggestions" },
  { label: "Schedule visibility", old: "Split across tools", next: "Unified timeline view" },
  { label: "Team updates", old: "Status meetings", next: "Async daily rollups" },
  { label: "Planning confidence", old: "Reactive", next: "Forecasted with weekly signals" },
];

export function LandingComparison() {
  return (
    <section className="border-b border-white/10 py-16 md:py-20">
      <h2 className="text-3xl font-semibold text-white md:text-5xl">Before vs One Calendar</h2>
      <p className="mt-4 max-w-3xl text-base text-[var(--landing-muted)] md:text-lg">Same team, different operating system.</p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-[0.18em] text-[var(--landing-subtle)] md:grid-cols-[220px_1fr_1fr]">
          <div className="p-4">Category</div>
          <div className="border-t border-white/10 p-4 md:border-l md:border-t-0">Old workflow</div>
          <div className="border-t border-white/10 p-4 md:border-l md:border-t-0">One Calendar</div>
        </div>

        {rows.map((row) => (
          <div key={row.label} className="grid text-sm md:grid-cols-[220px_1fr_1fr] md:text-base">
            <div className="border-b border-white/10 p-4 text-white">{row.label}</div>
            <div className="border-b border-white/10 p-4 text-[var(--landing-muted)] md:border-l">{row.old}</div>
            <div className="border-b border-white/10 p-4 text-white md:border-l">{row.next}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
