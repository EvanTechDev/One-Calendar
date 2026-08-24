import { RoomServiceClient } from 'livekit-server-sdk'

/**
 * LiveKit's REST API lives on the https origin matching the wss signalling
 * URL, so the scheme is swapped rather than configured separately.
 */
export function livekitHttpUrl(): string {
  const url = process.env.LIVEKIT_URL
  if (!url) throw new Error('LIVEKIT_URL is not set')
  return url.replace(/^ws/, 'http')
}

export function getRoomService(): RoomServiceClient {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not set')
  }
  return new RoomServiceClient(livekitHttpUrl(), apiKey, apiSecret)
}
