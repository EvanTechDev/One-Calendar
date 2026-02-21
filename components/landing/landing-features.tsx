const features = [
  {
    title: "Smart scheduling",
    description: "Auto-arrange focus blocks and meetings based on your team priorities.",
    icon: <path d="M4 9h24M4 16h24M9 4v10M22 4v10M7 23h8" />,
  },
  {
    title: "Cross-platform sync",
    description: "Keep Google Calendar, Outlook, and iCal in sync without manual cleanup.",
    icon: <path d="M6 9h9l3-4 8 12h-9l-3 4L6 9Zm0 0h7m13 8h-7" />,
  },
  {
    title: "Focus analytics",
    description: "Track meeting load, deep-work hours, and planning quality week by week.",
    icon: <path d="M5 24h22M9 20V9m7 11V6m7 14v-8" />,
  },
];

export function LandingFeatures() {
  return (
    <section className="border-y border-white/10 py-16 md:py-20">
      <div className="grid gap-8 md:grid-cols-3 md:gap-0">
        {features.map((feature, index) => (
          <article key={feature.title} className={`px-0 md:px-8 ${index !== 2 ? "md:border-r md:border-white/10" : ""}`}>
            <svg
              viewBox="0 0 32 32"
              aria-hidden="true"
              className="mb-5 h-9 w-9 stroke-white"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {feature.icon}
            </svg>
            <h3 className="text-xl font-medium text-white">{feature.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--landing-subtle)]">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
