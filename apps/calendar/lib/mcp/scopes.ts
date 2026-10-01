import { z } from 'zod'
import { ALL_SCOPES, type McpScope } from './types'

/**
 * Validation for a caller-supplied `scopes` payload on an API key.
 *
 * `scopes` is a `jsonb` column that lands directly on a security decision:
 * `requireScope` in lib/mcp/server.ts answers with `scopes?.includes(scope)`,
 * so a non-array value there degrades to substring matching. The key routes
 * used to cast the request body to `{ scopes?: string[] }` and persist whatever
 * arrived, which let a caller store an arbitrary JSON value under `scopes`.
 *
 * Unknown entries are dropped rather than rejected, and an empty result falls
 * back to the full set — the same default `generateApiKey` already applied to an
 * empty array, so a client that sends nothing keeps working unchanged.
 */
const scopesSchema = z.array(z.enum(ALL_SCOPES as [McpScope, ...McpScope[]]))

export function parseScopes(input: unknown): McpScope[] | null {
  const parsed = scopesSchema.safeParse(input)
  if (!parsed.success) return null
  const unique = [...new Set(parsed.data)]
  return unique.length > 0 ? unique : [...ALL_SCOPES]
}
