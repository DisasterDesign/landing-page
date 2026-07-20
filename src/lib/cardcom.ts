/**
 * Cardcom LowProfile API client.
 * Docs: https://secure.cardcom.solutions/api/v11/
 *
 * This file ALSO wraps Cardcom's legacy SOAP endpoint
 * (BillGoldService.asmx) for creating and cancelling recurring orders —
 * v11 REST has no endpoint for that. See createRecurringOrder() below.
 */

const CARDCOM_BASE = "https://secure.cardcom.solutions/api/v11";
const BILLGOLD_URL = "https://secure.cardcom.solutions/Interface/BillGoldService.asmx";

export function getCardcomConfig(): {
  terminal: number;
  apiName: string;
  apiPassword: string;
} | null {
  const terminal = process.env.CARDCOM_TERMINAL;
  const apiName = process.env.CARDCOM_API_NAME;
  const apiPassword = process.env.CARDCOM_API_PASSWORD;
  if (!terminal || !apiName || !apiPassword) return null;
  const tNum = Number(terminal);
  if (!Number.isFinite(tNum)) return null;
  return { terminal: tNum, apiName, apiPassword };
}

/**
 * Legacy BillGoldService auth — a SEPARATE username/password pair from the
 * v11 REST credentials. Provisioned in the Cardcom Dashboard under the
 * "שם משתמש וסיסמה לממשקים" section. Required for recurring-order SOAP calls.
 */
export function getBillGoldConfig(): {
  terminal: number;
  userName: string;
  password: string;
} | null {
  const terminal = process.env.CARDCOM_TERMINAL;
  const userName = process.env.CARDCOM_BILLGOLD_USERNAME;
  const password = process.env.CARDCOM_BILLGOLD_PASSWORD;
  if (!terminal || !userName || !password) return null;
  const tNum = Number(terminal);
  if (!Number.isFinite(tNum)) return null;
  return { terminal: tNum, userName, password };
}

