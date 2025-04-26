import { Metadata } from "next"
import { ReactNode } from "react"

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const res = await fetch(`${baseUrl}/api/share?id=${params.id}`, {
      cache: "no-store",
    })

    if (!res.ok) throw new Error("Failed to fetch shared event")

    const result = await res.json()

    if (!result.success || !result.data) throw new Error("Invalid share data")

    const event = typeof result.data === "object" ? result.data : JSON.parse(result.data)
    const eventTitle = typeof event.title === "string" ? event.title : "Untitled"

    return {
      title: `${eventTitle} | One Calendar`,
    }
  } catch (err) {
    console.error("[generateMetadata error]", err)
    return {
      title: "One Calendar",
    }
  }
}

export default function ShareLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
