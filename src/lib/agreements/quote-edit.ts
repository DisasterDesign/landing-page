import { quoteBodyHtml, scopeFromBodyHtml } from "./one-time";
import type { QuoteLocale } from "./one-time";

/**
 * Pure decision for PATCH /api/quotes/[id]: what to refuse, and what to write.
 *
 * Kept out of the route so the guards (404 / not-a-quote / closed record) and
 * the "rebuild the price table whenever fee, VAT or language change" rule are
 * unit-tested — the owner-only route cannot be driven without a session.
 */

export type ExistingQuote = {
  kind: string;
  status: string;
  projectTitle: string | null;
  customerName: string;
  businessName: string | null;
  idNumber: string | null;
  phone: string;
  email: string;
  oneTimeFee: number | null;
  locale: string;
  vatExempt: boolean;
  customBodyHtml: string | null;
};

export type QuotePatch = {
  projectTitle?: string;
  scopeOfWork?: string;
  oneTimeFee?: number;
  customerName?: string;
  businessName?: string | null;
  idNumber?: string | null;
  phone?: string;
  email?: string;
  locale?: QuoteLocale;
  vatExempt?: boolean;
};

export type QuoteEditData = {
  projectTitle?: string;
  customerName?: string;
  businessName?: string | null;
  idNumber?: string | null;
  phone?: string;
  email?: string;
  oneTimeFee?: number;
  locale?: QuoteLocale;
  vatExempt?: boolean;
  customBodyHtml: string;
};

export type QuoteRenderInput = {
  customerName: string;
  businessName: string | undefined;
  idNumber: string | undefined;
  phone: string;
  email: string;
  oneTimeFee: number;
  locale: QuoteLocale;
  vatExempt: boolean;
  customBodyHtml: string;
};

export type QuoteEditPlan =
  | { kind: "refuse"; status: 400 | 404 | 409; error: string }
  | { kind: "apply"; data: QuoteEditData; render: QuoteRenderInput };

export function planQuoteEdit(
  existing: ExistingQuote | null,
  patch: QuotePatch,
): QuoteEditPlan {
  if (!existing) return { kind: "refuse", status: 404, error: "Not found" };
  if (existing.kind !== "ONE_TIME") {
    // Subscription agreements have their own edit route with tier logic.
    return { kind: "refuse", status: 400, error: "Not a quote" };
  }
  if (existing.status === "SIGNED" || existing.status === "CANCELLED") {
    return {
      kind: "refuse",
      status: 409,
      error: "הצעה חתומה או מבוטלת היא רשומה סגורה ולא ניתן לערוך אותה.",
    };
  }

  const locale: QuoteLocale = (patch.locale ?? existing.locale) === "en" ? "en" : "he";
  const merged = {
    customerName: patch.customerName ?? existing.customerName,
    businessName: patch.businessName !== undefined ? patch.businessName : existing.businessName,
    idNumber: patch.idNumber !== undefined ? patch.idNumber : existing.idNumber,
    phone: patch.phone ?? existing.phone,
    email: patch.email ?? existing.email,
    oneTimeFee: patch.oneTimeFee ?? existing.oneTimeFee ?? 0,
    locale,
    vatExempt: patch.vatExempt ?? existing.vatExempt,
  };

  // The price table lives inside the body. Anything that appears in it —
  // scope, fee, VAT status, language — forces a rebuild; the scope is not
  // stored as text, so when it was not resent it is recovered from the body.
  const bodyAffected =
    patch.scopeOfWork !== undefined ||
    patch.oneTimeFee !== undefined ||
    patch.vatExempt !== undefined ||
    patch.locale !== undefined;
  const customBodyHtml = bodyAffected
    ? quoteBodyHtml({
        scope: patch.scopeOfWork ?? scopeFromBodyHtml(existing.customBodyHtml),
        oneTimeFee: merged.oneTimeFee,
        vatExempt: merged.vatExempt,
        locale: merged.locale,
      })
    : (existing.customBodyHtml ?? "");

  const data: QuoteEditData = {
    ...(patch.projectTitle !== undefined ? { projectTitle: patch.projectTitle } : {}),
    ...(patch.customerName !== undefined ? { customerName: patch.customerName } : {}),
    ...(patch.businessName !== undefined ? { businessName: patch.businessName } : {}),
    ...(patch.idNumber !== undefined ? { idNumber: patch.idNumber } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    ...(patch.email !== undefined ? { email: patch.email } : {}),
    ...(patch.oneTimeFee !== undefined ? { oneTimeFee: patch.oneTimeFee } : {}),
    ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
    ...(patch.vatExempt !== undefined ? { vatExempt: patch.vatExempt } : {}),
    customBodyHtml,
  };

  return {
    kind: "apply",
    data,
    render: {
      customerName: merged.customerName,
      businessName: merged.businessName ?? undefined,
      idNumber: merged.idNumber ?? undefined,
      phone: merged.phone,
      email: merged.email,
      oneTimeFee: merged.oneTimeFee,
      locale: merged.locale,
      vatExempt: merged.vatExempt,
      customBodyHtml,
    },
  };
}
