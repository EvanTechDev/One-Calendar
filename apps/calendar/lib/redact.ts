const SENSITIVE_KEY =
  /token|authorization|cookie|password|secret|apikey|api_key/i
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function maskEmail(value: string): string {
  const [local, domain] = value.split('@')
  return `${local?.[0] ?? '*'}\u2022\u2022\u2022@${domain ?? 'redacted'}`
}

export function redactLogValue(value: unknown, key = ''): unknown {
  if (typeof value === 'string') {
    if (SENSITIVE_KEY.test(key)) return '[REDACTED]'
    if (EMAIL.test(value)) return maskEmail(value)
    return value
  }
  if (Array.isArray(value)) return value.map((v) => redactLogValue(v))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, redactLogValue(v, k)]),
    )
  }
  return value
}

export function redactLog(ctx: unknown): unknown {
  return redactLogValue(ctx)
}
