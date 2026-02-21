"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { LandingTitle } from "./landing-title";

type DemoEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  tone: string;
  accent: string;
};

const demoEvents: DemoEvent[] = [
  { id: "1", title: "Design review", start: "10:00", end: "10:45", tone: "bg-[#1a2430]", accent: "#6ea8ff" },
  { id: "2", title: "Roadmap sync", start: "13:30", end: "14:15", tone: "bg-[#1a2a22]", accent: "#5bcf9a" },
  { id: "3", title: "Focus block", start: "15:00", end: "17:00", tone: "bg-[#261f33]", accent: "#b18cff" },
  { id: "4", title: "Release review", start: "17:30", end: "18:00", tone: "bg-[#31201f]", accent: "#ffab8a" },
];

const encryptedRows = [
  ["2nd49snxieNwi29Dnejs", "4fK29xneJ2qLs09PzVaa"],
  ["A0zX19pwQm7RtL2he81n", "n0Mqe28XvLp31sTTad90"],
  ["dN7qa21PoxM44jvR8tyk", "Qv4mL2zPaa11Nwe8sX0t"],
  ["T7ePq82sLmN4xR3vA11f", "zP8wN2kLmQ1vD45sA0xe"],
];

function WeekViewEventBlock({ event }: { event: DemoEvent }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg p-2 text-sm", event.tone)}>
      <div className="absolute left-0 top-0 h-full w-1 rounded-l-md" style={{ backgroundColor: event.accent }} />
      <div className="pl-1">
        <p className="font-medium leading-tight" style={{ color: event.accent }}>{event.title}</p>
        <p className="text-xs" style={{ color: event.accent }}>{event.start} - {event.end}</p>
      </div>
    </div>
  );
}

export function LandingHeroDemo() {
  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-xl border border-white/10 bg-[var(--landing-panel)] p-4">
        <LandingTitle as="p" className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--landing-subtle)]">Week View</LandingTitle>
        <div className="space-y-2">
          {demoEvents.map((event) => <WeekViewEventBlock key={event.id} event={event} />)}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[var(--landing-panel)] p-4">
        <LandingTitle as="p" className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--landing-subtle)]">Encrypted Stream</LandingTitle>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 text-xs text-[var(--landing-muted)]">
          {encryptedRows.map((row, idx) => (
            <Fragment key={`${row[0]}-${idx}`}>
              <div className="rounded-md border border-white/10 bg-black/20 px-2 py-2 font-mono text-[11px] text-white/75">{row[0]}</div>
              <div className="w-px bg-white/20" />
              <div className="rounded-md border border-white/10 bg-black/10 px-2 py-2 font-mono text-[11px] text-white/75">{row[1]}</div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
