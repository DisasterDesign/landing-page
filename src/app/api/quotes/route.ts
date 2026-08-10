import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createOneTimeQuoteSchema } from "@/lib/validations";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { quoteJobInput, quoteBodyHtml } from "@/lib/agreements/one-time";
import { jobFinance, expectedPaymentDate } from "@/lib/finance";
import { createStandaloneAgreement } from "@/lib/leads/agreement-lifecycle";
import {
  renderAgreement,
  AGREEMENT_DOCUMENT_VERSION,
} from "@/lib/agreement-templates";

/**
 * One-time project quotes — Agreements with `kind = ONE_TIME`.
 *
 * Owner-only on both verbs. Not `role === "ADMIN"`: per the partner model
 * (src/lib/auth/viewer.ts) ADMIN ⊆ owner is not guaranteed, and `isOwner` is
 * the real gate for owner-only surfaces. Spec:
 * docs/superpowers/specs/2026-08-10-one-time-project-quotes-design.md
 */

export async function GET() {
  try {
    await requireOwner();

    const quotes = await prisma.agreement.findMany({
      where: { kind: "ONE_TIME" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        projectTitle: true,
        customerName: true,
        businessName: true,
        phone: true,
        email: true,
        oneTimeFee: true,
        status: true,
        paymentStatus: true,
        // A bearer credential for /agreement/[token]. It ships here for the
        // same reason it ships on /api/agreements: this route is owner-only,
        // and the owner is precisely the person who sends the signing link.
        signToken: true,
        signedAt: true,
        paidAt: true,
        createdAt: true,
      },
    });

    const now = new Date();
    const rows = quotes.map((q) => {
      const base = quoteJobInput(q);
      const money = jobFinance(base);
      const expected = expectedPaymentDate(base.closedAt, base.paymentTermsDays);
      return {
        ...base,
        ...money,
        closedAt: base.closedAt.toISOString(),
        paidAt: base.paidAt ? base.paidAt.toISOString() : null,
        expectedPaidAt: expected.toISOString(),
        // A quote is settled at signature, so it is never "overdue" in the
        // שוטף+N sense a ClientJob can be.
        overdue: false,
        notes: null,
        agreementStatus: q.status,
        paymentStatus: q.paymentStatus,
        signToken: q.signToken,
        phone: q.phone,
        email: q.email,
        signedAt: q.signedAt ? q.signedAt.toISOString() : null,
        createdAt: q.createdAt.toISOString(),
        isFuture: base.closedAt > now ? true : false,
      };
    });

    return NextResponse.json({ data: rows });
  } catch (error) {
    const viewerError = viewerErrorResponse(error);
    if (viewerError) return viewerError;
    console.error("Error fetching quotes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireOwner();

    const body = await request.json();
    const parsed = createOneTimeQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const q = parsed.data;

    // The sign page renders `agreement.content`, and renderAgreement only runs
    // again at signing — so a draft created with an empty content field shows
    // the customer a blank white document. Render it here, exactly as the
    // subscription route does at creation time.
    const scopeHtml = quoteBodyHtml({
      scope: q.scopeOfWork,
      oneTimeFee: q.oneTimeFee,
      vatExempt: q.vatExempt,
      locale: q.locale,
    });
    const content = renderAgreement(null, {
      customerName: q.customerName,
      businessName: q.businessName,
      idNumber: q.idNumber,
      phone: q.phone,
      email: q.email,
      monthlyPrice: q.monthlyPrice,
      oneTimeFee: q.oneTimeFee,
      tier: null,
      additionalServices: [],
      date: new Date().toLocaleDateString(q.locale === "en" ? "en-GB" : "he-IL"),
      locale: q.locale,
      vatExempt: q.vatExempt,
      customBodyHtml: scopeHtml,
    });

    // Delegated rather than written here on purpose: agreement creation lives
    // in agreement-lifecycle.ts so every agreement gets its lifecycle event,
    // and writer-boundary.test.ts enforces it. No clientId is passed, so the
    // quote is left unattributed — a house deal, invisible to partners.
    const quote = await createStandaloneAgreement({
      actor: { userId: viewer.userId, role: "ADMIN" },
      agreement: {
        kind: q.kind,
        projectTitle: q.projectTitle,
        // Zero monthly is what keeps BillGold out: the recurring gate in the
        // payment webhook requires monthlyPrice > 0.
        monthlyPrice: q.monthlyPrice,
        oneTimeFee: q.oneTimeFee,
        tier: q.tier,
        additionalServices: [],
        customerName: q.customerName,
        businessName: q.businessName || null,
        idNumber: q.idNumber || null,
        phone: q.phone,
        email: q.email,
        locale: q.locale,
        vatExempt: q.vatExempt,
        // The scope of work IS the legal body — same mechanism the Ormat
        // proposal used. renderAgreement slots it in instead of a tier template.
        customBodyHtml: scopeHtml,
        content,
        documentVersion: AGREEMENT_DOCUMENT_VERSION,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: quote.id,
          signToken: quote.signToken,
          projectTitle: quote.projectTitle,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const viewerError = viewerErrorResponse(error);
    if (viewerError) return viewerError;
    console.error("Error creating quote:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
