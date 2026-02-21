"use client";

import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const upcoming = [
  { title: "Design review", time: "10:00 - 10:45" },
  { title: "Product sync", time: "13:30 - 14:00" },
  { title: "Focus block", time: "15:00 - 17:00" },
];

export function LandingHeroDemo() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="border border-white/10 bg-[var(--landing-panel)] text-white ring-0">
        <CardHeader>
          <CardTitle className="text-sm text-white">Mini Calendar</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
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
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-[var(--landing-panel)] text-white ring-0">
        <CardHeader>
          <CardTitle className="text-sm text-white">Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          {upcoming.map((item) => (
            <div key={item.title} className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-sm text-white">{item.title}</p>
              <p className="text-xs text-[var(--landing-muted)]">{item.time}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
