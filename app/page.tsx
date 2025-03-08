import Calendar from "@/components/Calendar"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "One Calendar",
  description: "A Calendar-inspired calendar application",
}

export default function Home() {
  return <Calendar />
}

