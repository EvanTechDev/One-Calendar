const inflight = new Map<string, Promise<unknown>>()

/**
 * A non-2xx response from one of our own API routes.
 *
 * `message` is the API's own `error` field whenever it sent a usable one —
 * routes return actionable text ("this repeat rule cannot be moved to another
 * day"), and a bare status code leaves the user with nothing to act on. When the
 * body was not JSON, or carried no `error`, the message falls back to the status
 * code and `hasServerMessage` is false, which is the caller's cue to substitute
 * its own localised text instead of showing a raw HTTP phrase to a person.
 */
export class ApiError extends Error {
  readonly status: number
  readonly hasServerMessage: boolean

  constructor(message: string, status: number, hasServerMessage: boolean) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.hasServerMessage = hasServerMessage
  }
}

/**
 * The message to show a person, or `fallback` when the server never explained
 * itself. Lets a caller keep its own localised copy without losing the specific
 * explanation the route gave.
 */
export function messageOr(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.hasServerMessage
    ? error.message
    : fallback
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const key = `${method}:${url}:${init?.body ? String(init.body) : ''}`

  if (method === 'GET' && inflight.has(key)) {
    return inflight.get(key) as Promise<T>
  }

  const request = fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  }).then(async (response) => {
    if (!response.ok) {
      let message = `Request failed: ${response.status}`
      let hasServerMessage = false
      try {
        const body = (await response.json()) as { error?: unknown }
        if (typeof body?.error === 'string' && body.error.trim().length > 0) {
          message = body.error
          hasServerMessage = true
        }
      } catch {
        // Non-JSON body — keep the status-code message.
      }
      throw new ApiError(message, response.status, hasServerMessage)
    }
    return (await response.json()) as T
  })

  if (method === 'GET') {
    inflight.set(key, request)
    // `request.finally(...)` would build a SECOND promise from this one, and a
    // rejected `request` rejects that derived promise too — with nothing
    // attached to handle it, so every failed GET raised an unhandled rejection
    // in the console and, under Node's default policy, could take the process
    // down. Handlers passed to `then` compose the cleanup onto the original
    // chain instead; neither arm throws, so the promise `then` returns is
    // always fulfilled.
    const release = () => inflight.delete(key)
    request.then(release, release)
  }

  return request
}