export type CardcomLanguage = "he" | "en";

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
  /** Hosted page + invoice language. Default "he". */
  language?: CardcomLanguage;
  /** Issue a zero-VAT (VAT-free) invoice — foreign clients. Default false. */
  vatFree?: boolean;
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
  const language: CardcomLanguage = input.language === "en" ? "en" : "he";
  const vatFree = !!input.vatFree;

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
    Language: language, // hosted payment page language
    ISOCoinId: 1, // ILS — foreign clients are still billed in ₪ (no terminal change)
    Document: {
      DocumentTypeToCreate: "Auto",
      // Invoice/receipt PDF language — separate from the page Language above.
      Language: language,
      Name: input.customer.name,
      Email: input.customer.email,
      ...(input.customer.phone ? { Phone: input.customer.phone } : {}),
      // Zero-rate VAT on the document (export of services). When false Cardcom
      // computes 18% VAT out of the VAT-inclusive amount as before.
      ...(vatFree ? { IsVatFree: true } : {}),
      Products: [
        {
          Description: input.productName,
          UnitCost: Number(input.amount.toFixed(2)),
          Quantity: 1,
          ...(vatFree ? { IsVatFree: true } : {}),
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
 *
 * Note: `Agreement.cardcomToken` is stored encrypted (AES-256-GCM via
 * src/lib/crypto.ts). Callers that read the token from the DB MUST call
 * `decrypt()` on it before passing to this function. Tokens sourced
 * directly from a webhook payload are already plaintext.
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
  RecurringId?: number | string;
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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface CreateRecurringOrderInput {
  agreementId: string;
  cardcomToken: string;
  monthlyAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  productDescription: string;
}

/**
 * Registers a monthly recurring charge with Cardcom via the BillGold SOAP
 * endpoint. Call AFTER the first LowProfile charge succeeds and a token was
 * issued — Cardcom will then charge the card on its own each month and POST
 * the usual webhook back with a RecurringId field set.
 */
export async function createRecurringOrder(
  input: CreateRecurringOrderInput
): Promise<{ recurringId: number; accountId: number }> {
  const cfg = getBillGoldConfig();
  if (!cfg) throw new CardcomError("BillGold credentials not configured");

  const nextBill = new Date();
  nextBill.setDate(nextBill.getDate() + 30);
  const nextBillStr = nextBill.toISOString().split("T")[0]; // YYYY-MM-DD

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AddUpdateRecurringOrder xmlns="https://www.cardcom.co.il/">
      <TerminalNumber>${cfg.terminal}</TerminalNumber>
      <UserName>${escapeXml(cfg.userName)}</UserName>
      <Password>${escapeXml(cfg.password)}</Password>
      <RecurringOrder>
        <Operation>NewAndUpdate</Operation>
        <Account>
          <CompanyName>${escapeXml(input.customerName)}</CompanyName>
          <ContactName>${escapeXml(input.customerName)}</ContactName>
          <Email>${escapeXml(input.customerEmail)}</Email>
          ${input.customerPhone ? `<PhMobile>${escapeXml(input.customerPhone)}</PhMobile>` : ""}
          <RecurringPaymentsActive>true</RecurringPaymentsActive>
          <IsDocumentLangEnglish>false</IsDocumentLangEnglish>
        </Account>
        <CreditCard>
          <Token>${escapeXml(input.cardcomToken)}</Token>
        </CreditCard>
        <RecurringPayments>
          <ExtRecurringPayments>
            <Operation>NewAndUpdate</Operation>
            <TimeIntervalId>1</TimeIntervalId>
            <FinalDebitCoinId>1</FinalDebitCoinId>
            <DocTypeToCreate>3</DocTypeToCreate>
            <NextDateToBill>${nextBillStr}</NextDateToBill>
            <TotalNumOfBills>0</TotalNumOfBills>
            <NumOfPaymentsAlreadyCharged>1</NumOfPaymentsAlreadyCharged>
            <IsActive>true</IsActive>
            <IsInvoiceCreate>true</IsInvoiceCreate>
            <InternalDecription>${escapeXml(input.productDescription)}</InternalDecription>
            <ReturnValue>${escapeXml(input.agreementId)}</ReturnValue>
            <FlexItem><Price>${input.monthlyAmount.toFixed(2)}</Price></FlexItem>
          </ExtRecurringPayments>
        </RecurringPayments>
      </RecurringOrder>
    </AddUpdateRecurringOrder>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch(BILLGOLD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: '"https://www.cardcom.co.il/AddUpdateRecurringOrder"',
    },
    body: soapBody,
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new CardcomError(`BillGold HTTP ${res.status}`, res.status, text);
  }

  const codeMatch = text.match(/<ResponseCode>(-?\d+)<\/ResponseCode>/);
  const descMatch = text.match(/<Description>([^<]*)<\/Description>/);
  const code = codeMatch ? Number(codeMatch[1]) : -1;
  if (code !== 0) {
    throw new CardcomError(
      `BillGold rejected: ${descMatch?.[1] ?? "unknown"} (code ${code})`,
      undefined,
      text
    );
  }

  const recurringIdMatch = text.match(/<RecurringId>(\d+)<\/RecurringId>/);
  const accountIdMatch = text.match(/<AccountId>(\d+)<\/AccountId>/);

  return {
    recurringId: recurringIdMatch ? Number(recurringIdMatch[1]) : 0,
    accountId: accountIdMatch ? Number(accountIdMatch[1]) : 0,
  };
}

const RECURRING_NTV_URL =
  "https://secure.cardcom.solutions/interface/RecurringPayment.aspx";

function formatDateDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export interface CreateRecurringOrderNTVInput {
  /**
   * Card identification — provide exactly one. Either the LowProfile GUID
   * captured from the first-charge webhook, OR the Cardcom Token saved on
   * the agreement (must be decrypted before passing in here).
   */
  lowProfileDealGuid?: string;
  cardcomToken?: string;
  monthlyAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  productDescription: string;
  agreementId: string;
  /** English recurring invoices (foreign clients). Default false (Hebrew). */
  documentLangEnglish?: boolean;
  /** Zero-VAT recurring invoices (foreign clients). Default false. */
  vatFree?: boolean;
}

/**
 * Registers a monthly recurring charge via Cardcom's Name-to-Value API
 * (RecurringPayment.aspx). The card is identified either by the LowProfile
 * GUID returned in the first-charge webhook (preferred for new payments) or
 * by a saved Cardcom Token (used to recover legacy agreements that pre-date
 * the LowProfileId capture). Password is intentionally NOT included — NTV
 * authenticates with TerminalNumber + UserName only.
 *
 * Date format MUST be dd/MM/yyyy (NOT ISO).
 */
export async function createRecurringOrderNTV(
  input: CreateRecurringOrderNTVInput
): Promise<{ recurringId: number; accountId: number }> {
  const cfg = getBillGoldConfig();
  if (!cfg) throw new CardcomError("BillGold credentials not configured");

  if (!input.lowProfileDealGuid && !input.cardcomToken) {
    throw new CardcomError(
      "createRecurringOrderNTV: must provide lowProfileDealGuid or cardcomToken"
    );
  }

  const nextBill = new Date();
  nextBill.setDate(nextBill.getDate() + 30);
  const nextBillStr = formatDateDDMMYYYY(nextBill);

  const params = new URLSearchParams();
  params.set("TerminalNumber", String(cfg.terminal));
  params.set("UserName", cfg.userName);
  params.set("codepage", "65001");
  params.set("Operation", "NewAndUpdate");
  if (input.lowProfileDealGuid) {
    params.set("LowProfileDealGuid", input.lowProfileDealGuid);
  } else if (input.cardcomToken) {
    params.set("CreditCard.Token", input.cardcomToken);
  }

  // Account
  params.set("Account.CompanyName", input.customerName);
  params.set("Account.Email", input.customerEmail);
  if (input.customerPhone) params.set("Account.PhMobile", input.customerPhone);
  // Foreign clients: English invoices + zero-VAT, mirroring the BillGold
  // ExtAccount.IsDocumentLangEnglish / ExtAccount.VatFree fields.
  if (input.documentLangEnglish) {
    params.set("Account.IsDocumentLangEnglish", "true");
  }
  if (input.vatFree) {
    params.set("Account.VatFree", "true");
  }

  // Recurring schedule
  params.set("RecurringPayments.InternalDecription", input.productDescription);
  params.set("RecurringPayments.NextDateToBill", nextBillStr);
  params.set("RecurringPayments.TotalNumOfBills", "999999");
  params.set("RecurringPayments.FinalDebitCoinId", "1"); // ILS
  params.set("RecurringPayments.DocTypeToCreate", "3");
  params.set("RecurringPayments.ReturnValue", input.agreementId);
  params.set("RecurringPayments.FlexItem.Price", input.monthlyAmount.toFixed(2));
  if (input.vatFree) {
    // Foreign clients: zero-rate the line itself (mirrors the LowProfile
    // per-product IsVatFree). Do NOT also assert IsPriceIncludeVat — "price
    // includes VAT" contradicts a VAT-free account and could make Cardcom
    // back 18% out of the net amount on the invoice document.
    params.set("RecurringPayments.FlexItem.IsVatFree", "true");
  } else {
    // Israeli clients: the Price is the VAT-inclusive gross.
    params.set("RecurringPayments.FlexItem.IsPriceIncludeVat", "true");
  }
  params.set(
    "RecurringPayments.FlexItem.InvoiceDescription",
    input.productDescription
  );

  const res = await fetch(RECURRING_NTV_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new CardcomError(`RecurringPayment HTTP ${res.status}`, res.status, text);
  }

  // Response format: Name=Value&Name2=Value2&...
  const result = new URLSearchParams(text);
  const code = result.get("ResponseCode");
  if (code !== "0") {
    const desc = result.get("Description") ?? "unknown";
    throw new CardcomError(
      `RecurringPayment rejected: ${desc} (code ${code})`,
      undefined,
      text
    );
  }

  const recurringId = Number(result.get("Recurring0.RecurringId") ?? 0);
  const accountId = Number(result.get("AccountId") ?? 0);

  return { recurringId, accountId };
}

// ---------------------------------------------------------------------------
// Pull APIs — reading recurring state and charge history back from Cardcom.
// Verified live (2026-07-19): these v11 endpoints are GET-only (POST → 405)
// and take their JSON in the request BODY. undici/fetch refuses GET+body, so
// they go through a raw https.request. The regular v11 credential pair
// (CARDCOM_API_NAME/PASSWORD) authenticates them — BillGold creds not needed.
// ---------------------------------------------------------------------------

function formatDateCompact(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}${mm}${d.getFullYear()}`;
}

async function cardcomGetWithBody<T>(path: string, payload: object): Promise<T> {
  const { request } = await import("node:https");
  const body = JSON.stringify(payload);
  return new Promise<T>((resolve, reject) => {
    const req = request(
      {
        host: "secure.cardcom.solutions",
        path,
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new CardcomError(`Cardcom ${path} HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
            return;
          }
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new CardcomError(`Cardcom ${path} returned non-JSON: ${data.slice(0, 300)}`));
          }
        });
      }
    );
    req.on("error", (e) => reject(new CardcomError(`Cardcom ${path} request failed: ${String(e)}`)));
    req.write(body);
    req.end();
  });
}

