import { requireOwner, ViewerAuthorizationError } from "@/lib/auth/viewer";

/**
 * Prospecting is an owner-only surface (partner model, 28.7.2026).
 * Gate on the PERSISTED isOwner flag via requireOwner — never the JWT role,
 * which can be stale for up to 24h. Signature kept: callers treat null as 403.
 */
export async function requireProspectingAdmin(): Promise<{ id: string } | null> {
  try {
    const { userId } = await requireOwner();
    return { id: userId };
  } catch (error) {
    if (error instanceof ViewerAuthorizationError) return null;
    throw error;
  }
}
