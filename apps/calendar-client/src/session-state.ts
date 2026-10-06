import type { SessionView } from './native'

// Event delivery and invoke responses use different IPC callbacks. A delayed
// restore response must never resurrect an account after logout or replacement.
export function receiveSession(current: SessionView, incoming: SessionView) {
  return incoming.generation >= current.generation ? incoming : current
}
