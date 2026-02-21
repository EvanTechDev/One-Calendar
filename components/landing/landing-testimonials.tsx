import { LandingTitle } from "./landing-title";

const feedback = [
  {
    title: "Clarity over complexity",
    detail: "The product vision emphasizes a calm planning experience instead of overloaded automation and noisy analytics.",
  },
  {
    title: "Privacy-first defaults",
    detail: "No analytics by default and optional encrypted handling are core principles, not afterthoughts.",
  },
  {
    title: "Portable workflows",
    detail: "Import/export support keeps calendar data usable across ecosystems without lock-in.",
  },
];

export function LandingTestimonials() {
  return (
    <section className="border-b border-white/10 py-24 md:py-28">
      <LandingTitle as="h2" className="text-3xl font-semibold text-white md:text-5xl">Why users choose One Calendar</LandingTitle>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {feedback.map((item) => (
          <article key={item.title} className="rounded-2xl border border-white/10 bg-[var(--landing-panel)] p-6">
            <LandingTitle as="h3" className="text-lg font-medium text-white md:text-xl">{item.title}</LandingTitle>
            <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)] md:text-base">{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
