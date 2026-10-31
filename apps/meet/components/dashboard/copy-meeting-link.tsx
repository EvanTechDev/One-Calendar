'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@zntr/ui/button'

export function CopyMeetingLink({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${roomId}`)
      setCopied(true)
      toast.success('Meeting link copied')
    } catch {
      setCopied(false)
      toast.error('Could not copy the link. Please try again.')
    }
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={copy}
      aria-label={`Copy link for ${roomId}`}
      title={copied ? 'Link copied' : 'Copy meeting link'}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  )
}
