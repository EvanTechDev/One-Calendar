"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

type DemoEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  tone: string;
  accent: string;
};

const demoEvents: DemoEvent[] = [
  {
    id: "1",
    title: "Design review",
    start: "10:00",
    end: "10:45",
    tone: "bg-[#1a2430]",
    accent: "#6ea8ff",
  },
  {
    id: "2",
    title: "Roadmap sync",
    start: "13:30",
    end: "14:15",
    tone: "bg-[#1a2a22]",
    accent: "#5bcf9a",
  },
  {
    id: "3",
    title: "Focus block",
    start: "15:00",
    end: "17:00",
    tone: "bg-[#261f33]",
    accent: "#b18cff",
  },
];

const encryptedRows = [
  {
    cipher: "A9F4-77C1-98D2-E31B",
    plain: "Project roadmap planning",
  },
  {
    cipher: "7B22-4D11-C0EF-6A8A",
    plain: "Design review with team",
  },
  {
    cipher: "EE91-23AA-44B8-90F2",
    plain: "Focus block: implementation",
  },
];

function WeekViewEventBlock({ event }: { event: DemoEvent }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg p-2 text-sm", event.tone)}>
      <div className="absolute left-0 top-0 h-full w-1 rounded-l-md" style={{ backgroundColor: event.accent }} />
      <div className="pl-1">
        <p className="font-medium leading-tight" style={{ color: event.accent }}>
          {event.title}
        </p>
        <p className="text-xs" style={{ color: event.accent }}>
          {event.start} - {event.end}
        </p>
      </div>
    </div>
  );
}

export function LandingHeroDemo() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-xl border border-white/10 bg-[var(--landing-panel)] p-4">
        <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--landing-subtle)]">Week View</p>
        <div className="space-y-2">
          {demoEvents.map((event) => (
            <WeekViewEventBlock key={event.id} event={event} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[var(--landing-panel)] p-4">
        <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--landing-subtle)]">Encrypted vs Plain</p>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 text-xs text-[var(--landing-muted)]">
          <div className="mb-1 uppercase tracking-[0.12em]">Encrypted</div>
          <div className="opacity-0">|</div>
          <div className="mb-1 uppercase tracking-[0.12em]">Readable</div>

          {encryptedRows.map((row) => (
            <Fragment key={row.cipher}>
              <div className="rounded-md border border-white/10 bg-black/20 px-2 py-2 font-mono text-[11px] text-white/75">
                {row.cipher}
              </div>
              <div className="w-px bg-white/20" />
              <div className="rounded-md border border-white/10 bg-black/10 px-2 py-2 text-[11px] text-white/85">
                {row.plain}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
