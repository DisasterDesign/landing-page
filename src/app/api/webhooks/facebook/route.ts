export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import {
  getMetaConfig,
  verifyWebhookSignature,
  getLead,
  type LeadDetail,
} from "@/lib/facebook";
import { ingestMetaLead } from "@/lib/leads/meta-ingestion";

// ===== Subscription verification (Meta GET) =====
export async function GET(req: NextRequest) {
  const cfg = getMetaConfig();
  if (!cfg) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === cfg.verifyToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ===== Lead events (Meta POST) =====
interface LeadgenChange {
  field: "leadgen";
  value: {
    leadgen_id: string;
    page_id: string;
    form_id?: string;
    created_time?: number;
    ad_id?: string;
  };
}

interface WebhookPayload {
  object: "page";
  entry: Array<{
    id: string;
    time: number;
    changes: LeadgenChange[];
  }>;
}

async function processLead(
  leadId: string,
  pageAccessToken: string
): Promise<void> {
  const lead: LeadDetail = await getLead(leadId, pageAccessToken);

  // Double-check form ID after fetch (webhook payload may omit form_id).
  const allowedFormId = process.env.FACEBOOK_LEAD_FORM_ID || "1505628047948105";
  if (allowedFormId && lead.form_id && lead.form_id !== allowedFormId) {
    console.info(
      `FB webhook: skipping lead ${lead.id} from form ${lead.form_id} (expected ${allowedFormId})`
    );
    return;
  }

  await ingestMetaLead(lead, { mode: "WEBHOOK" });
}

export async function POST(req: NextRequest) {
  const cfg = getMetaConfig();
  if (!cfg) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  // Read raw body BEFORE parsing — signature is over the exact bytes Meta sent
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature, cfg.appSecret)) {
    console.warn("FB webhook: signature verification failed");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.object !== "page") {
    // Ignore other object types — return 200 so Meta doesn't retry
    return NextResponse.json({ ok: true });
  }

  // Optional scoping via env — if set, ignore anything not matching.
  // Hardcoded fallbacks due to Vercel env injection bug.
  const allowedPageId = process.env.META_PAGE_ID || "482956251578120";
  const allowedFormId = process.env.FACEBOOK_LEAD_FORM_ID || "1505628047948105";

  // Process leads in the background after responding 200 (so we stay <5s)
  // Actually we'll await — the calls are fast, and Vercel may not run our
  // background work after the response in serverless. Trade-off: be quick.
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const { leadgen_id, page_id, form_id } = change.value;

      if (allowedPageId && page_id !== allowedPageId) {
        console.info(`FB webhook: skipping page ${page_id} (expected ${allowedPageId})`);
        continue;
      }
      // Cheap early filter — form_id is present in most payloads, and
      // processLead() re-checks after fetching the full lead.
      if (allowedFormId && form_id && form_id !== allowedFormId) {
        console.info(`FB webhook: skipping form ${form_id} (expected ${allowedFormId})`);
        continue;
      }

      try {
        const integ = await prisma.facebookIntegration.findUnique({
          where: { pageId: page_id },
        });
        if (!integ) {
          console.warn(`FB webhook: no integration for pageId=${page_id}`);
          continue;
        }
        const token = decrypt(integ.pageAccessToken);
        await processLead(leadgen_id, token);
      } catch (err) {
        console.error("FB webhook lead processing error:", err);
        // Continue with the next change — don't fail the whole batch
      }
    }
  }

  return NextResponse.json({ ok: true });
}
