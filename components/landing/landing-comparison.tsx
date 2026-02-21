const rows = [
  { label: "Planning speed", old: "Manual weekly triage", next: "Auto-priority + instant sync" },
  { label: "Context switching", old: "5+ tools and tabs", next: "Single command center" },
  { label: "Meeting overhead", old: "Long standups", next: "AI summaries + async updates" },
  { label: "Delivery confidence", old: "Late risk visibility", next: "Live health signals" },
];

export function LandingComparison() {
  return (
    <section className="border-b border-white/10 py-20">
      <h2 className="text-4xl font-semibold text-white md:text-6xl">Compare your workflow</h2>
      <p className="mt-5 max-w-3xl text-xl text-[var(--landing-muted)]">See what changes when product operations are designed for AI-native teams.</p>

      <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid border-b border-white/10 bg-white/[0.02] text-sm uppercase tracking-[0.18em] text-[var(--landing-subtle)] md:grid-cols-[220px_1fr_1fr]">
          <div className="p-4">Category</div>
          <div className="border-t border-white/10 p-4 md:border-l md:border-t-0">Traditional stack</div>
          <div className="border-t border-white/10 p-4 md:border-l md:border-t-0">One Calendar</div>
        </div>

        {rows.map((row) => (
          <div key={row.label} className="grid text-lg md:grid-cols-[220px_1fr_1fr]">
            <div className="border-b border-white/10 p-4 text-white">{row.label}</div>
            <div className="border-b border-white/10 p-4 text-[var(--landing-muted)] md:border-l">{row.old}</div>
            <div className="border-b border-white/10 p-4 text-white md:border-l">{row.next}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
