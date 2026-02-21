const features = [
  {
    title: "Fast planning",
    description: "Drag, resize, and edit events inline without disruptive modal-heavy flows.",
    icon: <path d="M4 10h24M8 4v8m16-8v8M5 18h22M5 24h12" />,
  },
  {
    title: "Privacy by default",
    description: "No analytics scripts by default, with optional end-to-end encrypted data handling.",
    icon: <path d="M16 4 6 9v7c0 6 4 9 10 12 6-3 10-6 10-12V9L16 4Zm0 8v7m-3-4h6" />,
  },
  {
    title: "Open and portable",
    description: "Import/export with .ics, .json, .csv and keep full control over your calendar data.",
    icon: <path d="M16 4v16m0 0-5-5m5 5 5-5M5 26h22" />,
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="border-y border-white/10 py-16 md:py-20">
      <div className="mb-10 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--landing-subtle)]">Core capabilities</p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight text-white md:text-5xl">Designed for clarity, control, and speed</h2>
      </div>

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
