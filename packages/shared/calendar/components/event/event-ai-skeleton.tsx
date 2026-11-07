import type { CSSProperties, ReactNode } from 'react'
import { Skeleton } from '@zntr/ui/skeleton'
import { cn } from '@zntr/utils'

interface EventAiSkeletonProps {
  className?: string
  children?: ReactNode
  delay?: number
}

export function EventAiSkeleton({
  className,
  children,
  delay = 0,
}: EventAiSkeletonProps) {
  return (
    <Skeleton
      aria-hidden="true"
      className={cn('event-ai-skeleton animate-none', className)}
      style={
        {
          '--event-ai-skeleton-delay': `${delay}ms`,
        } as CSSProperties
      }
    >
      {children}
    </Skeleton>
  )
}
