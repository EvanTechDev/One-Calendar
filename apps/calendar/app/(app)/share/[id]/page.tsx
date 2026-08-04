'use client'

import SharedEventView from '@/components/app/share/shared-event'
import { useParams } from 'next/navigation'

export default function SharePage() {
  const params = useParams()

  return <SharedEventView shareId={params.id as string} />
}
