import { LandingTitle } from "./title";

type Item = {
  title: string;
  detail: string;
  icon: string;
};

const useCases: Item[] = [
  {
    title: "Deep work planning for individuals",
    detail:
      "Protect focus time with intentional blocks, reminders, and weekly structure so important work is not displaced by reactive scheduling.",
    icon: "M6 17h20M6 23h12M8 7h16M12 3v8m8-8v8",
  },
  {
    title: "Small team release coordination",
    detail:
      "Align launch prep, design checkpoints, QA windows, and retrospectives on a single timeline to reduce execution overhead.",
    icon: "M4 16h24M8 8h16M8 24h16M12 8v16m8-16v16",
  },
  {
    title: "Study and exam scheduling",
    detail:
      "Convert long learning goals into daily actions and track classes, revision windows, and deadlines with predictable cadence.",
    icon: "M8 5h16a2 2 0 0 1 2 2v18l-5-3-5 3-5-3-5 3V7a2 2 0 0 1 2-2Z",
  },
  {
    title: "Cross-time-zone collaboration",
    detail:
      "Find realistic overlap times quickly and keep recurring meetings stable for globally distributed collaborators.",
    icon: "M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm0 4v8l5 3",
  },
  {
    title: "Content production pipeline",
    detail:
      "Map ideation, drafting, review, publication, and follow-up analysis as one connected production flow.",
    icon: "M5 6h22v20H5zM9 11h14M9 16h14M9 21h9",
  },
  {
    title: "Family and life operations",
    detail:
      "Coordinate appointments, school events, travel windows, and household plans in one dependable system.",
    icon: "M6 25V11l10-7 10 7v14M12 25v-8h8v8",
  },
];

const principles: Item[] = [
  {
    title: "Simplicity by default",
    detail: "Keep first-view information clear and calm so users focus on decisions, not interface noise.",
    icon: "M6 9h20M6 16h20M6 23h12",
  },
  {
    title: "Portability by default",
    detail: "Preserve user freedom with reliable import/export and avoid system-level lock-in.",
    icon: "M16 5v18m0 0-6-6m6 6 6-6M6 27h20",
  },
  {
    title: "Auditability by default",
    detail: "Use an open implementation that can be inspected, discussed, and improved by the community.",
    icon: "M5 8h22v16H5zM11 14h10M11 19h7",
  },
  {
    title: "Privacy by default",
    detail: "Treat privacy as baseline product behavior, not as a premium feature toggle.",
    icon: "M16 4 7 8v7c0 6 4 9 9 12 5-3 9-6 9-12V8l-9-4Zm0 8v5",
  },
  {
    title: "Speed by default",
    detail: "Enable high-frequency workflows with keyboard-first interaction and low-friction editing.",
    icon: "M4 10h24v12H4zM8 14h3m3 0h10m-13 4h9",
  },
  {
    title: "Scalability by default",
    detail: "Support smooth growth from personal planning routines to structured team coordination.",
    icon: "M7 24h18M10 24V8m6 16V5m6 19v-9",
  },
];

function RowItem({ item }: { item: Item }) {
  return (
    <article className="flex items-start gap-4 border-b border-white/10 py-5 last:border-b-0">
      <span className="rounded-md border border-white/15 bg-white/[0.03] p-2">
        <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5 w-5 stroke-white" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d={item.icon} />
        </svg>
      </span>
      <div>
        <LandingTitle as="h3" className="text-lg font-medium text-white">{item.title}</LandingTitle>
        <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)] md:text-base">{item.detail}</p>
      </div>
    </article>
  );
}

export function LandingDeepDive() {
  return (
    <section id="deep-dive" className="border-b border-white/10 py-24 md:py-28">
      <LandingTitle as="h2" className="text-3xl font-semibold leading-tight text-white md:text-5xl">
        More complete real-world scenarios
        <br />
        and product direction
      </LandingTitle>
      <p className="mt-4 max-w-3xl text-base text-[var(--landing-muted)] md:text-lg">
        One Calendar is more than event storage. It is a practical scheduling system for sustained focus,
        coordinated execution, and consistent long-term planning.
      </p>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <div>
          <LandingTitle as="h3" className="text-2xl font-semibold text-white md:text-3xl">Real-world scenarios</LandingTitle>
          <div className="mt-4">
            {useCases.map((item) => (
              <RowItem key={item.title} item={item} />
            ))}
          </div>
        </div>

        <div>
          <LandingTitle as="h3" className="text-2xl font-semibold text-white md:text-3xl">Product principles</LandingTitle>
          <div className="mt-4">
            {principles.map((item) => (
              <RowItem key={item.title} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
