const faqItems = [
  {
    q: "Can I connect Google Calendar and Outlook together?",
    a: "Yes. One Calendar syncs across Google, Outlook, and iCal with automatic updates.",
  },
  {
    q: "Do you support team permissions?",
    a: "Yes. Admin roles, workspace-level controls, and sharing permissions are available.",
  },
  {
    q: "How long does migration take?",
    a: "Most teams migrate in under one day using our import wizard and guided setup.",
  },
  {
    q: "Is there an API?",
    a: "Yes. You can read/write events, schedules, and metadata through our developer API.",
  },
];

export function LandingFaq() {
  return (
    <section className="border-b border-white/10 py-16 md:py-20">
      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <h2 className="text-3xl font-semibold text-white md:text-5xl">FAQ</h2>
        <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-[var(--landing-panel)]">
          {faqItems.map((item) => (
            <article key={item.q} className="p-5 md:p-6">
              <h3 className="text-lg font-medium text-white md:text-xl">{item.q}</h3>
              <p className="mt-2 text-sm text-[var(--landing-muted)] md:text-base">{item.a}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
