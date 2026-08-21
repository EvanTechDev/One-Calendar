import { getDb } from '@/lib/drizzle/client'
import {
  mcpApiKeys,
  mcpOauthClients,
  mcpTokens,
  mcpSettings,
} from '@/lib/drizzle/schema'
import { eq, and, gte } from 'drizzle-orm'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { type McpAuthUser, ALL_SCOPES, McpAuthError } from './types'

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

export async function verifyOAuthToken(
  token: string,
): Promise<McpAuthUser | null> {
  const hash = hashToken(token)
  const db = await getDb()

  const [row] = await db
    .select()
    .from(mcpTokens)
    .where(
      and(
        eq(mcpTokens.tokenHash, hash),
        eq(mcpTokens.isRevoked, false),
        gte(mcpTokens.expiresAt, new Date()),
      ),
    )

  if (!row) return null

  const enabled = await isMcpEnabled(row.userId)
  if (!enabled) return null

  const userInfo = await getUserNameAndEmail(row.userId)

  return {
    userId: row.userId,
    email: userInfo.email,
    name: row.clientName,
    scopes: row.scopes as string[],
    authType: 'oauth',
    keyId: row.id,
  }
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

const CLIENT_PREFIX = 'oc_'

export interface OAuthClientMetadata {
  redirect_uris: string[]
  token_endpoint_auth_method?: string
  grant_types?: string[]
  response_types?: string[]
  client_name?: string
  client_uri?: string
  logo_uri?: string
  scope?: string
  contacts?: string[]
  tos_uri?: string
  policy_uri?: string
  jwks_uri?: string
  jwks?: unknown
  software_id?: string
  software_version?: string
}

export interface RegisteredOAuthClient {
  clientId: string
  clientSecret?: string
  clientIdIssuedAt: number
  clientSecretExpiresAt?: number
}

export async function registerOAuthClient(
  metadata: OAuthClientMetadata,
): Promise<RegisteredOAuthClient> {
  const db = await getDb()

  const redirectUris = validateRedirectUris(metadata.redirect_uris)

  const grantTypes =
    metadata.grant_types && metadata.grant_types.length > 0
      ? metadata.grant_types
      : ['authorization_code', 'refresh_token']

  const responseTypes =
    metadata.response_types && metadata.response_types.length > 0
      ? metadata.response_types
      : ['code']

  const authMethod = metadata.token_endpoint_auth_method || 'none'
  if (
    !['none', 'client_secret_post', 'client_secret_basic'].includes(authMethod)
  ) {
    throw new McpAuthError(
      `Unsupported token_endpoint_auth_method: ${authMethod}`,
      400,
    )
  }

  let clientSecret: string | undefined
  let clientSecretHash: string | null = null
  let clientSecretExpiresAt: number | undefined

  if (authMethod !== 'none') {
    clientSecret = crypto.randomBytes(32).toString('hex')
    clientSecretHash = bcrypt.hashSync(clientSecret, 10)
    clientSecretExpiresAt = 0
  }

  const clientId = `${CLIENT_PREFIX}${crypto.randomBytes(16).toString('hex')}`

  // A 10 KB "client name" would be a consent-screen attack; bound it.
  const clientName = (metadata.client_name || 'MCP Client').slice(0, 120)

  await db.insert(mcpOauthClients).values({
    id: clientId,
    clientSecretHash,
    clientName,
    redirectUris,
    grantTypes,
    responseTypes,
    tokenEndpointAuthMethod: authMethod,
    scopes: parseRequestedScopes(metadata.scope),
    isRevoked: false,
  })

  return {
    clientId,
    clientSecret,
    clientIdIssuedAt: Math.floor(Date.now() / 1000),
    clientSecretExpiresAt,
  }
}

export async function verifyOAuthClientSecret(
  clientId: string,
  clientSecret: string | undefined,
): Promise<boolean> {
  if (!clientSecret) return false
  const db = await getDb()
  const [row] = await db
    .select()
    .from(mcpOauthClients)
    .where(
      and(
        eq(mcpOauthClients.id, clientId),
        eq(mcpOauthClients.isRevoked, false),
      ),
    )

  if (!row?.clientSecretHash) return false
  return bcrypt.compare(clientSecret, row.clientSecretHash)
}

export function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex')
}

