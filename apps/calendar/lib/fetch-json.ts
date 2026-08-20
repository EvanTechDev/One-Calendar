const inflight = new Map<string, Promise<unknown>>()

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
      // Surface the API's own message: routes return actionable errors (e.g.
      // "this repeat rule cannot be moved to another day"), and a bare status
      // code leaves the user with nothing to act on.
      let message = `Request failed: ${response.status}`
      try {
        const body = (await response.json()) as { error?: unknown }
        if (typeof body?.error === 'string' && body.error.trim().length > 0) {
          message = body.error
        }
      } catch {
        // Non-JSON body — keep the status-code message.
      }
      const error = new Error(message)
      ;(error as Error & { status?: number }).status = response.status
      throw error
    }
    return (await response.json()) as T
  })

  if (method === 'GET') {
    inflight.set(key, request)
    request.finally(() => inflight.delete(key))
  }

  return request
}
