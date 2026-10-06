import { createJsonFetcher } from '@zntr/calendar-host/request'

export {
  ApiError,
  createJsonFetcher,
  messageOr,
} from '@zntr/calendar-host/request'

// Keep the existing browser entry while callers migrate to a host-owned API.
export const fetchJson = createJsonFetcher((input, init) => fetch(input, init))
