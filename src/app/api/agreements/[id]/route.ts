import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  PersistedRoleAuthorizationError,
  requirePersistedUserRole,
} from "@/lib/auth/persisted-role";
import { updateAgreementSchema } from "@/lib/validations";
import { renderAgreement, AGREEMENT_DOCUMENT_VERSION } from "@/lib/agreement-templates";
import {
  applyAgreementEvent,
  updateAgreementDraftFields,
} from "@/lib/leads/agreement-lifecycle";
import { leadDomainErrorResponse } from "@/lib/leads/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);

    const { id } = await params;
    const agreement = await prisma.agreement.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!agreement) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(agreement);
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error fetching agreement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);

    const { id } = await params;
    const body = await request.json();
    const parsed = updateAgreementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.agreement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { status, ...draftFields } = parsed.data;
    const hasDraftChanges = Object.keys(draftFields).length > 0;
    if (status && status !== "CANCELLED") {
      return NextResponse.json(
        {
          error:
            status === "SENT"
              ? "Use the explicit mark-as-sent action"
              : "Agreement status is controlled by signing and payment events",
        },
        { status: 400 },
      );
    }
    if (status === "CANCELLED" && hasDraftChanges) {
      return NextResponse.json(
        { error: "Cancel the agreement separately from content changes" },
        { status: 400 },
      );
    }

    if (status === "CANCELLED") {
      const reason =
        typeof body.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 3) {
        return NextResponse.json(
          { error: "Cancellation requires a reason" },
          { status: 400 },
        );
      }
      const result = await applyAgreementEvent({
        agreementId: id,
        type: "CANCELLED",
        reason,
        actor: { userId: session.user.id, role: "ADMIN" },
      });
      return NextResponse.json(result);
    }

    if (!hasDraftChanges) {
      return NextResponse.json(existing);
    }

    // If any content-affecting field changed on an UNSIGNED agreement, re-render
    // the stored HTML so the customer's preview matches (language, VAT, price,
    // tier, services, party details). Signed agreements are frozen — their
    // content is the legally-binding signed document and must never change.
    const data = { ...draftFields };
    const contentKeys: (keyof typeof draftFields)[] = [
      "tier",
      "additionalServices",
      "monthlyPrice",
      "oneTimeFee",
      "customerName",
      "businessName",
      "idNumber",
      "phone",
      "email",
      "locale",
      "vatExempt",
    ];
    const contentChanged = contentKeys.some((k) => k in draftFields);
    const isUnsigned = existing.status === "DRAFT" || existing.status === "SENT";

    let renderedContent: string | undefined;
    if (contentChanged && isUnsigned) {
      const merged = { ...existing, ...draftFields };
      const locale = merged.locale === "en" ? "en" : "he";
      renderedContent = renderAgreement(merged.tier, {
        customerName: merged.customerName,
        businessName: merged.businessName ?? undefined,
        idNumber: merged.idNumber ?? undefined,
        phone: merged.phone,
        email: merged.email,
        monthlyPrice: merged.monthlyPrice,
        oneTimeFee: merged.oneTimeFee,
        tier: merged.tier,
        additionalServices: merged.additionalServices,
        date: new Date().toLocaleDateString(locale === "en" ? "en-GB" : "he-IL"),
        locale,
        vatExempt: merged.vatExempt,
        // Preserve custom-proposal rendering (e.g. Ormat) on admin edits;
        // null for all standard tier agreements → unchanged path.
        customBodyHtml: merged.customBodyHtml ?? undefined,
      });
    }

    const agreement = await updateAgreementDraftFields({
      agreementId: id,
      actor: { userId: session.user.id, role: "ADMIN" },
      data: {
        ...data,
        ...(renderedContent
          ? { content: renderedContent, documentVersion: AGREEMENT_DOCUMENT_VERSION }
          : {}),
      },
    });

    return NextResponse.json(agreement);
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error updating agreement:", error);
    return leadDomainErrorResponse(error);
  }
}

export async function DELETE() {
  return NextResponse.json(
    {
      error:
        "Agreements are immutable records. Cancel an unpaid agreement with a reason instead.",
    },
    {
      status: 405,
      headers: { Allow: "GET, PATCH" },
    },
  );
}
