import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { updateOneTimeQuoteSchema } from "@/lib/validations";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { quoteBodyHtml } from "@/lib/agreements/one-time";
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
 * number. Signed and cancelled quotes are frozen by agreement-lifecycle
 * (CONFLICT); an edit there is refused, never silently applied.
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
    const patch = parsed.data;

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
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.kind !== "ONE_TIME") {
      // Subscription agreements have their own edit route with tier logic.
      return NextResponse.json({ error: "Not a quote" }, { status: 400 });
    }
    if (existing.status === "SIGNED" || existing.status === "CANCELLED") {
      return NextResponse.json(
        { error: "הצעה חתומה או מבוטלת היא רשומה סגורה ולא ניתן לערוך אותה." },
        { status: 409 },
      );
    }

    // The scope of work is not stored as text — only as the rendered body.
    // If it was not resent, keep the existing body but still rebuild the price
    // table below when the fee / VAT / language changed, by re-deriving from
    // the existing rendered scope. Simplest safe rule: require scopeOfWork
    // whenever anything that appears in the price box changes.
    const priceChanged =
      patch.oneTimeFee !== undefined ||
      patch.vatExempt !== undefined ||
      patch.locale !== undefined;
    if (priceChanged && patch.scopeOfWork === undefined) {
      return NextResponse.json(
        { error: "כדי לשנות סכום, מע\"מ או שפה יש לשלוח גם את תיאור העבודה — הוא נבנה מחדש יחד עם טבלת המחיר." },
        { status: 400 },
      );
    }

    const merged = {
      projectTitle: patch.projectTitle ?? existing.projectTitle ?? "",
      customerName: patch.customerName ?? existing.customerName,
      businessName:
        patch.businessName !== undefined ? patch.businessName : existing.businessName,
      idNumber: patch.idNumber !== undefined ? patch.idNumber : existing.idNumber,
      phone: patch.phone ?? existing.phone,
      email: patch.email ?? existing.email,
      oneTimeFee: patch.oneTimeFee ?? existing.oneTimeFee ?? 0,
      locale: (patch.locale ?? existing.locale) === "en" ? ("en" as const) : ("he" as const),
      vatExempt: patch.vatExempt ?? existing.vatExempt,
    };

    const customBodyHtml =
      patch.scopeOfWork !== undefined
        ? quoteBodyHtml({
            scope: patch.scopeOfWork,
            oneTimeFee: merged.oneTimeFee,
            vatExempt: merged.vatExempt,
            locale: merged.locale,
          })
        : (existing.customBodyHtml ?? undefined);

    const content = renderAgreement(null, {
      customerName: merged.customerName,
      businessName: merged.businessName ?? undefined,
      idNumber: merged.idNumber ?? undefined,
      phone: merged.phone,
      email: merged.email,
      monthlyPrice: 0,
      oneTimeFee: merged.oneTimeFee,
      tier: null,
      additionalServices: [],
      date: new Date().toLocaleDateString(merged.locale === "en" ? "en-GB" : "he-IL"),
      locale: merged.locale,
      vatExempt: merged.vatExempt,
      customBodyHtml,
    });

    const updated = await updateAgreementDraftFields({
      agreementId: id,
      actor: { userId: viewer.userId, role: "ADMIN" },
      data: {
        ...(patch.projectTitle !== undefined ? { projectTitle: patch.projectTitle } : {}),
        ...(patch.customerName !== undefined ? { customerName: patch.customerName } : {}),
        ...(patch.businessName !== undefined ? { businessName: patch.businessName } : {}),
        ...(patch.idNumber !== undefined ? { idNumber: patch.idNumber } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.oneTimeFee !== undefined ? { oneTimeFee: patch.oneTimeFee } : {}),
        ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
        ...(patch.vatExempt !== undefined ? { vatExempt: patch.vatExempt } : {}),
        ...(customBodyHtml !== undefined ? { customBodyHtml } : {}),
        content,
        documentVersion: AGREEMENT_DOCUMENT_VERSION,
      },
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
