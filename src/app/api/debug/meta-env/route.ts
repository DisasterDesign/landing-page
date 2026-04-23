export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    META_APP_ID_present: !!process.env.META_APP_ID,
    META_APP_ID_length: (process.env.META_APP_ID ?? "").length,
    META_APP_SECRET_present: !!process.env.META_APP_SECRET,
    META_REDIRECT_URI_present: !!process.env.META_REDIRECT_URI,
    META_REDIRECT_URI_value: process.env.META_REDIRECT_URI ?? null,
    META_WEBHOOK_VERIFY_TOKEN_present: !!process.env.META_WEBHOOK_VERIFY_TOKEN,
    META_PAGE_ID_value: process.env.META_PAGE_ID ?? null,
    FACEBOOK_LEAD_FORM_ID_value: process.env.FACEBOOK_LEAD_FORM_ID ?? null,
    CARDCOM_TERMINAL_present: !!process.env.CARDCOM_TERMINAL,
    TEST_FOOBAR_present: !!process.env.TEST_FOOBAR,
    TEST_FOOBAR_value: process.env.TEST_FOOBAR ?? null,
    // Sanity check: list all META_/FACEBOOK_/TEST_ keys process.env knows
    all_custom_keys: Object.keys(process.env).filter(
      (k) =>
        k.startsWith("META_") ||
        k.startsWith("FACEBOOK_") ||
        k.startsWith("TEST_") ||
        k.startsWith("CARDCOM_")
    ),
  });
}
