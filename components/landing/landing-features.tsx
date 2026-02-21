const features = [
  {
    title: "Unified timeline",
    description: "Merge meetings, tasks, and reminders in one clear stream.",
    icon: (
      <path d="M4 8h24M8 4v8m10-6h8m-8 4h6M6 17h22M6 23h12" />
    ),
  },
  {
    title: "Smart automation",
    description: "Auto-schedule routines and reduce repetitive planning work.",
    icon: (
      <path d="M5 16l7-8 5 5 8-9M5 24h22M12 8l3-3 3 3" />
    ),
  },
  {
    title: "Instant focus",
    description: "Highlight priorities with a calm interface that keeps context.",
    icon: (
      <path d="M15 4v7m0 10v7M4 15h7m10 0h7M7 7l4 4m8 8 4 4m0-16-4 4m-8 8-4 4" />
    ),
  },
];

export function LandingFeatures() {
  return (
    <section className="border-y border-white/10 py-16 md:py-20">
      <div className="grid gap-8 md:grid-cols-3 md:gap-0">
        {features.map((feature, index) => (
          <article
            key={feature.title}
            className={`px-0 md:px-8 ${index !== 2 ? "md:border-r md:border-white/10" : ""}`}
          >
            <svg
              viewBox="0 0 32 32"
              aria-hidden="true"
              className="mb-6 h-8 w-8 stroke-white"
              fill="none"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {feature.icon}
            </svg>
            <h3 className="text-xl font-medium text-white">{feature.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--landing-subtle)]">
              {feature.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