/** One row of a recurring order's charge history — Cardcom's debtors data.
 *  Field typos (ResposeCode) are Cardcom's own; do not "fix" them. */
export interface RecurringHistoryRow {
  RecurringId: number;
  Status: string; // SUCCESSFUL | DEBTAUTOBILLING | LOSTDEBT | PAYBYOTHERE | ONHOLD | PENDINGFORPROCESSING
  ResposeCode?: number; // credit-company decline code for failed attempts
  BillingAttempts?: number;
  TranzactionId?: number; // InternalDealNumber of the actual charge
  SumToBill?: number;
  DocumentNumber?: number;
  CreateDate?: string; // when the charge row was created = billing date
  LastDate?: string; // last status update
  ReturnValue?: string; // our agreementId, echoed back
}

export async function getRecurringPaymentHistory(input: {
  accountId: number;
  fromDate: Date;
  toDate: Date;
}): Promise<RecurringHistoryRow[]> {
  const cfg = getCardcomConfig();
  if (!cfg) throw new CardcomError("Cardcom credentials not configured");
  const res = await cardcomGetWithBody<{
    ResponseCode: number;
    Description?: string;
    RecurringPaymentHistory?: RecurringHistoryRow[];
  }>("/api/v11/RecuringPayments/GetRecurringPaymentHistory", {
    ApiUserName: cfg.apiName,
    ApiPassword: cfg.apiPassword,
    AccountId: input.accountId,
    // NOT formatDateDDMMYYYY (that one is DD/MM/YYYY for the NTV interface) —
    // this endpoint rejects separators: "must be in format DDMMYYYY".
    FromDate: formatDateCompact(input.fromDate),
    ToDate: formatDateCompact(input.toDate),
  });
  if (res.ResponseCode !== 0) {
    throw new CardcomError(`GetRecurringPaymentHistory failed: ${res.ResponseCode} ${res.Description ?? ""}`);
  }
  return res.RecurringPaymentHistory ?? [];
}

