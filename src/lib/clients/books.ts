/**
 * The two books the app now keeps.
 *
 * "fuzion" is the partnership: revenue that follows Client.ownerId →
 * User.revenueSharePct, which is how Roy is paid 50% of what he generated.
 * "personal" is Elad's own retainers from before the partnership — they reach
 * his dashboard and nobody else's, and they split with nobody.
 *
 * The discriminator is Client.partner, a field that already existed in the
 * schema documented as "other = legacy/private client" and had never been
 * used. Deliberately NOT derived from ownership: Elad can own a Fuzion client
 * (a house deal), and that must not turn partnership revenue into private
 * revenue.
 */

export const PERSONAL_BOOK = "personal";

export type Book = "fuzion" | "personal";

export function bookOf(c: { partner: string | null }): Book {
  // Fails safe. An unrecognised label stays in the partnership books rather
  // than quietly removing revenue from the split.
  return c.partner === PERSONAL_BOOK ? "personal" : "fuzion";
}

export function isPersonal(c: { partner: string | null }): boolean {
  return bookOf(c) === "personal";
}

export interface BookTotals {
  count: number;
  amount: number;
  profit: number;
  partnerShare: number;
}

const zero = (): BookTotals => ({
  count: 0,
  amount: 0,
  profit: 0,
  partnerShare: 0,
});

export function splitByBook(
  rows: Array<{
    partner: string | null;
    amount: number;
    profit: number;
    partnerShare: number;
  }>,
): Record<"fuzion" | "personal" | "combined", BookTotals> {
  const out = {
    fuzion: zero(),
    personal: zero(),
    combined: zero(),
  };

  for (const r of rows) {
    const book = bookOf(r);
    // A personal row's partner share is forced to zero rather than trusted
    // from the caller. The route already computes it as zero via a null
    // revenueSharePct, but this is the number that pays a partner — it does
    // not depend on an upstream calculation staying correct.
    const share = book === "personal" ? 0 : r.partnerShare;

    for (const t of [out[book], out.combined]) {
      t.count += 1;
      t.amount += r.amount;
      t.profit += r.profit;
      t.partnerShare += share;
    }
  }

  return out;
}
