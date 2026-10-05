import Link from 'next/link'
import {
  Calendar,
  Repeat2,
  Video,
  Download,
  Clock3,
  Users,
  ShieldCheck,
  Search,
  Plug,
  Bell,
  Monitor,
} from 'lucide-react'
import { AssistantIcon } from './assistant-icon'

const icons = {
  calendar: Calendar,
  repeat: Repeat2,
  video: Video,
  download: Download,
  clock: Clock3,
  users: Users,
  ai: AssistantIcon,
  privacy: ShieldCheck,
  search: Search,
  plug: Plug,
  bell: Bell,
  monitor: Monitor,
}

export function TopicCards({ children }: { children: React.ReactNode }) {
  return <div className="topic-grid not-prose">{children}</div>
}

export function TopicCard({
  title,
  href,
  icon,
  children,
}: {
  title: string
  href: string
  icon: keyof typeof icons
  children: React.ReactNode
}) {
  const Icon = icons[icon]
  return (
    <Link href={href} className="topic-card">
      <div className="topic-card-art">
        <Icon
          width={23}
          height={23}
          strokeWidth={icon === 'ai' ? 1.6 : 1.8}
          aria-hidden
        />
      </div>
      <div className="topic-card-copy">
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </Link>
  )
}
