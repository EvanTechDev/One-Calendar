import { LandingTitle } from "./title";

const useCases = [
  {
    title: "Deep work planning for individuals",
    detail:
      "Use focus blocks, reminders, and weekly planning to protect meaningful work and reduce context-switching from unplanned meetings.",
  },
  {
    title: "Small team release coordination",
    detail:
      "Run launch timelines, design reviews, retrospectives, and milestone checks on one shared timeline with less operational noise.",
  },
  {
    title: "Study and exam scheduling",
    detail:
      "Break long-term goals into daily executable events, then track classes, assignments, revision windows, and exam deadlines across months.",
  },
  {
    title: "Cross-time-zone collaboration",
    detail:
      "Quickly find realistic meeting windows across regions and keep recurring coordination predictable for distributed teams.",
  },
  {
    title: "Content production pipeline",
    detail:
      "Map ideation, writing, design, review, publishing, and post-launch analysis as one continuous flow to avoid delivery bottlenecks.",
  },
  {
    title: "Family and life operations",
    detail:
      "Manage appointments, school activities, travel plans, and household commitments in a single view so critical events are not missed.",
  },
];

const principles = [
  "Simplicity by default: keep first-view information clean and distraction-free.",
  "Portability by default: always support import/export and avoid platform lock-in.",
  "Auditability by default: open implementation that can be reviewed by the community.",
  "Privacy by default: privacy-first design as a baseline, not a premium add-on.",
  "Speed by default: keyboard shortcuts and low-friction editing for high-frequency workflows.",
  "Scalability by default: grow smoothly from personal planning to team-level coordination.",
];

export function LandingDeepDive() {
  return (
    <section id="deep-dive" className="border-b border-white/10 py-24 md:py-28">
      <LandingTitle as="h2" className="text-3xl font-semibold leading-tight text-white md:text-5xl">
        More complete real-world scenarios
        <br />
        and product direction
      </LandingTitle>
      <p className="mt-4 max-w-3xl text-base text-[var(--landing-muted)] md:text-lg">
        One Calendar is more than a place to store events. It is a practical time operating system for individual focus,
        team execution, and long-term planning continuity.
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {useCases.map((item) => (
          <article key={item.title} className="rounded-xl border border-white/10 bg-white/[0.015] p-5">
            <LandingTitle as="h3" className="text-lg font-medium text-white">{item.title}</LandingTitle>
            <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)] md:text-base">{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="mt-14">
        <LandingTitle as="h3" className="text-2xl font-semibold text-white md:text-3xl">Product principles</LandingTitle>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {principles.map((item) => (
            <li key={item} className="rounded-lg border border-white/10 px-4 py-3 text-sm text-[var(--landing-muted)] md:text-base">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
