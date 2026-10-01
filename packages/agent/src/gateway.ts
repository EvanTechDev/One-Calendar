/**
 * One-line classification of a model-gateway failure.
 *
 * The AI SDK's `APICallError` carries the provider's own status and response
 * body, but logging the error object itself dumps the whole request body along
 * with it — the user's event text and every chat message included. This reads
 * the two fields worth having off any thrown value, and nothing else.
 *
 * It duck-types rather than importing the SDK's error class so the package
 * stays usable from any provider, and so a thrown string still classifies.
 */

export type ProviderErrorKind =
  /** 401 — key missing, wrong, or revoked. */
  | 'auth'
  /** 403 — the gateway or its CDN refused the request; not a bad request. */
  | 'blocked'
  /** 429 — the provider's own quota, not one of our rate limits. */
  | 'rate_limit'
  /** 400 / 422 — the model rejected the schema or a parameter. */
  | 'bad_request'
  /** Anything else, including a plain thrown `Error`. */
  | 'upstream'

export interface ProviderErrorSummary {
  /** Provider status code, or `null` when the failure never reached one. */
  status: number | null
  kind: ProviderErrorKind
  /** Single-line, whitespace-collapsed detail. Never the request body. */
  detail: string
}

/** Keep log lines to one row; provider bodies are short and we want the head. */
const MAX_DETAIL = 200

function kindFor(status: number | null): ProviderErrorKind {
  if (status === 401) return 'auth'
  if (status === 403) return 'blocked'
  if (status === 429) return 'rate_limit'
  if (status === 400 || status === 422) return 'bad_request'
  return 'upstream'
}

export function summarizeProviderError(error: unknown): ProviderErrorSummary {
  if (typeof error !== 'object' || error === null) {
    return { status: null, kind: 'upstream', detail: collapse(String(error)) }
  }

  const candidate = error as {
    statusCode?: unknown
    status?: unknown
    responseBody?: unknown
    message?: unknown
  }

  const rawStatus = candidate.statusCode ?? candidate.status
  const status = typeof rawStatus === 'number' ? rawStatus : null

  const body =
    typeof candidate.responseBody === 'string'
      ? candidate.responseBody.trim()
      : ''
  const message =
    typeof candidate.message === 'string' ? candidate.message.trim() : ''

  return {
    status,
    kind: kindFor(status),
    detail: collapse(body || message || 'unknown error'),
  }
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, MAX_DETAIL)
}
