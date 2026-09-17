/**
 * Months of continuous active subscription after which the website becomes
 * the client's (sections 4-5 of the subscription agreement).
 *
 * Lives in its own dependency-free module because both the server-only
 * template renderer (imports fs) and the zod schemas (imported by client
 * forms) need it, and the form must never pull fs into the browser bundle.
 *
 * 18 is the business term since 9.2026; a deal can set another value at
 * creation (Agreement.ownershipMonths).
 */
export const DEFAULT_OWNERSHIP_MONTHS = 18;
export const MIN_OWNERSHIP_MONTHS = 1;
export const MAX_OWNERSHIP_MONTHS = 60;
