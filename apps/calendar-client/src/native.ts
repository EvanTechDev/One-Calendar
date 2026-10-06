import { Channel, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { CalendarUser } from '@zntr/calendar-host'

export { invoke, listen }

export interface DesktopConfig {
  environment: 'dev' | 'production'
  apiOrigin: string
  appName: string
  version: string
}

export interface SessionView {
  user: CalendarUser | null
  expiresAt: string | null
  pending: boolean
  signingIn: boolean
  error: string | null
}

export const openExternal = (destination: string) =>
  invoke('open_external', { destination })

type ResponseEvent =
  | { type: 'headers'; status: number; headers: Record<string, string> }
  | { type: 'chunk'; data: string }
  | { type: 'end' }
  | { type: 'error'; message: string }

function encode(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

/** A fetch-compatible streaming adapter. Credentials stay inside Rust. */
export function createNativeFetch(origin: string): typeof fetch {
  return async (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      origin,
    )
    if (url.origin !== origin || !url.pathname.startsWith('/api/')) {
      throw new TypeError('Only calendar API requests are supported')
    }
    const request = new Request(input instanceof Request ? input : url, init)
    request.signal.throwIfAborted()
    const bytes = request.body
      ? new Uint8Array(await request.arrayBuffer())
      : null
    request.signal.throwIfAborted()
    if (bytes && bytes.byteLength > 20 * 1024 * 1024) {
      throw new RangeError('Upload exceeds 20 MB')
    }
    const id = crypto.randomUUID()
    return new Promise<Response>((resolve, reject) => {
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined
      let finished = false
      let receivedHeaders = false
      const cleanup = () => request.signal.removeEventListener('abort', abort)
      const fail = (error: Error) => {
        if (finished) return
        finished = true
        cleanup()
        controller?.error(error)
        reject(error)
      }
      const cancel = () =>
        invoke<void>('desktop_cancel_request', { id }).catch(() => {})
      const abort = () => {
        fail(new DOMException('Request cancelled', 'AbortError'))
        void cancel()
      }
      const events = new Channel<ResponseEvent>()
      events.onmessage = (event) => {
        if (finished) return
        if (event.type === 'headers') {
          if (receivedHeaders) return
          receivedHeaders = true
          const empty =
            request.method === 'HEAD' || [204, 205, 304].includes(event.status)
          const body = empty
            ? null
            : new ReadableStream<Uint8Array>({
                start(value) {
                  controller = value
                },
                cancel() {
                  finished = true
                  cleanup()
                  return cancel()
                },
              })
          resolve(
            new Response(body, {
              status: event.status,
              headers: event.headers,
            }),
          )
        } else if (event.type === 'chunk') {
          controller?.enqueue(
            Uint8Array.from(atob(event.data), (char) => char.charCodeAt(0)),
          )
        } else if (event.type === 'end') {
          finished = true
          cleanup()
          controller?.close()
          if (!receivedHeaders)
            reject(new Error('The server returned no response'))
        } else {
          fail(new Error(event.message))
        }
      }
      request.signal.addEventListener('abort', abort, { once: true })
      if (request.signal.aborted) {
        abort()
        return
      }
      void invoke('desktop_request', {
        request: {
          id,
          path: `${url.pathname}${url.search}`,
          method: request.method,
          headers: Object.fromEntries(request.headers),
          body: bytes ? encode(bytes) : null,
        },
        events,
      }).catch((error: unknown) => fail(new Error(String(error))))
    })
  }
}
