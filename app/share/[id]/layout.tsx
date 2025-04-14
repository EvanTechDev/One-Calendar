import type { Metadata } from "next"
import { ReactNode } from "react"

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/share?id=${params.id}`, {
    cache: "no-store",
  })

  if (!res.ok) {
    return { title: "One Calendar" }
  }

  const result = await res.json()

  try {
    const event = typeof result.data === "object" ? result.data : JSON.parse(result.data)
    const eventTitle = event?.title || "Untitled"
    return {
      title: `${eventTitle} | One Calendar`,
    }
  } catch (err) {
    return { title: "One Calendar" }
  }
}

export default function ShareLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
