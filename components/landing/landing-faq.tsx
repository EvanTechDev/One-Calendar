const faqItems = [
  {
    q: "Can I connect Google, Outlook, and Notion calendars together?",
    a: "Yes. One Calendar syncs major providers and keeps updates in near real-time.",
  },
  {
    q: "How does AI scheduling work?",
    a: "You define goals and boundaries, then AI proposes focused blocks and resolves conflicts.",
  },
  {
    q: "Is enterprise security included?",
    a: "SSO, audit logs, role controls, and data encryption are available on team and enterprise plans.",
  },
  {
    q: "Can my team migrate from our existing calendar setup?",
    a: "Yes. Our onboarding flow imports events, recurring rules, and attendee preferences in minutes.",
  },
];

export function LandingFaq() {
  return (
    <section className="border-b border-white/10 py-20">
      <div className="grid gap-10 md:grid-cols-[280px_1fr]">
        <h2 className="text-4xl font-semibold text-white md:text-5xl">FAQ</h2>
        <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02]">
          {faqItems.map((item) => (
            <article key={item.q} className="p-6 md:p-8">
              <h3 className="text-2xl font-medium text-white">{item.q}</h3>
              <p className="mt-3 text-xl text-[var(--landing-muted)]">{item.a}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
