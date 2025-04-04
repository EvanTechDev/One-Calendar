import Calendar from "@/components/Calendar"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "One Calendar | Customize your day at your fingertips and save as much time as you want",
  description: "One Calendar is a calendar web app that uses React + Vercel/blob for storage. It has rich features: address book, notes, bookmarks, to-do lists and analysis features!",
}

export default function Home() {
  return <Calendar />
}
