"use client";

import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type DemoEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  accent: string;
};

const demoEvents: DemoEvent[] = [
  {
    id: "1",
    title: "Design review",
    start: "10:00",
    end: "10:45",
    color: "bg-[#E6F6FD]",
    accent: "#3B82F6",
  },
  {
    id: "2",
    title: "Roadmap sync",
    start: "13:30",
    end: "14:15",
    color: "bg-[#E7F8F2]",
    accent: "#10B981",
  },
  {
    id: "3",
    title: "Focus block",
    start: "15:00",
    end: "17:00",
    color: "bg-[#F3EEFE]",
    accent: "#8B5CF6",
  },
];

function WeekViewEventBlock({ event }: { event: DemoEvent }) {
  return (
    <div className={cn("relative rounded-lg p-2 text-sm overflow-hidden", event.color)}>
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
    <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="rounded-xl border border-white/10 bg-[var(--landing-panel)] p-3">
        <p className="mb-2 px-1 text-xs uppercase tracking-[0.14em] text-[var(--landing-subtle)]">Mini Calendar</p>
        <Calendar
          mode="single"
          selected={new Date()}
          className="rounded-lg border border-white/10 bg-black/20 p-2"
          classNames={{
            caption_label: "text-white",
            head_cell: "text-[var(--landing-subtle)] rounded-md w-8 font-normal text-[0.75rem]",
            day: "h-8 w-8 rounded-md text-sm text-[var(--landing-muted)] hover:bg-white/10 hover:text-white",
            day_selected: "bg-white text-black hover:bg-white/90",
            day_today: "bg-white/15 text-white",
          }}
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-[var(--landing-panel)] p-3">
        <p className="mb-3 px-1 text-xs uppercase tracking-[0.14em] text-[var(--landing-subtle)]">Week View Schedule</p>
        <div className="space-y-2">
          {demoEvents.map((event) => (
            <WeekViewEventBlock key={event.id} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}
