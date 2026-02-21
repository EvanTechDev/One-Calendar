import { LandingTitle } from "./title";

const features = [
  {
    title: "Fast planning",
    description: "Drag, resize, and edit events inline without modal-heavy flow.",
    icon: <path d="M4 10h24M8 4v8m16-8v8M5 18h22M5 24h12" />,
  },
  {
    title: "Privacy by default",
    description: "No analytics scripts by default with optional end-to-end encryption.",
    icon: <path d="M16 4 6 9v7c0 6 4 9 10 12 6-3 10-6 10-12V9L16 4Zm0 8v7m-3-4h6" />,
  },
  {
    title: "Open and portable",
    description: "Import/export with .ics, .json, and .csv while keeping full control.",
    icon: <path d="M16 4v16m0 0-5-5m5 5 5-5M5 26h22" />,
  },
  {
    title: "Multi-view workflow",
    description: "Switch between day, week, month, and year perspectives without losing context.",
    icon: <path d="M5 8h22M5 16h22M5 24h22M10 4v24M22 4v24" />,
  },
  {
    title: "Keyboard-first speed",
    description: "Navigate and edit quickly with shortcuts designed for high-frequency planning.",
    icon: <path d="M4 9h24v14H4zM8 13h4m4 0h8m-14 4h12" />,
  },
  {
    title: "Cross-device consistency",
    description: "A consistent experience across desktop and mobile layouts for daily reliability.",
    icon: <path d="M10 5h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm4 15h4" />,
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="border-y border-white/10 py-24 md:py-28">
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
        <LandingTitle as="h2" className="text-3xl font-semibold leading-tight text-white md:text-5xl">
          Fast planning.
          <br />
          Less noise.
        </LandingTitle>
        <p className="max-w-xl text-base text-[var(--landing-muted)] md:text-lg">
          Every interaction is designed to keep flow intact: fast edits, secure defaults, and formats that remain portable across tools.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-xl border border-white/10 p-6">
            <svg viewBox="0 0 32 32" aria-hidden="true" className="mb-5 h-9 w-9 stroke-white" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {feature.icon}
            </svg>
            <LandingTitle as="h3" className="text-xl font-medium text-white">{feature.title}</LandingTitle>
            <p className="mt-3 text-sm leading-relaxed text-[var(--landing-subtle)]">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
