import type { SVGProps } from 'react'

// Same mark as apps/calendar/components/app/ai/assistant-icon.tsx.
export function AssistantIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="8" y="8" width="8" height="8" rx="2.5" />
      <path d="M19.5 9a8 8 0 0 1-10.5 10.5M4.5 15A8 8 0 0 1 15 4.5" />
      <circle cx="18.5" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="18.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
