/**
 * Cardcom LowProfile API client.
 * Docs: https://secure.cardcom.solutions/api/v11/
 */

const CARDCOM_BASE = "https://secure.cardcom.solutions/api/v11";

export function getCardcomConfig(): {
  terminal: number;
  apiName: string;
  apiPassword: string;
} | null {
  // Hardcoded fallbacks — mirrors the Meta credential pattern in facebook.ts.
  // CARDCOM env vars are currently injected correctly at runtime, but these
  // defensive fallbacks keep the payment flow alive if Vercel ever drops them.
  const terminal = process.env.CARDCOM_TERMINAL || "149683";
  const apiName = process.env.CARDCOM_API_NAME || "jWKlFC665ftyMxMw8AKQ";
  const apiPassword = process.env.CARDCOM_API_PASSWORD || "I3iWutMOIzjcrTkpGGgB";
  if (!terminal || !apiName || !apiPassword) return null;
  const tNum = Number(terminal);
  if (!Number.isFinite(tNum)) return null;
  return { terminal: tNum, apiName, apiPassword };
}

export interface CreatePaymentInput {
  agreementId: string;
  amount: number;
  productName: string;
  saveToken: boolean;
  successUrl: string;
  failedUrl: string;
  webhookUrl: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface CreatePaymentResult {
  url: string;
  lowProfileId: string;
}

export class CardcomError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "CardcomError";
    this.status = status;
    this.body = body;
  }
}

interface LowProfileCreateResponse {
  LowProfileId?: string;
  Url?: string;
  ResponseCode?: number;
  Description?: string;
  Status?: number;
  Message?: string;
}

/**
 * Creates a hosted Cardcom checkout page for a signed agreement.
 * Returns the URL to redirect the customer to.
 */
export async function createPaymentPage(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const cfg = getCardcomConfig();
  if (!cfg) throw new CardcomError("Cardcom credentials not configured");

  // ApiPassword intentionally NOT included at top-level for LowProfile/Create
  // — per Cardcom v11 docs it belongs only inside AdvancedDefinition for
  // refunds/cancellations.
  const body = {
    TerminalNumber: cfg.terminal,
    ApiName: cfg.apiName,
    Operation: input.saveToken ? "ChargeAndCreateToken" : "ChargeOnly",
    Amount: Number(input.amount.toFixed(2)),
    SuccessRedirectUrl: input.successUrl,
    FailedRedirectUrl: input.failedUrl,
    WebHookUrl: input.webhookUrl,
    ReturnValue: input.agreementId,
    ProductName: input.productName,
    Language: "he",
    ISOCoinId: 1, // ILS
    Document: {
      DocumentTypeToCreate: "Auto",
      Name: input.customer.name,
      Email: input.customer.email,
      ...(input.customer.phone ? { Phone: input.customer.phone } : {}),
      Products: [
        {
          Description: input.productName,
          UnitCost: Number(input.amount.toFixed(2)),
          Quantity: 1,
        },
      ],
    },
  };

  const res = await fetch(`${CARDCOM_BASE}/LowProfile/Create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let json: LowProfileCreateResponse;
  try {
    json = (await res.json()) as LowProfileCreateResponse;
  } catch {
    throw new CardcomError(`Cardcom returned non-JSON (status ${res.status})`, res.status);
  }

  if (!res.ok) {
    throw new CardcomError(`Cardcom HTTP ${res.status}: ${json?.Description ?? "unknown"}`, res.status, json);
  }

  const code = json.ResponseCode ?? json.Status;
  if (code !== 0 || !json.Url || !json.LowProfileId) {
    throw new CardcomError(
      `Cardcom rejected request: ${json.Description ?? json.Message ?? "unknown"} (code ${code})`,
      undefined,
      json
    );
  }

  return { url: json.Url, lowProfileId: json.LowProfileId };
}

export interface ChargeTokenInput {
  token: string;
  amount: number;
  productName: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  externalReference?: string;
}

interface ChargeTokenResponse {
  ResponseCode?: number;
  Description?: string;
  InternalDealNumber?: number | string;
  DocumentNumber?: number | string;
}

/**
 * Charges a previously-saved Cardcom token (recurring monthly billing).
 */
export async function chargeToken(input: ChargeTokenInput): Promise<{
  dealId: string;
  invoiceNumber?: string;
}> {
  const cfg = getCardcomConfig();
  if (!cfg) throw new CardcomError("Cardcom credentials not configured");

  // ChargeToken (direct token charging, step 3 in Cardcom flow) DOES need
  // ApiPassword at the top level.
  const body = {
    TerminalNumber: cfg.terminal,
    ApiName: cfg.apiName,
    ApiPassword: cfg.apiPassword,
    Token: input.token,
    Amount: Number(input.amount.toFixed(2)),
    ISOCoinId: 1,
    ProductName: input.productName,
    Document: {
      DocumentTypeToCreate: "Auto",
      Name: input.customer.name,
      Email: input.customer.email,
      ...(input.customer.phone ? { Phone: input.customer.phone } : {}),
      Products: [
        {
          Description: input.productName,
          UnitCost: Number(input.amount.toFixed(2)),
          Quantity: 1,
        },
      ],
    },
    ...(input.externalReference ? { ExternalReference: input.externalReference } : {}),
  };

  const res = await fetch(`${CARDCOM_BASE}/Transactions/ChargeToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let json: ChargeTokenResponse;
  try {
    json = (await res.json()) as ChargeTokenResponse;
  } catch {
    throw new CardcomError(`Cardcom returned non-JSON (status ${res.status})`, res.status);
  }

  if (!res.ok || json.ResponseCode !== 0 || json.InternalDealNumber == null) {
    throw new CardcomError(
      `Cardcom token charge failed: ${json.Description ?? "unknown"}`,
      res.status,
      json
    );
  }

  return {
    dealId: String(json.InternalDealNumber),
    invoiceNumber: json.DocumentNumber != null ? String(json.DocumentNumber) : undefined,
  };
}

export interface CardcomWebhookPayload {
  ReturnValue?: string;
  DealResponse?: number;
  ResponseCode?: number;
  InternalDealNumber?: number | string;
  Token?: string;
  CardOwnerName?: string;
  CardOwnerEmail?: string;
  CardOwnerPhone?: string;
  Sum?: number | string;
  Amount?: number | string;
  DocumentNumber?: number | string;
  LowProfileId?: string;
  [key: string]: unknown;
}

export function isWebhookSuccess(p: CardcomWebhookPayload): boolean {
  const code = p.DealResponse ?? p.ResponseCode;
  return code === 0 || (typeof code === "string" && code === "0");
}

export function extractWebhookAmount(p: CardcomWebhookPayload): number | null {
  const raw = p.Sum ?? p.Amount;
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}
