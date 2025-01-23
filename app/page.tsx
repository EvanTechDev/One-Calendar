import Calendar from "@/components/Calendar"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "One Calendar",
  description: "A simple calendar app with notifications and ICS import/export",
}

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">One Calendar</h1>
      <Calendar />
    </main>
  )
}

