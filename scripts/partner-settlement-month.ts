/**
 * Historical month for the Elad↔Roy settlement — what was ACTUALLY collected.
 *
 * /admin/partner-report is a snapshot of today's MRR (Client.monthlyAmount of
 * every client in status "בוצע"). It is not a month: a client who paid twice,
 * paid late, paid less, or paid extra for one-off work does not show there.
 * This script reconstructs a calendar month from the money itself:
 *
 *   1. Every successful Cardcom transaction in the month (terminal-wide, so
 *      standing orders created by hand in the Cardcom dashboard are included).
 *   2. Each transaction is linked to a Client only by a HARD key, in order:
 *        a. AgreementCharge.cardcomDealId = TranzactionId  → Agreement → Client
 *        b. Client.cardcomAccountIds ∋ AccountId
 *        c. Agreement.cardcomAccountId = AccountId         → Client
 *      Never by card-holder name — name matching produced wrong money before.
 *      Anything unlinked is listed for a human; it is never assigned.
 *   3. Each linked transaction is classified by splitRuleFor() — personal /
 *      Roy-owned fuzion / AMBIGUOUS — and the formula from settlement.ts is
 *      applied under BOTH readings of the ambiguous class.
 *   4. Shared expenses come from the Expense ledger, normalised to monthly ILS
 *      (monthlyIlsOf), with the FX constant printed so a stale rate is visible.
 *
 * Bank transfers (one-off jobs paid outside Cardcom) are NOT here — read
 * ClientJob.paidAt for the month separately; one-off work is outside the
 * recurring split by current policy (docs/PARTNER-SETTLEMENT.md §3).
 *
 * The output is a worksheet, not a final figure: it prints the unresolved rows
 * and the open questions that change the number. Read-only.
 *
 * Usage:  node --env-file=.env ./node_modules/.bin/tsx scripts/partner-settlement-month.ts 2026-09
 */
import { PrismaClient } from "@prisma/client";

import { listTransactionsByStatus } from "../src/lib/cardcom";
import { splitRuleFor } from "../src/lib/partners/split";
import { computeSettlement, monthlyIlsOf } from "../src/lib/partners/settlement";
import { VAT_RATE, CARDCOM_FEE_RATE, USD_TO_ILS, EUR_TO_ILS } from "../src/lib/finance";

