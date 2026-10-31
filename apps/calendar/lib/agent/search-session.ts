import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import { z } from 'zod'
import { resolvedSearchQuerySchema } from '@zntr/agent/search'
import type { AgentEventSummary, CalendarToolkit } from '@zntr/agent/types'
import type { SearchQuery } from '@zntr/agent/search'

const snapshotSchema = z.object({
  query: resolvedSearchQuerySchema,
  intent: z.string(),
  hits: z.array(z.object({ id: z.string(), stamp: z.string() })),
})
type Snapshot = z.infer<typeof snapshotSchema>
const audience = 'calendar-search-v1'
function key() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('Search session secret is missing')
  return createHash('sha256').update(`${audience}:${secret}`).digest()
}

/** Encrypted, user-bound decisions survive serverless instance changes. No event text. */
export async function sealSearch(userId: string, snapshot: Snapshot) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(Buffer.from(`${audience}:${userId}`))
  const encrypted = Buffer.concat([
    cipher.update(
      JSON.stringify({ snapshot, expires: Date.now() + 15 * 60_000 }),
      'utf8',
    ),
    cipher.final(),
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    'base64url',
  )
}

export async function openSearch(
  userId: string,
  token: unknown,
): Promise<Snapshot> {
  if (typeof token !== 'string') throw new Error('Missing search session')
  const bytes = Buffer.from(token, 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12))
  decipher.setAAD(Buffer.from(`${audience}:${userId}`))
  decipher.setAuthTag(bytes.subarray(12, 28))
  const payload = JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString('utf8'),
  )
  if (!Number.isFinite(payload.expires) || payload.expires <= Date.now())
    throw new Error('Expired search')
  return snapshotSchema.parse(payload.snapshot)
}

export function eventStamp(event: AgentEventSummary) {
  return createHash('sha256').update(JSON.stringify(event)).digest('base64url')
}

/** Drain the candidate pages, not just the first 50/200. No lexical prefilter. */
export async function collectSearchCandidates(
  toolkit: CalendarToolkit,
  query: SearchQuery,
  signal: AbortSignal,
) {
  const events = new Map<string, AgentEventSummary>()
  let expectedTotal: number | undefined
  for (let page = 1; ; page++) {
    signal.throwIfAborted()
    const result = await toolkit.listEvents({
      searchCandidates: true,
      start: query.start,
      end: query.end,
      categoryIds: query.categoryIds,
      participants: query.names?.length
        ? { names: query.names, mode: 'all' }
        : undefined,
      page,
      limit: 100,
    })
    expectedTotal ??= result.total
    if (result.total !== expectedTotal)
      throw new Error('Calendar changed during search')
    for (const event of result.events) events.set(event.id, event)
    if (page >= result.totalPages) break
    if (!result.events.length || result.page !== page)
      throw new Error('Incomplete candidate scan')
  }
  if (events.size !== expectedTotal)
    throw new Error('Incomplete candidate scan')
  return [...events.values()]
}
