export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    META_APP_ID: {
      present: !!process.env.META_APP_ID,
      length: (process.env.META_APP_ID ?? "").length,
    },
    META_APP_SECRET: {
      present: !!process.env.META_APP_SECRET,
      length: (process.env.META_APP_SECRET ?? "").length,
    },
    META_REDIRECT_URI: {
      present: !!process.env.META_REDIRECT_URI,
      value: process.env.META_REDIRECT_URI ?? null,
    },
    META_WEBHOOK_VERIFY_TOKEN: {
      present: !!process.env.META_WEBHOOK_VERIFY_TOKEN,
      length: (process.env.META_WEBHOOK_VERIFY_TOKEN ?? "").length,
    },
    META_PAGE_ID: {
      present: !!process.env.META_PAGE_ID,
      value: process.env.META_PAGE_ID ?? null,
    },
    FACEBOOK_LEAD_FORM_ID: {
      present: !!process.env.FACEBOOK_LEAD_FORM_ID,
      value: process.env.FACEBOOK_LEAD_FORM_ID ?? null,
    },
    // A known-working var as control:
    CARDCOM_TERMINAL_PRESENT: !!process.env.CARDCOM_TERMINAL,
  });
}
