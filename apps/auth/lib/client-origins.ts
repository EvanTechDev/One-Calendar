import { clientOriginsFromRedirectUris } from '@zntr/auth/return-to'
import { oauthClient } from '@zntr/auth'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle'

/**
 * Origins belonging to registered, enabled clients.
 *
 * Read from the database rather than an environment variable so that becoming a
 * valid return target requires being a registered client. Two sources of truth
 * for "which origins do we trust" is how one of them ends up stale and the other
 * ends up permissive.
 *
 * Disabled clients are excluded: disabling a client must actually stop it being a
 * destination, or "disabled" means nothing.
 */
export async function registeredClientOrigins(): Promise<string[]> {
  try {
    const rows = await getDb()
      .select({ redirectUris: oauthClient.redirectUris })
      .from(oauthClient)
      .where(eq(oauthClient.disabled, false))

    const uris: string[] = []
    for (const row of rows) {
      // Stored as jsonb, so a row could hold anything a past writer put there.
      // Non-strings are dropped rather than coerced — a coerced value could
      // parse as a URL and widen the allowlist.
      if (Array.isArray(row.redirectUris)) {
        for (const uri of row.redirectUris) {
          if (typeof uri === 'string') uris.push(uri)
        }
      }
    }
    return clientOriginsFromRedirectUris(uris)
  } catch {
    // Fail closed. An unreachable database means no origin can be verified, and
    // returning an empty list makes every absolute return URL resolve to the
    // portal's own default rather than being trusted unchecked.
    return []
  }
}
