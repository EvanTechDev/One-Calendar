import Link from 'next/link'
import {
  CalendarDays,
  Repeat2,
  Video,
  Download,
  Clock3,
  Users,
  Sparkles,
  ShieldCheck,
  Search,
  Plug,
  Bell,
  Monitor,
} from 'lucide-react'

const icons = {
  calendar: CalendarDays,
  repeat: Repeat2,
  video: Video,
  download: Download,
  clock: Clock3,
  users: Users,
  ai: Sparkles,
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
        <Icon size={23} strokeWidth={1.8} aria-hidden />
      </div>
      <div className="topic-card-copy">
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </Link>
  )
}
