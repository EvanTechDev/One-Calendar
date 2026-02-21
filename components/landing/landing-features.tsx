const features = [
  {
    fig: "FIG 0.2",
    title: "Built for purpose",
    description: "One Calendar is shaped by the practices and principles of world-class product teams.",
    icon: (
      <path d="M16 3 4 9v12l12 8 12-8V9L16 3Zm0 0v10M4 9l12 7 12-7M4 15l12 7 12-7" />
    ),
  },
  {
    fig: "FIG 0.3",
    title: "Powered by AI agents",
    description: "Designed for workflows shared by humans and agents, from strategy to release.",
    icon: (
      <path d="M6 20V9l7-4 7 4v11l-7 4-7-4Zm7-15v19M6 9l7 4 7-4M6 20l7-4 7 4" />
    ),
  },
  {
    fig: "FIG 0.4",
    title: "Designed for speed",
    description: "Reduces noise and restores momentum so teams ship with high velocity and focus.",
    icon: (
      <path d="M5 24V9l14-7v15M8 22V11l14-7v15M11 20V13l14-7v15M14 18v-3l14-7v15" />
    ),
  },
];

export function LandingFeatures() {
  return (
    <section className="border-b border-white/10 py-20">
      <h2 className="max-w-6xl text-4xl font-medium leading-tight text-white md:text-6xl">
        A new species of product tool. Purpose-built for modern teams with AI workflows at its core.
      </h2>
      <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-0">
        {features.map((feature, index) => (
          <article key={feature.title} className={`pr-0 md:pr-10 ${index < 2 ? "md:border-r md:border-white/10" : ""} ${index > 0 ? "md:pl-10" : ""}`}>
            <p className="mb-5 text-sm tracking-[0.18em] text-[var(--landing-subtle)]">{feature.fig}</p>
            <svg
              viewBox="0 0 32 32"
              aria-hidden="true"
              className="h-40 w-full stroke-white/65"
              fill="none"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {feature.icon}
            </svg>
            <h3 className="mt-8 text-3xl font-medium text-white">{feature.title}</h3>
            <p className="mt-4 text-xl leading-relaxed text-[var(--landing-muted)]">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