export function generateDeviceCode(): string {
  return crypto.randomBytes(24).toString('hex')
}

export function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-'
    code += chars[crypto.randomInt(chars.length)]
  }
  return code
}

export function generateCodeChallenge(
  verifier: string,
  method: string,
): string {
  if (method === 'S256') {
    const hash = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url')
    return hash.replace(/=/g, '')
  }
  return verifier
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Authorization codes are stored hashed, like device codes and access tokens.
 * The plaintext code exists only in the redirect to the client; a reader of
 * `mcp_auth_requests` cannot redeem what they find there.
 *
 * A plain SHA-256 (no salt, no KDF) is correct: the input is a 128-bit random
 * UUID, so there is no low-entropy secret to brute-force.
 */
export function hashAuthorizationCode(code: string): string {
  return hashToken(code)
}

export function redirectUriAllowed(
  registeredUris: string[],
  candidate: string,
): boolean {
  return registeredUris.some((u) => u === candidate)
}

const MAX_REDIRECT_URIS = 10
const MAX_REDIRECT_URI_LENGTH = 2048

/**
 * A registered redirect_uri is the only thing standing between an
 * authorization code and an attacker, so the registration endpoint — which is
 * deliberately unauthenticated per RFC 7591 — must not accept arbitrary
 * strings.
 *
 * Accepted: absolute https URIs, and http URIs on loopback hosts only (the
 * localhost exception native/CLI clients rely on, RFC 8252 §7.3). Custom
 * private-use schemes (e.g. `myapp:/callback`) are also allowed because native
 * MCP clients use them, but they must be absolute and carry no fragment.
 * Rejected: fragments (RFC 6749 §3.1.2), non-loopback http, and everything
 * else (javascript:, data:, relative URIs).
 */
export function isValidRedirectUri(candidate: unknown): boolean {
  if (typeof candidate !== 'string') return false
  if (candidate.length === 0 || candidate.length > MAX_REDIRECT_URI_LENGTH) {
    return false
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return false
  }

  // RFC 6749 §3.1.2: the endpoint URI must not include a fragment.
  if (url.hash !== '') return false

  if (url.protocol === 'https:') return true

  if (url.protocol === 'http:') {
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]' ||
      url.hostname === '::1'
    )
  }

  // Private-use scheme (native clients). Must not be a dangerous
  // script-executing scheme.
  const blocked = ['javascript:', 'data:', 'vbscript:', 'file:', 'blob:']
  if (blocked.includes(url.protocol)) return false

  return url.protocol.endsWith(':') && url.protocol.length > 1
}

/** Validates a whole `redirect_uris` array from a registration request. */
export function validateRedirectUris(uris: unknown): string[] {
  if (!Array.isArray(uris) || uris.length === 0) {
    throw new McpAuthError('redirect_uris is required', 400)
  }
  if (uris.length > MAX_REDIRECT_URIS) {
    throw new McpAuthError(
      `At most ${MAX_REDIRECT_URIS} redirect_uris are allowed`,
      400,
    )
  }
  for (const uri of uris) {
    if (!isValidRedirectUri(uri)) {
      throw new McpAuthError(`Invalid redirect_uri: ${String(uri)}`, 400)
    }
  }
  return uris as string[]
}

/**
 * Narrows a requested scope string to the scopes this server implements.
 * An unrecognised scope is dropped rather than stored, so it can never travel
 * into a token and imply a permission nothing enforces.
 */
export function parseRequestedScopes(scope: string | undefined): string[] {
  if (!scope) return []
  const requested = scope.split(' ').filter(Boolean)
  const allowed = new Set<string>(ALL_SCOPES)
  return [...new Set(requested.filter((s) => allowed.has(s)))]
}
