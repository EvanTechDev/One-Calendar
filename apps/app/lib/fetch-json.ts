const inflight = new Map<string, Promise<unknown>>()

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase()
  const key = `${method}:${url}:${init?.body ? String(init.body) : ""}`

  if (method === "GET" && inflight.has(key)) {
    return inflight.get(key) as Promise<T>
  }

  const request = fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  }).then(async (response) => {
    if (!response.ok) {
      const error = new Error(`Request failed: ${response.status}`)
      ;(error as Error & { status?: number }).status = response.status
      throw error
    }
    return (await response.json()) as T
  })

  if (method === "GET") {
    inflight.set(key, request)
    request.finally(() => inflight.delete(key))
  }

  return request
}
