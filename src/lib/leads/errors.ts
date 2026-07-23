export type LeadDomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "VALIDATION";

export class LeadDomainError extends Error {
  constructor(
    readonly code: LeadDomainErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LeadDomainError";
  }
}
