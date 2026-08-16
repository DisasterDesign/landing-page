import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { updateOneTimeQuoteSchema } from "@/lib/validations";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { planQuoteEdit } from "@/lib/agreements/quote-edit";
import { updateAgreementDraftFields } from "@/lib/leads/agreement-lifecycle";
import { LeadDomainError } from "@/lib/leads/errors";
import {
  renderAgreement,
  AGREEMENT_DOCUMENT_VERSION,
} from "@/lib/agreement-templates";

/**
 * Edit a DRAFT/SENT quote. Owner-only.
 *
 * Every content change re-renders the stored document — the sign page shows
 * `agreement.content`, and the price table lives inside customBodyHtml, so a
 * fee change without a rebuild would leave the customer signing the old
 * number. What to refuse and what to write is decided by planQuoteEdit
 * (unit-tested); signed and cancelled quotes are additionally frozen by
 * agreement-lifecycle (CONFLICT), so an edit there is refused twice over.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireOwner();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateOneTimeQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await prisma.agreement.findUnique({
      where: { id },
      select: {
        kind: true,
        status: true,
        projectTitle: true,
        customerName: true,
        businessName: true,
        idNumber: true,
        phone: true,
        email: true,
        oneTimeFee: true,
        locale: true,
        vatExempt: true,
        customBodyHtml: true,
      },
    });

    const plan = planQuoteEdit(existing, parsed.data);
    if (plan.kind === "refuse") {
      return NextResponse.json({ error: plan.error }, { status: plan.status });
    }

    const content = renderAgreement(null, {
      ...plan.render,
      monthlyPrice: 0,
      tier: null,
      additionalServices: [],
      date: new Date().toLocaleDateString(plan.render.locale === "en" ? "en-GB" : "he-IL"),
    });

    const updated = await updateAgreementDraftFields({
      agreementId: id,
      actor: { userId: viewer.userId, role: "ADMIN" },
      data: { ...plan.data, content, documentVersion: AGREEMENT_DOCUMENT_VERSION },
    });

    return NextResponse.json({
      data: { id: updated.id, projectTitle: updated.projectTitle, status: updated.status },
    });
  } catch (error) {
    const viewerError = viewerErrorResponse(error);
    if (viewerError) return viewerError;
    if (error instanceof LeadDomainError && error.code === "CONFLICT") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Error editing quote:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
