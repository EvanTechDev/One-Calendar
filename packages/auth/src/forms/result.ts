export function authResultRedirect(result: unknown): string | null {
  const value = result as
    | { data?: { redirect?: unknown; url?: unknown } | null }
    | undefined
  return value?.data?.redirect === true && typeof value.data.url === 'string'
    ? value.data.url
    : null
}