const prisma = new PrismaClient();
const r2 = (n: number) => Math.round(n * 100) / 100;
const ils = (n: number) => `₪${r2(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

type Tx = {
  TranzactionId: number;
  Amount: number;
  CreateDate: string;
  CardOwnerName?: string;
  AccountId?: number;
  CoinId?: number;
  DocumentNumber?: number | string;
  IsRefund?: boolean;
};

async function main() {
  const arg = process.argv[2];
  if (!/^\d{4}-\d{2}$/.test(arg ?? "")) throw new Error("usage: partner-settlement-month.ts YYYY-MM");
  const [y, m] = arg.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  console.log(`=== ${arg} — settlement worksheet (read-only) ===`);
  console.log(`window ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)} · VAT ${VAT_RATE}% · Cardcom ${CARDCOM_FEE_RATE * 100}% · USD→ILS ${USD_TO_ILS} · EUR→ILS ${EUR_TO_ILS} (constants in src/lib/finance.ts — check they are current)\n`);

  // 1. the money
  const txs = (await listTransactionsByStatus({ status: "Success", fromDate: from, toDate: to })) as unknown as Tx[];
  const inMonth = txs.filter((t) => t.CreateDate.slice(0, 7) === arg);
  console.log(`Cardcom successful transactions: ${inMonth.length} (API returned ${txs.length}; filtered to the month by CreateDate)`);

  // 2. hard-key links
  const charges = await prisma.agreementCharge.findMany({
    where: { success: true, OR: [{ cardcomChargeDate: { gte: from, lte: to } }, { chargedAt: { gte: from, lte: to } }] },
    select: { cardcomDealId: true, agreement: { select: { customerName: true, client: { select: { id: true } } } } },
  });
  const byDeal = new Map(charges.map((c) => [String(c.cardcomDealId), c]));
  // Archived clients are included on purpose: a standing order that keeps
  // charging after the row was archived is exactly the kind of money this
  // worksheet exists to surface. They are flagged, never hidden.
  const clients = await prisma.client.findMany({
    select: { id: true, number: true, name: true, partner: true, status: true, monthlyAmount: true, vatExempt: true, archivedAt: true, cardcomAccountIds: true, owner: { select: { id: true, isOwner: true, revenueSharePct: true } } },
  });
  const byId = new Map(clients.map((c) => [c.id, c]));
  const byAccount = new Map<number, (typeof clients)[number]>();
  for (const c of clients) for (const a of c.cardcomAccountIds) byAccount.set(a, c);
  const agreementAccounts = await prisma.agreement.findMany({
    where: { cardcomAccountId: { not: null }, clientId: { not: null } },
    select: { cardcomAccountId: true, clientId: true },
  });
  for (const a of agreementAccounts) {
    const c = byId.get(a.clientId!);
    if (c && a.cardcomAccountId != null && !byAccount.has(a.cardcomAccountId)) byAccount.set(a.cardcomAccountId, c);
  }

  type Row = { tx: Tx; client: (typeof clients)[number] | null; via: string };
  // A refund that Cardcom lists under "Success" must not be added to income.
  const refunds = inMonth.filter((t) => t.IsRefund === true);
  const charged = inMonth.filter((t) => t.IsRefund !== true);
  const rows: Row[] = charged.map((tx) => {
    const viaDeal = byDeal.get(String(tx.TranzactionId));
    if (viaDeal?.agreement.client) return { tx, client: byId.get(viaDeal.agreement.client.id) ?? null, via: "AgreementCharge.cardcomDealId" };
    if (tx.AccountId && byAccount.has(tx.AccountId)) return { tx, client: byAccount.get(tx.AccountId)!, via: `AccountId ${tx.AccountId}` };
    return { tx, client: null, via: tx.AccountId ? `AccountId ${tx.AccountId} — not linked to any client` : "AccountId 0 (manual charge) — no key" };
  });

  // 3. classify
  const net = (gross: number, vatExempt: boolean) => {
    const vat = vatExempt ? 0 : (gross * VAT_RATE) / (100 + VAT_RATE);
    return gross - vat - gross * CARDCOM_FEE_RATE;
  };
  const buckets = { royOwned: [] as Row[], ambiguous: [] as Row[], personal: [] as Row[], unlinked: [] as Row[] };
  for (const r of rows) {
    if (!r.client) { buckets.unlinked.push(r); continue; }
    const rule = splitRuleFor({ partner: r.client.partner, owner: r.client.owner });
    if (rule.book === "personal") buckets.personal.push(r);
    else if (rule.status === "ambiguous") buckets.ambiguous.push(r);
    else buckets.royOwned.push(r);
  }
  const sumGross = (rs: Row[]) => rs.reduce((s, r) => s + Number(r.tx.Amount), 0);
  const sumNet = (rs: Row[]) => rs.reduce((s, r) => s + net(Number(r.tx.Amount), r.client?.vatExempt ?? false), 0);

  const print = (title: string, rs: Row[]) => {
    console.log(`\n--- ${title}: ${rs.length} tx, gross ${ils(sumGross(rs))}, net ${ils(sumNet(rs))} ---`);
    for (const r of rs.sort((a, b) => a.tx.CreateDate.localeCompare(b.tx.CreateDate)))
      console.log(`  ${r.tx.CreateDate.slice(0, 10)}  ${ils(Number(r.tx.Amount)).padStart(11)}  ${(r.client ? `#${r.client.number} ${r.client.name}${r.client.archivedAt ? " [ARCHIVED]" : ""}${r.client.status !== "בוצע" ? ` [status=${r.client.status || "ריק"}]` : ""}` : "(unlinked)").padEnd(40)}  payer="${r.tx.CardOwnerName ?? ""}"  doc=${r.tx.DocumentNumber ?? "-"}  via ${r.via}`);
  };
  print("FUZION — Roy-owned (both calculations: 50% to Roy)", buckets.royOwned);
  print("FUZION — AMBIGUOUS (settlement says 50%, per-row says 0 — OPEN QUESTION #1)", buckets.ambiguous);
  print("PERSONAL — Elad's book (0 to Roy)", buckets.personal);
  print("UNLINKED — a human must say which client/book these are; NOT counted below", buckets.unlinked);
  console.log(`\n--- REFUNDS (IsRefund=true, excluded from every figure above): ${refunds.length} ---`);
  for (const t of refunds) console.log(`  ${t.CreateDate.slice(0, 10)}  ${ils(Number(t.Amount)).padStart(11)}  payer="${t.CardOwnerName ?? ""}"  doc=${t.DocumentNumber ?? "-"}  → the original charge is still counted; net it by hand`);

  // 4. expenses + formula
  const expenses = await prisma.expense.findMany({
    where: { active: true },
    select: { name: true, vendor: true, amount: true, currency: true, frequency: true, client: { select: { partner: true } }, paidBy: { select: { isOwner: true } } },
  });
  const se = expenses.map((e) => ({ amountIls: monthlyIlsOf(e), paidBy: (e.paidBy?.isOwner ?? true) ? ("owner" as const) : ("partner" as const), shared: e.client?.partner !== "personal", name: e.name }));
  console.log(`\n--- SHARED EXPENSES from the ledger: ${expenses.length} active rows (zero-amount rows hidden below but counted; normalised to monthly ILS; ONE_TIME = 0, settled by hand) ---`);
  for (const e of se.filter((x) => x.shared && x.amountIls > 0).sort((a, b) => b.amountIls - a.amountIls)) console.log(`  ${ils(e.amountIls).padStart(11)}  ${e.name}  paidBy=${e.paidBy}`);
  const sharedTotal = se.filter((x) => x.shared).reduce((s, x) => s + x.amountIls, 0);
  console.log(`  TOTAL shared ${ils(sharedTotal)}; paid by Roy ${ils(se.filter((x) => x.shared && x.paidBy === "partner").reduce((s, x) => s + x.amountIls, 0))}`);

  const royNet = sumNet(buckets.royOwned);
  const ambNet = sumNet(buckets.ambiguous);
  const A = computeSettlement({ fuzionNetRevenue: royNet, expenses: se });
  const B = computeSettlement({ fuzionNetRevenue: royNet + ambNet, expenses: se });
  console.log(`\n=== RESULT for ${arg} — NOT FINAL while open questions remain ===`);
  console.log(`Reading A — ambiguous clients are 100% Elad (per-row share):   fuzion net ${ils(royNet)} − shared ${ils(sharedTotal)} = profit ${ils(A.profit)} → Roy ${ils(A.transferToRoy)}`);
  console.log(`Reading B — ambiguous clients split 50/50 (today's settlement): fuzion net ${ils(royNet + ambNet)} − shared ${ils(sharedTotal)} = profit ${ils(B.profit)} → Roy ${ils(B.transferToRoy)}`);
  console.log(`Difference between readings: ${ils(B.transferToRoy - A.transferToRoy)} (= half of the ambiguous net ${ils(ambNet)})`);
  console.log(`Unlinked money not in either figure: ${ils(sumGross(buckets.unlinked))} gross across ${buckets.unlinked.length} tx.`);
  console.log(`Roy invoices VAT on top: A ${ils(A.transferToRoy * (1 + VAT_RATE / 100))} / B ${ils(B.transferToRoy * (1 + VAT_RATE / 100))}.`);
  console.log(`\nAlso check: ClientJob.paidAt in ${arg} (one-off jobs and bank transfers are outside this split), and docs/settlements/${arg}.md for whether this month was already paid.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
