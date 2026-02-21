const testimonials = [
  {
    quote: "We cut weekly planning overhead and finally got one trusted schedule across teams.",
    name: "Mina Chen",
    role: "Operations Lead, Nova Labs",
  },
  {
    quote: "The shared timeline and conflict alerts helped us ship two sprints faster this quarter.",
    name: "Daniel Ortiz",
    role: "Engineering Manager, Northstar",
  },
];

export function LandingTestimonials() {
  return (
    <section className="border-b border-white/10 py-16 md:py-20">
      <h2 className="text-3xl font-semibold text-white md:text-5xl">What teams say</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {testimonials.map((item) => (
          <article key={item.name} className="rounded-2xl border border-white/10 bg-[var(--landing-panel)] p-6">
            <p className="text-2xl leading-tight text-white md:text-3xl">“{item.quote}”</p>
            <div className="mt-8">
              <p className="text-base font-medium text-white">{item.name}</p>
              <p className="mt-1 text-sm text-[var(--landing-muted)]">{item.role}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
