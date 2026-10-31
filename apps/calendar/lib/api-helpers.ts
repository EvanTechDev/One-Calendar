import { getServerSession } from '@/features/auth/server'
export { decryptEvent } from '@/features/events/crypto'

export async function getAuthedUser() {
  const session = await getServerSession()
  if (!session?.user) return null
  return session.user
}
