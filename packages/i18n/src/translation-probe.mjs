// Deliberately print types only: never credentials, endpoint, model or content.
const required = [
  'TRANSLATION_BASE_URL',
  'TRANSLATION_API_KEY',
  'TRANSLATION_MODEL',
]
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`Missing ${name}`)
}
const endpoint = new URL(
  `${process.env.TRANSLATION_BASE_URL.trim().replace(/\/+$/, '')}/chat/completions`,
)
if (
  !['http:', 'https:'].includes(endpoint.protocol) ||
  endpoint.username ||
  endpoint.password ||
  endpoint.search ||
  endpoint.hash
) {
  throw new Error('Invalid translation base URL')
}
const response = await fetch(endpoint, {
  method: 'POST',
  redirect: 'error',
  signal: AbortSignal.timeout(60_000),
  headers: {
    authorization: `Bearer ${process.env.TRANSLATION_API_KEY.trim()}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: process.env.TRANSLATION_MODEL.trim(),
    stream: false,
    messages: [{ role: 'user', content: 'Reply with OK only.' }],
  }),
})
const text = await response.text()
let body
try {
  body = JSON.parse(text)
} catch {
  /* Report the encoding, not its contents. */
}
function shape(value, depth = 0) {
  if (value === null) return 'null'
  if (Array.isArray(value))
    return value.length ? [shape(value[0], depth + 1)] : []
  if (typeof value === 'object') {
    if (depth > 4) return 'object'
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, shape(item, depth + 1)]),
    )
  }
  return typeof value
}
console.log(
  JSON.stringify(
    {
      status: response.status,
      contentType: response.headers.get('content-type'),
      json: body !== undefined,
      shape: shape(body),
    },
    null,
    2,
  ),
)
if (!response.ok || typeof body?.choices?.[0]?.message?.content !== 'string') {
  process.exitCode = 1
}
