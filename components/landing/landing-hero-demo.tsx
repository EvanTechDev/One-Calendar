"use client";

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

const dayColumns = ["Mon", "Tue", "Wed", "Thu", "Fri"];

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
        <div className="grid grid-cols-5 gap-2">
          {dayColumns.map((day) => (
            <div key={day} className="rounded-md border border-white/10 bg-black/20 p-2 text-center text-xs text-[var(--landing-muted)]">
              {day}
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {demoEvents.map((event) => (
            <WeekViewEventBlock key={event.id} event={event} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[var(--landing-panel)] p-4">
        <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--landing-subtle)]">Planning Insights</p>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--landing-muted)]">
              <span>Focus time</span>
              <span>68%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div className="h-2 w-[68%] rounded-full bg-white/80" />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--landing-muted)]">
              <span>Meetings</span>
              <span>22%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div className="h-2 w-[22%] rounded-full bg-white/60" />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--landing-muted)]">
              <span>Buffer</span>
              <span>10%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div className="h-2 w-[10%] rounded-full bg-white/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
