import { getDb } from '@/lib/drizzle/client'
import { mcpApiKeys, mcpSettings } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { ALL_SCOPES, type McpAuthUser } from './types'

const KEY_PREFIX = 'zc_'
const KEY_PREFIX_LENGTH = 12

export async function verifyApiKey(key: string): Promise<McpAuthUser | null> {
  if (!key.startsWith(KEY_PREFIX)) return null

  const db = await getDb()
  const keys = await db
    .select()
    .from(mcpApiKeys)
    .where(
      and(
        eq(mcpApiKeys.isActive, true),
        eq(mcpApiKeys.keyPrefix, key.slice(0, KEY_PREFIX_LENGTH)),
      ),
    )

  for (const row of keys) {
    const match = await bcrypt.compare(key, row.keyHash)
    if (!match) continue

    await db
      .update(mcpApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(mcpApiKeys.id, row.id))

    const enabled = await isMcpEnabled(row.userId)
    if (!enabled) return null

    const userInfo = await getUserNameAndEmail(row.userId)

    return {
      userId: row.userId,
      email: userInfo.email,
      name: userInfo.name,
      scopes: row.scopes as string[],
      authType: 'api_key',
      keyId: row.id,
    }
  }

  return null
}

export async function getUserNameAndEmail(
  userId: string,
): Promise<{ email: string; name: string }> {
  const { user } = await import('@/lib/drizzle/schema')
  const db = await getDb()
  const [row] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId))

  return row ?? { email: '', name: '' }
}

export async function isMcpEnabled(userId: string): Promise<boolean> {
  const db = await getDb()
  const [row] = await db
    .select({ enabled: mcpSettings.enabled })
    .from(mcpSettings)
    .where(eq(mcpSettings.userId, userId))

  if (!row) return true
  return row.enabled
}

export async function generateApiKey(
  name: string,
  userId: string,
  scopes: string[],
): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex')
  const key = `${KEY_PREFIX}${raw}`
  const prefix = key.slice(0, KEY_PREFIX_LENGTH)
  const hash = await bcrypt.hash(key, 10)

  const { mcpApiKeys: keysTable } = await import('@/lib/drizzle/schema')
  const db = await getDb()
  await db.insert(keysTable).values({
    id: crypto.randomUUID(),
    userId,
    name,
    keyHash: hash,
    keyPrefix: prefix,
    scopes: scopes.length > 0 ? scopes : ALL_SCOPES,
    isActive: true,
  })

  return key
}

export async function deleteApiKey(
  keyId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDb()
  const [row] = await db
    .delete(mcpApiKeys)
    .where(and(eq(mcpApiKeys.id, keyId), eq(mcpApiKeys.userId, userId)))
    .returning({ id: mcpApiKeys.id })

  return !!row
}

export async function updateApiKeyScopes(
  keyId: string,
  userId: string,
  scopes: string[],
): Promise<boolean> {
  const db = await getDb()
  const [row] = await db
    .update(mcpApiKeys)
    .set({ scopes, updatedAt: new Date() })
    .where(and(eq(mcpApiKeys.id, keyId), eq(mcpApiKeys.userId, userId)))
    .returning()

  return !!row
}

export async function listApiKeys(userId: string) {
  const db = await getDb()
  return db
    .select({
      id: mcpApiKeys.id,
      name: mcpApiKeys.name,
      keyPrefix: mcpApiKeys.keyPrefix,
      scopes: mcpApiKeys.scopes,
      isActive: mcpApiKeys.isActive,
      lastUsedAt: mcpApiKeys.lastUsedAt,
      createdAt: mcpApiKeys.createdAt,
    })
    .from(mcpApiKeys)
    .where(eq(mcpApiKeys.userId, userId))
    .orderBy(mcpApiKeys.createdAt)
}
