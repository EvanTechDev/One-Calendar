const rows = [
  { label: "End-to-end encryption (E2EE)", one: "✅", google: "❌", proton: "✅" },
  { label: "No analytics by default", one: "✅", google: "❌", proton: "✅" },
  { label: "ICS import / export", one: "✅", google: "✅", proton: "✅" },
  { label: "Keyboard shortcuts", one: "✅", google: "✅", proton: "✅" },
  { label: "Custom themes", one: "✅", google: "⚠️", proton: "⚠️" },
];

export function LandingComparison() {
  return (
    <section className="border-b border-white/10 py-16 md:py-20">
      <h2 className="text-3xl font-semibold text-white md:text-5xl">Feature comparison snapshot</h2>
      <p className="mt-4 max-w-3xl text-base text-[var(--landing-muted)] md:text-lg">
        Based on the comparison table documented in this repository README.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-[0.18em] text-[var(--landing-subtle)] md:grid-cols-[1.6fr_0.6fr_0.6fr_0.6fr]">
          <div className="p-4">Feature</div>
          <div className="border-t border-white/10 p-4 md:border-l md:border-t-0">One Calendar</div>
          <div className="border-t border-white/10 p-4 md:border-l md:border-t-0">Google</div>
          <div className="border-t border-white/10 p-4 md:border-l md:border-t-0">Proton</div>
        </div>

        {rows.map((row) => (
          <div key={row.label} className="grid text-sm md:grid-cols-[1.6fr_0.6fr_0.6fr_0.6fr] md:text-base">
            <div className="border-b border-white/10 p-4 text-white">{row.label}</div>
            <div className="border-b border-white/10 p-4 text-white md:border-l">{row.one}</div>
            <div className="border-b border-white/10 p-4 text-[var(--landing-muted)] md:border-l">{row.google}</div>
            <div className="border-b border-white/10 p-4 text-[var(--landing-muted)] md:border-l">{row.proton}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