/** Live state of a recurring order: is it actually active, when does it bill
 *  next, how many charges ran. The fields the DB has no source for today. */
export interface RecurringState {
  RecurringId: number;
  IsActive: boolean;
  NextDateToBill?: string;
  NumOfPaymentsAlreadyCharged?: number;
  ReturnValue?: string; // our agreementId
  FlexItem?: { Price?: number };
}

export async function getRecurringPaymentState(accountId: number): Promise<RecurringState[]> {
  const cfg = getCardcomConfig();
  if (!cfg) throw new CardcomError("Cardcom credentials not configured");
  const res = await cardcomGetWithBody<{
    ResponseCode: number;
    Description?: string;
    UpdateList?: RecurringState[];
  }>("/api/v11/RecuringPayments/GetRecurringPayment", {
    ApiUserName: cfg.apiName,
    ApiPassword: cfg.apiPassword,
    AccountId: accountId,
  });
  if (res.ResponseCode !== 0) {
    throw new CardcomError(`GetRecurringPayment failed: ${res.ResponseCode} ${res.Description ?? ""}`);
  }
  return res.UpdateList ?? [];
}

/** A failed transaction from the terminal-wide sweep (ListTransactions). */
export interface FailedTransaction {
  TranzactionId: number;
  Amount: number;
  CreateDate: string;
  CardOwnerName?: string;
  CardOwnerIdentityNumber?: string;
  ResponseCode: number;
  Description?: string;
  IssuerAuthCodeDescription?: string;
  DealType?: string;
  Last4CardDigitsString?: string;
}

