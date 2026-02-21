const testimonials = [
  {
    quote: "You only need to use it once to feel how much faster your team can move.",
    name: "Gabriel Peal",
    role: "Product Lead, OpenAI",
    tone: "bg-[#d9deea] text-black",
  },
  {
    quote: "Our speed is intense and One Calendar keeps us action biased every week.",
    name: "Nik Koblov",
    role: "Head of Engineering, Ramp",
    tone: "bg-[#f3f3f3] text-black",
  },
];

export function LandingTestimonials() {
  return (
    <section className="border-b border-white/10 py-20">
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {testimonials.map((item) => (
          <article key={item.name} className={`flex min-h-[420px] flex-col justify-between rounded-2xl p-8 md:p-12 ${item.tone}`}>
            <p className="max-w-3xl text-4xl leading-tight md:text-6xl">“{item.quote}”</p>
            <div>
              <p className="text-2xl font-medium">{item.name}</p>
              <p className="mt-1 text-xl text-black/65">{item.role}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-10 flex flex-col gap-5 text-2xl text-[var(--landing-muted)] md:flex-row md:items-center md:justify-between">
        <p>
          One Calendar supports over <span className="text-white">20,000</span> product teams.
        </p>
        <a href="#" className="transition hover:-translate-y-0.5 hover:text-white" aria-label="Read customer stories">
          Customer stories →
        </a>
      </div>
    </section>
  );
}
