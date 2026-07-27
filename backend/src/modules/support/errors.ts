export class SupportValidationError extends Error {
  public status = 400;
  public code = "SUPPORT_VALIDATION_FAILED";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, SupportValidationError.prototype);
  }
}

export class SupportNotFoundError extends Error {
  public status = 404;
  public code = "SUPPORT_NOT_FOUND";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, SupportNotFoundError.prototype);
  }
}
