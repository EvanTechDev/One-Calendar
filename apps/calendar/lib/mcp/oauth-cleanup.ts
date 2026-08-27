import { lt } from 'drizzle-orm'
import { deviceCode, oauthClientAssertion } from '@zntr/auth/schema'
import { getDb } from '@/lib/drizzle/client'

export async function cleanupExpiredOAuthState(now = new Date()) {
  return getDb().transaction(async (tx) => {
    const expiredDeviceCodes = await tx
      .delete(deviceCode)
      .where(lt(deviceCode.expiresAt, now))
      .returning({ id: deviceCode.id })
    const expiredAssertions = await tx
      .delete(oauthClientAssertion)
      .where(lt(oauthClientAssertion.expiresAt, now))
      .returning({ id: oauthClientAssertion.id })

    return {
      deviceCodes: expiredDeviceCodes.length,
      clientAssertions: expiredAssertions.length,
    }
  })
}
