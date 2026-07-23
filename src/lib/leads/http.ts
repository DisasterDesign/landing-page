import { NextResponse } from "next/server";

import { LeadDomainError } from "./errors";

const statusByCode = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  INVALID_TRANSITION: 422,
  VALIDATION: 400,
} as const;

export function leadDomainErrorResponse(error: unknown): NextResponse {
  if (error instanceof LeadDomainError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: statusByCode[error.code] },
    );
  }
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "Internal server error" },
    { status: 500 },
  );
}
