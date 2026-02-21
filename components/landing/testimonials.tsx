import { LandingTitle } from "./title";

const highlights = [
  {
    icon: (
      <path d="M4 16h24M4 22h18M4 10h24M4 4h14" />
    ),
    title: "Clarity over complexity",
    detail: "A calm planning flow instead of overloaded automation and noisy dashboards.",
  },
  {
    icon: (
      <path d="M16 4 6 9v7c0 6 4 9 10 12 6-3 10-6 10-12V9L16 4Zm-3 12 2 2 4-5" />
    ),
    title: "Privacy-first defaults",
    detail: "No analytics by default, with optional end-to-end encryption for sensitive data.",
  },
  {
    icon: (
      <path d="M6 24h20M10 20V8m6 12V4m6 16v-9" />
    ),
    title: "Portable workflows",
    detail: "Import/export support keeps your data usable across ecosystems without lock-in.",
  },
  {
    icon: (
      <path d="M5 11h22M5 17h22M8 5v18m14-18v18" />
    ),
    title: "Fast team coordination",
    detail: "Weekly scheduling, quick edits, and structure that scales from solo to team use.",
  },
];

const stats = [
  { value: "35", label: "Locales" },
  { value: "5", label: "Themes" },
  { value: "3", label: "Import formats" },
  { value: "E2EE", label: "Optional" },
];

export function LandingTestimonials() {
  return (
    <section className="border-b border-white/10 py-24 md:py-28">
      <LandingTitle as="h2" className="text-center text-3xl font-semibold text-white md:text-5xl">
        Why One Calendar
      </LandingTitle>

      <div className="mt-10 grid gap-6 border-y border-white/10 py-6 md:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="text-center md:text-left">
            <p className="text-3xl font-semibold text-white">{item.value}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--landing-subtle)]">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {highlights.map((item) => (
          <article key={item.title} className="rounded-xl border border-white/10 p-5">
            <svg
              viewBox="0 0 32 32"
              aria-hidden="true"
              className="mb-4 h-7 w-7 stroke-white"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {item.icon}
            </svg>
            <LandingTitle as="h3" className="text-lg font-medium text-white md:text-xl">
              {item.title}
            </LandingTitle>
            <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)] md:text-base">{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
