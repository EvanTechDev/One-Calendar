import { getServerSession } from '@/lib/auth/server'
export { decryptEvent } from '@/lib/events/crypto'

export async function getAuthedUser() {
  const session = await getServerSession()
  if (!session?.user) return null
  return session.user
}
