"use client"

import { useParams } from "next/navigation"
import SharedEventView from "@/components/SharedEvent"

export default function SharePage() {
  const params = useParams()
  
  return <SharedEventView shareId={params.id as string} />
}
