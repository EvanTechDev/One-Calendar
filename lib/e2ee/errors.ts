export class E2EEError extends Error {
  constructor(message: string, public readonly code: string, public readonly causeError?: unknown) {
    super(message);
    this.name = "E2EEError";
  }
}

export class UnlockRequiredError extends E2EEError {
  constructor(message = "Recovery key is required to unlock data") {
    super(message, "UNLOCK_REQUIRED");
    this.name = "UnlockRequiredError";
  }
}
