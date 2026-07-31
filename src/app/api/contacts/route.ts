import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { createContactSchema } from "@/lib/validations";
import { resolveEligibleSellerId } from "@/lib/leads/assignment";
import { createLeadFromSource } from "@/lib/leads/lifecycle";
import { websiteAttributionFromReferrer } from "@/lib/leads/source";

// POST - Public: create contact submission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Honeypot check: if _hp field has a value, it's likely a bot
    if (body._hp) {
      return NextResponse.json({ id: "ok" }, { status: 201 });
    }

    // Remove honeypot field before validation
    const { _hp, ...cleanBody } = body;
    void _hp;

    const parsed = createContactSchema.safeParse(cleanBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const now = new Date();
    const contact = await createLeadFromSource({
      intentLevel: "INBOUND",
      sourceKey: "website",
      sourceSnapshot: {
        ...websiteAttributionFromReferrer(request.headers.get("referer")),
        ...(parsed.data.service ? { service: parsed.data.service } : {}),
        receivedAt: now.toISOString(),
      },
      occurredAt: now,
      captureMode: "LIVE",
      eligibleSellerId: await resolveEligibleSellerId(),
      name: parsed.data.name,
      company: parsed.data.company,
      email: parsed.data.email,
      phone: parsed.data.phone,
      message: parsed.data.message,
      // The structured product-interest column, not just snapshot metadata —
      // analytics and the category icons key off ContactSubmission.service.
      service: parsed.data.service,
    });

    // Public response: never leak internal assignment/ownership columns.
    const {
      ownerId: _ownerId,
      eligibleSellerId: _eligibleSellerId,
      ...publicContact
    } = contact;
    void _ownerId;
    void _eligibleSellerId;

    return NextResponse.json(publicContact, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Auth required: list all contacts
export async function GET(request: NextRequest) {
  try {
    await requireOwner();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      prisma.contactSubmission.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contactSubmission.count(),
    ]);

    return NextResponse.json({
      data: contacts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
