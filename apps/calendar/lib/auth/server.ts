import { headers } from 'next/headers'
import { getSessionCookie } from '@zntr/auth'
import { auth } from '@/lib/auth'
import { getCachedSession, setCachedSession } from '@/lib/cache/session'

export async function getServerSession() {
  const hdrs = await headers()

  const sessionCookie = getSessionCookie(hdrs)
  if (sessionCookie) {
    const cached = await getCachedSession(sessionCookie)
    if (cached) return cached
  }

  const session = await auth.api.getSession({ headers: hdrs })
  if (session) {
    await setCachedSession(session)
  }

  return session
}
