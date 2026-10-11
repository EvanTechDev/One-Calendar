import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

/**
 * The session for the current request.
 *
 * Reads through Better Auth to the database on every call. A Redis-backed
 * session cache once sat in front of this and was removed: when the cache was
 * unreachable it blocked for ioredis' full 10s connect timeout on the way to
 * the fallback, so every authenticated request paid for the cache that was
 * supposed to save it.
 */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() })
}
