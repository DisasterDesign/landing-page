/**
 * The single enforcement point of the partner model (28.7.2026).
 *
 * Two exposure levels:
 * - OWNER  — Elad (`User.isOwner`). Sees everything, including private deals.
 * - PARTNER — everyone else with business access (role SELLER after Roy's
 *   demotion). Sees ONLY what they generated, and must never learn that
 *   other partners exist — so scoping happens IN THE QUERY, never in the UI,
 *   and aggregates get the same where-clause as rows (an unfiltered total
 *   leaks the size of the whole business even when every row is hidden).
 *
 * `isOwner` is read from the DB on every call, never from the JWT — the
 * token carries a stale role for up to 24h (src/middleware.ts is edge-side
 * coarse filtering only; this is the real gate).
 */
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sellerAgreementScope,
  sellerLeadScope,
} from "@/lib/leads/authorization";

export interface Viewer {
  userId: string;
  isOwner: boolean;
  role: "ADMIN" | "MEMBER" | "SELLER";
  /** null = first-month commission partner; number = recurring share (Roy: 50) */
  revenueSharePct: number | null;
}

export class ViewerAuthorizationError extends Error {
  readonly status: number;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "ViewerAuthorizationError";
    this.status = status;
  }
}

/** Session + persisted flags, or throw. Every business route starts here. */
export async function getViewer(): Promise<Viewer> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ViewerAuthorizationError("Unauthorized", 401);
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isOwner: true, role: true, revenueSharePct: true },
  });
  if (!user) throw new ViewerAuthorizationError("Unauthorized", 401);
  return {
    userId: user.id,
    isOwner: user.isOwner,
    role: user.role,
    revenueSharePct: user.revenueSharePct,
  };
}

/** Owner-only surfaces (finance, expenses, jobs, SEO, blog, prospecting…). */
export async function requireOwner(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.isOwner) {
    throw new ViewerAuthorizationError("Forbidden", 403);
  }
  return viewer;
}

/** Route-boundary translation for the two errors above. */
export function viewerErrorResponse(error: unknown): Response | null {
  if (error instanceof ViewerAuthorizationError) {
    return Response.json(
      { error: error.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: error.status },
    );
  }
  return null;
}

/** Clients the viewer may see. Owner: everything. Partner: theirs only. */
export function clientScope(viewer: Viewer): Prisma.ClientWhereInput {
  return viewer.isOwner ? {} : { ownerId: viewer.userId };
}

/** Agreements the viewer may see. Wraps the battle-tested seller scope. */
export function agreementScope(viewer: Viewer): Prisma.AgreementWhereInput {
  return viewer.isOwner ? {} : sellerAgreementScope(viewer.userId);
}

/** Leads the viewer may see. Wraps the existing seller scope. */
export function leadScope(
  viewer: Viewer,
): Prisma.ContactSubmissionWhereInput {
  return viewer.isOwner ? {} : sellerLeadScope(viewer.userId);
}

/** Tasks the viewer may see: created by them or assigned to them. This is
 *  visibility, not business ownership — Task has no client link yet, so it
 *  must not feed reports. */
export function taskScope(viewer: Viewer): Prisma.TaskWhereInput {
  return viewer.isOwner
    ? {}
    : {
        OR: [
          { creatorId: viewer.userId },
          { assignees: { some: { id: viewer.userId } } },
        ],
      };
}
