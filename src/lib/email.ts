import { Resend } from "resend";

const TIER_LABEL: Record<string, string> = {
  BASIC: "בסיס",
  ADVANCED: "מתקדם",
  PREMIUM: "פרימיום",
};

const ADMIN_EMAILS = ["roy@fuzionwebz.com", "elad@fuzionwebz.com"];

interface PaymentEmailParams {
  customerName: string;
  amount: number;
  invoiceNumber?: string;
  agreementTier?: string | null;
  isRecurring?: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendPaymentReceivedEmail(params: PaymentEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return;
  }

  const tierLabel = params.agreementTier
    ? TIER_LABEL[params.agreementTier] ?? params.agreementTier
    : null;

  const headline = params.isRecurring ? "💰 חיוב חודשי התקבל" : "💰 תשלום חדש התקבל";
  const subjectPrefix = params.isRecurring ? "חיוב חודשי" : "תשלום";

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "Fuzion Webz <info@fuzionwebz.com>",
    to: ADMIN_EMAILS,
    subject: `💰 ${subjectPrefix} התקבל — ${params.customerName}`,
    html: `
      <div dir="rtl" style="font-family: sans-serif;">
        <h2>${headline}</h2>
        <p><strong>לקוח:</strong> ${escapeHtml(params.customerName)}</p>
        <p><strong>סכום:</strong> ₪${params.amount}</p>
        ${params.invoiceNumber ? `<p><strong>חשבונית:</strong> #${escapeHtml(params.invoiceNumber)}</p>` : ""}
        ${tierLabel ? `<p><strong>מסלול:</strong> ${escapeHtml(tierLabel)}</p>` : ""}
        <p><a href="https://www.fuzionwebz.com/admin/agreements">צפה בהסכמים</a></p>
      </div>
    `,
  });
}
