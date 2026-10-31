import { isPublicRoutableHost } from '@better-auth/core/utils/host'
import type { ClientMetadataResourceFetch } from '@better-auth/oauth-provider'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'

const BODY_FORBIDDEN_STATUSES = new Set([204, 205, 304])
const MAX_RESPONSE_BYTES = 256 * 1024

function responseHeaders(
  headers: Record<string, string | string[] | undefined>,
) {
  const result = new Headers()
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item)
    } else if (value !== undefined) {
      result.append(name, value)
    }
  }
  return result
}

/**
 * Resolve once, reject every non-public result, then pin the selected address.
 * The original hostname remains the Host header, TLS SNI and certificate name.
 */
export const fetchCimdResource: ClientMetadataResourceFetch = async (
  input,
  init,
) => {
  const webRequest = new Request(input, init)
  const url = new URL(webRequest.url)
  if (url.protocol !== 'https:') {
    throw new TypeError('CIMD metadata requires HTTPS')
  }
  if (webRequest.method !== 'GET' && webRequest.method !== 'HEAD') {
    throw new TypeError('CIMD metadata transport supports only GET and HEAD')
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true })
  if (addresses.length === 0) {
    throw new TypeError('CIMD metadata hostname returned no DNS addresses')
  }
  if (addresses.some(({ address }) => !isPublicRoutableHost(address))) {
    throw new TypeError(
      'CIMD metadata hostname must resolve only to public IPs',
    )
  }

  const pinned = addresses[0]!
  const headers = Object.fromEntries(webRequest.headers.entries())
  headers.host = url.host
  const requestSignal =
    init?.signal ??
    (input instanceof Request ? input.signal : webRequest.signal)
  const signals = [AbortSignal.timeout(10_000)]
  if (requestSignal) signals.push(requestSignal)

  return new Promise((resolve, reject) => {
    const outgoing = request(
      url,
      {
        agent: false,
        headers,
        method: webRequest.method,
        servername:
          isIP(url.hostname.replace(/^\[|\]$/g, '')) === 0
            ? url.hostname
            : undefined,
        signal: AbortSignal.any(signals),
        lookup: (_hostname, options, callback) => {
          if (typeof options === 'object' && options.all) {
            callback(null, [pinned])
          } else {
            callback(null, pinned.address, pinned.family)
          }
        },
      },
      (response) => {
        const status = response.statusCode ?? 500
        const responseInit = {
          headers: responseHeaders(response.headers),
          status,
          statusText: response.statusMessage,
        }
        if (
          webRequest.method === 'HEAD' ||
          BODY_FORBIDDEN_STATUSES.has(status)
        ) {
          response.resume()
          resolve(new Response(null, responseInit))
          return
        }

        const chunks: Buffer[] = []
        let total = 0
        response.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total > MAX_RESPONSE_BYTES) {
            response.destroy(
              new TypeError('CIMD metadata response exceeds 256 KiB'),
            )
            return
          }
          chunks.push(chunk)
        })
        response.once('error', reject)
        response.once('end', () => {
          resolve(
            new Response(Buffer.concat(chunks).toString('utf8'), responseInit),
          )
        })
      },
    )
    outgoing.once('error', reject)
    outgoing.end()
  })
}
