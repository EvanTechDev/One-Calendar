import { getShareTitleForMetadata } from "@/lib/share-metadata"
import { Metadata } from "next"
import { ReactNode } from "react"

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  try {
    const eventTitle = await getShareTitleForMetadata(params.id)

    if (!eventTitle) throw new Error("Missing metadata title")

    return {
      title: `${eventTitle} | One Calendar`,
      icons: {
        icon: "/icon.svg",
      },
    }
  } catch (err) {
    console.error("[generateMetadata error]", err)
    return {
      title: "One Calendar",
      icons: {
        icon: "/icon.svg",
      },
    }
  }
}

export default function ShareLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