const PAGE_SIZE = 100;
// Guard against an unbounded loop if Cardcom ever stops shrinking the last
// page. 20 pages = 2000 transactions, far beyond any 45-day window here.
const MAX_PAGES = 20;

/**
 * Terminal-wide transactions of one status, all pages.
 *
 * Catches activity on recurring orders that were created MANUALLY in the
 * Cardcom dashboard and are therefore invisible to the per-account reconcile
 * (no agreement stores their AccountId). This is how פיקס טיקטס' three months
 * of debt existed while our books showed quiet. Regular POST endpoint, unlike
 * the GET-with-body recurring reads.
 */
export async function listTransactionsByStatus(input: {
  status: "Failure" | "Success";
  fromDate: Date;
  toDate: Date;
}): Promise<FailedTransaction[]> {
  const cfg = getCardcomConfig();
  if (!cfg) throw new CardcomError("Cardcom credentials not configured");

  const all: FailedTransaction[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${CARDCOM_BASE}/Transactions/ListTransactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ApiName: cfg.apiName,
        ApiPassword: cfg.apiPassword,
        FromDate: formatDateCompact(input.fromDate),
        ToDate: formatDateCompact(input.toDate),
        TranStatus: input.status,
        Page: page,
        Page_size: PAGE_SIZE,
      }),
    });
    if (!res.ok) throw new CardcomError(`ListTransactions HTTP ${res.status}`);
    const json = (await res.json()) as {
      ResponseCode: number;
      Description?: string;
      Tranzactions?: FailedTransaction[];
    };
    if (json.ResponseCode !== 0) {
      throw new CardcomError(
        `ListTransactions failed: ${json.ResponseCode} ${json.Description ?? ""}`
      );
    }
    const rows = json.Tranzactions ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

/** Terminal-wide failed transactions — the debt side of the sweep. */
export async function listFailedTransactions(input: {
  fromDate: Date;
  toDate: Date;
}): Promise<FailedTransaction[]> {
  return listTransactionsByStatus({ ...input, status: "Failure" });
}

/**
 * Terminal-wide successful transactions — the settlement side. Without these
 * the sweep can only ever ADD debtors: a debt that gets paid would sit on the
 * report until its last failed attempt aged out of the window.
 */
export async function listSuccessfulTransactions(input: {
  fromDate: Date;
  toDate: Date;
}): Promise<FailedTransaction[]> {
  return listTransactionsByStatus({ ...input, status: "Success" });
}
