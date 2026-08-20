'use client'

import { authClient } from '@/lib/auth/client'
import { cn } from '@zntr/utils'

interface EventInvite {
  email: string
  userName: string | null
  userImage: string | null
}

interface EventOrganizer {
  name: string
  email: string
  image: string | null
}

export interface ParticipantAvatarsProps {
  invites?: EventInvite[]
  organizer?: EventOrganizer | null
  /** Avatar diameter in px. Kept small so it sits inside a line of title text. */
  size?: number
  className?: string
}

const MAX_AVATARS = 3

function initialOf(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email
  return source.charAt(0).toUpperCase()
}

/**
 * Overlapping participant avatars shown before an event block's title.
 *
 * Includes the organizer, excludes the viewer (you already know you are in
 * your own event), and caps at three faces. Each avatar is nudged left over
 * its predecessor so roughly half of every face stays visible — enough to
 * recognise who is attending without stealing width from the title.
 *
 * Renders nothing when there is nobody else to show, so event blocks without
 * participants keep their current layout exactly.
 */
export default function ParticipantAvatars({
  invites,
  organizer,
  size = 14,
  className,
}: ParticipantAvatarsProps) {
  const { data: session } = authClient.useSession()
  const viewerEmail = session?.user?.email?.toLowerCase()

  const people: Array<{ key: string; label: string; image: string | null }> = []
  const seen = new Set<string>()

  const push = (
    email: string,
    name: string | null | undefined,
    image: string | null,
  ) => {
    const key = email.trim().toLowerCase()
    if (!key || key === viewerEmail || seen.has(key)) return
    seen.add(key)
    people.push({ key, label: initialOf(name, email), image })
  }

  // Organizer first: they anchor the group visually.
  if (organizer?.email) {
    push(organizer.email, organizer.name, organizer.image)
  }
  for (const invite of invites ?? []) {
    push(invite.email, invite.userName, invite.userImage)
  }

  if (people.length === 0) return null

  const shown = people.slice(0, MAX_AVATARS)
  const overlap = Math.round(size * 0.45)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center align-middle',
        className,
      )}
      aria-label={`${people.length} participant${people.length === 1 ? '' : 's'}`}
    >
      {shown.map((person, index) => (
        <span
          key={person.key}
          className="relative inline-flex items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-background"
          style={{
            width: size,
            height: size,
            marginLeft: index === 0 ? 0 : -overlap,
            // Later avatars sit on top, so each face covers the right half of
            // the one before it.
            zIndex: index + 1,
          }}
          title={person.key}
        >
          {person.image ? (
            // Plain img: these render inside absolutely-positioned event blocks
            // in large numbers, so we skip next/image's wrapper overhead.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.image}
              alt=""
              width={size}
              height={size}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span
              className="font-medium text-muted-foreground"
              style={{ fontSize: Math.max(7, Math.round(size * 0.6)) }}
            >
              {person.label}
            </span>
          )}
        </span>
      ))}
    </span>
  )
}
