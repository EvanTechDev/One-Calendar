import type { AuthInfo } from '@modelcontextprotocol/server'
import { logAudit } from './audit'

/**
 * Per-tool-call audit logging (CORE-128).
 *
 * The transport already writes one 'request' row per HTTP request, which says
 * nothing about WHICH tools ran or WHAT they changed — a batched JSON-RPC call
 * that renamed an event and deleted three others looked identical to a single
 * `list_events`. This module wraps every tool handler so each invocation gets
 * its own row carrying the tool name, the affected resource and, for
 * mutations, a redacted summary of the changed fields.
 */

/** Tools that write data, mapped to the resource they touch. */
const MUTATING_TOOLS: Record<string, string> = {
  create_event: 'event',
  update_event: 'event',
  delete_event: 'event',
  add_event_participants: 'event_participant',
  resend_event_invite: 'event_participant',
  remove_event_participant: 'event_participant',
  update_event_rsvp: 'event_participant',
  remove_event_from_my_calendar: 'event_participant',
  create_category: 'category',
  update_category: 'category',
  delete_category: 'category',
  create_countdown: 'countdown',
  update_countdown: 'countdown',
  delete_countdown: 'countdown',
  update_settings: 'settings',
  bookmark_event: 'bookmark',
  remove_bookmark: 'bookmark',
}

/** Read-only tools, mapped to the resource they read. */
const READ_TOOLS: Record<string, string> = {
  list_events: 'event',
  get_event: 'event',
  list_event_participants: 'event_participant',
  list_my_event_invites: 'event_participant',
  list_categories: 'category',
  list_countdowns: 'countdown',
  get_settings: 'settings',
  get_profile: 'profile',
  list_bookmarked_events: 'bookmark',
}

/** Param keys that identify the resource a call acted on. */
const ID_PARAM_KEYS = [
  'event_id',
  'category_id',
  'countdown_id',
  'invite_id',
  'participant_id',
] as const

/**
 * Params that are pure addressing/pagination rather than content. Excluded from
 * the changed-field list so `update_event` reports "title, start_date" instead
 * of also listing the id it was told to update.
 */
const NON_CONTENT_PARAMS = new Set<string>([
  ...ID_PARAM_KEYS,
  'page',
  'limit',
  'fields',
  'sort',
  'order',
  'query',
  'filter',
])

function resourceIdFrom(params: Record<string, unknown>): string | undefined {
  for (const key of ID_PARAM_KEYS) {
    const value = params[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

/**
 * A summary of what a mutation touched, WITHOUT the values.
 *
 * Only field names are stored plus a few safe scalars (`apply_to`, counts).
 * Event titles, descriptions, locations and participant emails are user
 * content — the audit log is a security record, not a second copy of the
 * calendar, and it is readable by anyone who can read the settings page.
 */
export function summarizeChanges(
  toolName: string,
  params: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!(toolName in MUTATING_TOOLS)) return undefined

  const fields = Object.keys(params)
    .filter((key) => !NON_CONTENT_PARAMS.has(key))
    .filter((key) => params[key] !== undefined)
    .sort()

  const summary: Record<string, unknown> = {}
  if (fields.length > 0) summary.fields = fields

  // Recurrence scope decides how many occurrences a single edit affected, so
  // it is the one value worth keeping verbatim.
  if (typeof params.apply_to === 'string') summary.apply_to = params.apply_to

  // Counts, not addresses.
  if (Array.isArray(params.emails)) summary.emailCount = params.emails.length
  if (Array.isArray(params.exdate)) summary.exdateCount = params.exdate.length
  if (typeof params.rrule === 'string') summary.rruleChanged = true

  return Object.keys(summary).length > 0 ? summary : undefined
}

export interface ToolAuditContext {
  userId: string
  authType: 'api_key' | 'oauth'
  keyId?: string
  ipAddress?: string
  userAgent?: string
}

/** Reads the audit context the transport put on `authInfo.extra`. */
export function auditContextFrom(
  authInfo: AuthInfo | undefined,
): ToolAuditContext | null {
  const extra = authInfo?.extra as Record<string, unknown> | undefined
  const userId = extra?.userId
  const authType = extra?.authType
  if (typeof userId !== 'string' || typeof authType !== 'string') return null
  return {
    userId,
    authType: authType as 'api_key' | 'oauth',
    keyId: typeof extra?.keyId === 'string' ? extra.keyId : undefined,
    ipAddress:
      typeof extra?.ipAddress === 'string' ? extra.ipAddress : undefined,
    userAgent:
      typeof extra?.userAgent === 'string' ? extra.userAgent : undefined,
  }
}

/**
 * Writes one 'tool_call' audit row. Never throws: a failed audit write must not
 * turn a successful calendar operation into an error for the agent.
 */
export async function logToolCall(options: {
  authInfo: AuthInfo | undefined
  toolName: string
  params: Record<string, unknown>
  success: boolean
  errorMessage?: string
  durationMs: number
}): Promise<void> {
  const ctx = auditContextFrom(options.authInfo)
  if (!ctx) return

  const { toolName, params } = options
  const isMutation = toolName in MUTATING_TOOLS
  const resourceType = MUTATING_TOOLS[toolName] ?? READ_TOOLS[toolName]

  try {
    await logAudit({
      userId: ctx.userId,
      authType: ctx.authType,
      keyId: ctx.keyId,
      action: toolName,
      entryType: 'tool_call',
      toolName,
      resourceType,
      resourceId: resourceIdFrom(params),
      isMutation,
      changes: summarizeChanges(toolName, params),
      durationMs: options.durationMs,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      success: options.success,
      errorMessage: options.errorMessage,
    })
  } catch (err) {
    console.error('Failed to write tool audit log:', err)
  }
}

/**
 * Wraps a tool handler so every invocation is audited, including the ones that
 * throw (a rejected scope check is exactly what an audit log exists to show).
 * The handler's result is returned untouched.
 */
export function withToolAudit<
  P extends Record<string, unknown>,
  R,
  E extends { authInfo?: AuthInfo },
>(toolName: string, handler: (params: P, extra: E) => Promise<R>) {
  return async (params: P, extra: E): Promise<R> => {
    const startedAt = Date.now()
    try {
      const result = await handler(params, extra)
      // Tool handlers signal failure with `isError` rather than throwing, so
      // an audit row must reflect that instead of always logging success.
      const failed =
        typeof result === 'object' &&
        result !== null &&
        (result as { isError?: boolean }).isError === true
      await logToolCall({
        authInfo: extra.authInfo,
        toolName,
        params: params ?? {},
        success: !failed,
        errorMessage: failed ? 'Tool reported an error' : undefined,
        durationMs: Date.now() - startedAt,
      })
      return result
    } catch (err) {
      await logToolCall({
        authInfo: extra.authInfo,
        toolName,
        params: params ?? {},
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      })
      throw err
    }
  }
}
