import { requireFinanceLeadAccess } from "@/lib/finance/lead-access";
import { financeClientScope, financeProductScope, financeAgreementScope, redactFinanceAgreement, requireBookSelection } from "@/lib/finance/access";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PersistedRoleAuthorizationError, requirePersistedUserRole } from "@/lib/auth/persisted-role";
import { createAgreementSchema } from "@/lib/validations";
import { renderAgreement, AGREEMENT_DOCUMENT_VERSION } from "@/lib/agreement-templates";
import { claimUnlinkedProductForAgreement } from "@/lib/client-products";
import { withVat } from "@/lib/vat";
import type { AgreementStatus, AgreementTier, Prisma } from "@prisma/client";
import { createAgreementForLead, createStandaloneAgreement } from "@/lib/leads/agreement-lifecycle";
import { updateLeadContactDetails } from "@/lib/leads/corrections";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { requireOwner, requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";

/**
 * Which agreements a given partner generated.
 *
 * `partnerId` is the single explicit answer to "who brought this deal".
 * `creditedSellerId` is the pre-migration fallback, and is read ONLY for rows
 * that predate the column.
 *
 * `createdBy` is deliberately absent. It records who typed the agreement in,
 * not who generated it — Elad routinely creates agreements on a partner's
 * behalf, which is exactly why 8 of 14 signed agreements had the client
 * saying one partner and the agreement saying another. It stays an audit
 * field and must never drive attribution or money again.
 */
// The explicit return type is load-bearing: spreading an un-annotated object
// into the `where` literal skips TypeScript's excess-property check, so a
// wrong or not-yet-migrated field name would compile clean and only surface
// as a runtime PrismaClientValidationError on the first filtered request.
function partnerAttributionScope(partnerId: string): Prisma.AgreementWhereInput {
  return {
    OR: [
      { partnerId },
      { partnerId: null, creditedSellerId: partnerId },
    ],
  };
}

// Optional `?partnerId=` narrows the list to the deals that partner generated.
// Owner-only lens for the partners board; partners never reach this route (the
// ADMIN guard stops them) and are scoped query-side via agreementScope instead.
// Without the param the query is untouched.
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);
    const viewer = await requireAdmin();

    const url = new URL(request.url);
    const status = url.searchParams.get("status") as AgreementStatus | null;
    const tier = url.searchParams.get("tier") as AgreementTier | null;
    const partnerId = url.searchParams.get("partnerId");

    // Only the owner may look at the business through another person's eyes.
    // Checked only when the param is present, so the unfiltered path keeps
    // its original single role check and its original cost.
    if (partnerId) await requireOwner();

    const agreements = await prisma.agreement.findMany({
      where: {
        // Subscriptions only. One-off quotes are agreements too, but they
        // belong to /admin/jobs — mixing them in here would put a ₪3,500 logo
        // job next to the monthly contracts and break every count on the page.
        kind: "SUBSCRIPTION",
        ...financeAgreementScope(viewer),
        ...(status ? { status } : {}),
        ...(tier ? { tier } : {}),
        ...(partnerId ? partnerAttributionScope(partnerId) : {}),
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    // signToken is a bearer credential for /agreement/[token], and it ships
    // here on purpose: this route is ADMIN-only and the admin is precisely
    // the person who sends signing links. Stripping it (fde5baf) left the
    // "copy link" button building /agreement/undefined, which failed silently
    // for days. The rule that actually holds: the token may ride on
    // admin/owner-scoped responses, never on public or unscoped ones.
    return NextResponse.json({ data: agreements.map(a => redactFinanceAgreement(viewer, a)) });
  } catch (error) {
    const financeError = viewerErrorResponse(error);
    if (financeError) return financeError;
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Only reachable from the `?partnerId=` branch above — a non-owner asking
    // for someone else's deals gets 403, not a 500.
    const viewerError = viewerErrorResponse(error);
    if (viewerError) return viewerError;
    console.error("Error fetching agreements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const viewer = await requireAdmin();
    const body = await request.json();
    const financeBook = requireBookSelection(viewer, body.financeBook, viewer.isOwner ? "PRIVATE" : "SHARED");
    const parsed = createAgreementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      tier,
      additionalServices,
      monthlyPrice,
      oneTimeFee,
      customerName,
      businessName,
      idNumber,
      phone,
      email,
      clientId,
      leadId,
      productId,
      newProductName,
      locale,
      vatExempt,
      ownershipMonths,
    } = parsed.data;

    const cleanedExtras = (additionalServices ?? [])
      .map((s) => s.trim())
      .filter(Boolean);

    const content = renderAgreement(tier ?? null, {
      customerName,
      businessName,
      idNumber,
      phone,
      email,
      monthlyPrice,
      oneTimeFee: oneTimeFee ?? null,
      tier: tier ?? null,
      additionalServices: cleanedExtras,
      date: new Date().toLocaleDateString(locale === "en" ? "en-GB" : "he-IL"),
      locale,
      vatExempt,
      ownershipMonths,
    });

    // Product coverage is meaningless without a client to hang it on.
    if ((productId || newProductName) && !clientId) {
      return NextResponse.json(
        { error: "שיוך למוצר דורש קישור ללקוח קיים" },
        { status: 400 }
      );
    }
    // Validate the picked product BEFORE creating the agreement, so a bad pick
    // doesn't leave an orphan agreement behind.
    if (clientId && productId) {
      const product = await prisma.clientProduct.findFirst({
        where: { id: productId, ...financeProductScope(viewer) },
        select: { clientId: true, archivedAt: true, financeBook: true, agreementId: true },
      });
      if (!product || product.clientId !== clientId || product.archivedAt) {
        return NextResponse.json(
          { error: "המוצר שנבחר אינו שייך ללקוח" },
          { status: 400 }
        );
      }
      if (product.agreementId) return NextResponse.json({ error: "המוצר כבר מקושר להסכם; יש ליצור מוצר חדש" }, { status: 409 });
    }

    if (clientId) {
      const linkedClient = await prisma.client.findFirst({ where: { id: clientId, ...financeClientScope(viewer) }, select: { id: true } });
      if (!linkedClient) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (clientId && productId) {
      const picked = await prisma.clientProduct.findUnique({ where: { id: productId }, select: { financeBook: true } });
      if (picked?.financeBook !== financeBook) return NextResponse.json({ error: "יש ליצור מוצר חדש לשיוך כספי שונה" }, { status: 409 });
    }
    if (leadId) {
      await requireFinanceLeadAccess(viewer.userId, leadId);
    await updateLeadContactDetails({
        leadId,
        details: {
          name: customerName,
          company: businessName || undefined,
          phone,
          email,
        },
        confirmation: "ADMIN_CONFIRMED",
        reason: "Agreement creation contact synchronization",
        actor: { userId: viewer.userId, role: "ADMIN" },
      });
    }
    const agreementDraft = {
        financeBook,
        tier: tier ?? null,
        additionalServices: cleanedExtras,
        monthlyPrice,
        oneTimeFee: oneTimeFee ?? null,
        customerName,
        businessName: businessName || null,
        idNumber: idNumber || null,
        phone,
        email,
        content,
        locale,
        vatExempt,
        ownershipMonths,
        documentVersion: AGREEMENT_DOCUMENT_VERSION,
        clientId: clientId ?? null,
      } as const;
    const agreement = await prisma.$transaction(async (transaction) => {
      const store = {
        transaction: <T>(operation: (db: Prisma.TransactionClient) => Promise<T>) => operation(transaction),
      };
      const created = leadId
        ? await createAgreementForLead({
            leadId,
            actor: { userId: viewer.userId, role: "ADMIN" },
            agreement: agreementDraft,
          }, { store })
        : await createStandaloneAgreement({
            actor: { userId: viewer.userId, role: "ADMIN" },
            agreement: agreementDraft,
          }, { store });

      // The conditional claim and agreement creation commit together. A
      // concurrent claim cannot replace an existing agreement or leave an orphan.
      if (clientId && productId) {
        await claimUnlinkedProductForAgreement(transaction, {
          productId, clientId, financeBook, agreementId: created.id,
        });
      } else if (clientId && newProductName) {
        await transaction.clientProduct.create({
          data: {
            clientId,
            financeBook,
            name: newProductName,
            monthlyAmount: vatExempt ? monthlyPrice : withVat(monthlyPrice),
            status: "",
            agreementId: created.id,
          },
        });
      }
      return created;
    }, { isolationLevel: "Serializable" });

    return NextResponse.json(redactFinanceAgreement(viewer, agreement), { status: 201 });
  } catch (error) {
    const financeError = viewerErrorResponse(error);
    if (financeError) return financeError;
    console.error("Error creating agreement:", error);
    return leadDomainErrorResponse(error);
  }
}
