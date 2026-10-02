export class InvalidEventQueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidEventQueryError'
  }
}

export class ParticipantError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message)
    this.name = 'ParticipantError'
  }
}

/**
 * The errors a tool throws in response to a bad request, as opposed to a bug.
 *
 * This is the whole point of the list: deciding whether an error is the
 * client's fault has to be one decision, not one per tool. `lib/mcp` had thirty
 * registrations and twenty-nine catch blocks, and each one re-tested a single
 * class by name — so `create_event` checked only `ParticipantError` while the
 * module it called throws `InvalidEventQueryError` too, and `list_events`
 * checked only the reverse. Either tool could answer a perfectly ordinary
 * rejected query with "Internal server error", which reads as a server fault
 * and tells the caller nothing.
 *
 * A new client-error type goes here, once.
 */
export const CLIENT_ERROR_TYPES = [
  InvalidEventQueryError,
  ParticipantError,
] as const

export function isClientError(err: unknown): boolean {
  return CLIENT_ERROR_TYPES.some((type) => err instanceof type)
}

/**
 * The message to hand back for a client error. Only meaningful once
 * {@link isClientError} has said so — otherwise the caller is hiding a bug
 * behind "Invalid request", and the log line that would have explained it.
 */
export function clientErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Invalid request'
}
