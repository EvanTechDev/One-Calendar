const feedback = [
  {
    title: "Clarity over complexity",
    detail: "The project vision emphasizes a calm planning experience instead of overloaded automation and noisy analytics.",
  },
  {
    title: "Privacy-first defaults",
    detail: "No analytics by default and optional encrypted handling are core principles, not afterthoughts.",
  },
];

export function LandingTestimonials() {
  return (
    <section className="border-b border-white/10 py-16 md:py-20">
      <h2 className="text-3xl font-semibold text-white md:text-5xl">Why users choose One Calendar</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {feedback.map((item) => (
          <article key={item.title} className="rounded-2xl border border-white/10 bg-[var(--landing-panel)] p-6">
            <h3 className="text-xl font-medium text-white md:text-2xl">{item.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)] md:text-base">{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
