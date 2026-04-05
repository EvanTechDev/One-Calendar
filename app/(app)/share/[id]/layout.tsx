import { Metadata } from "next"
import { headers } from "next/headers"
import { ReactNode } from "react"

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const fallbackMetadata: Metadata = {
    title: "One Calendar",
    icons: {
      icon: "/icon.svg",
    },
  }

  try {
    const headerStore = await headers()
    const forwardedHost = headerStore.get("x-forwarded-host")
    const host = forwardedHost || headerStore.get("host")
    const protocol = headerStore.get("x-forwarded-proto") || "https"
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${protocol}://${host}` : "http://localhost:3000")
    const res = await fetch(`${baseUrl}/api/share?id=${params.id}`, {
      cache: "no-store",
    })

    if (res.status === 401) {
      const result = await res.json().catch(() => null)
      if (result?.requiresPassword) {
        return {
          title: "Protected | One Calendar",
          icons: {
            icon: "/icon.svg",
          },
        }
      }
      return fallbackMetadata
    }

    if (!res.ok) {
      return fallbackMetadata
    }

    const result = await res.json()

    if (!result.success || !result.data) {
      return fallbackMetadata
    }

    const event = typeof result.data === "object" ? result.data : JSON.parse(result.data)
    const eventTitle = typeof event.title === "string" ? event.title : "Untitled"

    return {
      title: `${eventTitle} | One Calendar`,
      icons: {
        icon: "/icon.svg",
      },
    }
  } catch {
    return fallbackMetadata
  }
}

export default function ShareLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
