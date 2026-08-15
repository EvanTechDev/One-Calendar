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
