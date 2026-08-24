import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'
import type { AuthSession } from '@zntr/auth'

export async function getServerSession(): Promise<AuthSession | null> {
  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    })
    return session as AuthSession | null
  } catch {
    // Auth is optional for meetings — guests join with a typed name.
    return null
  }
}
