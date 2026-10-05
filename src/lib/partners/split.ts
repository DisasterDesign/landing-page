import { bookOf, type Book } from "@/lib/clients/books";

/**
 * The single answer to "what share of this client's net revenue is Roy's?"
 *
 * Two calculations exist in the app and they do not agree on one class of
 * client. This module names that disagreement instead of hiding it, so a
 * future agent computing the monthly settlement never has to guess.
 *
 *   • Per-row share (/api/partner-report, each client row):
 *     Client.ownerId → User.revenueSharePct. Roy = 50, anyone else = 0.
 *   • Settlement (src/lib/partners/settlement.ts, the transfer figure):
 *     every fuzion-book client's net is pooled and halved — ownership ignored.
 *
 * They agree on personal-book clients (0 to Roy) and on Roy-owned fuzion
 * clients (50). They DISAGREE on a fuzion-book client owned by Elad or by a
 * seller: 50 in the settlement, 0 per row. Those clients are returned as
 * `ambiguous` with both readings attached. Resolving them is Elad's call —
 * see docs/PARTNER-SETTLEMENT.md, open question #1 — and the resolution must
 * be recorded there, in the client row, and here, in that order.
 *
 * Two boundaries, on purpose:
 *   • This answers WHO splits, not WHETHER the client is in the report. The
 *     report filters status = "בוצע" (partner-report/route.ts); a client in
 *     another status (e.g. #70, "פעיל") is classified here but counted nowhere.
 *   • `readings.perRow: 0` holds while every non-Roy user has a null
 *     revenueSharePct (true today). The report itself pays the owner's actual
 *     percentage, so a future partner on, say, 30% needs this file updated.
 */

export const ROY_SHARE_PCT = 50;

export type SplitOwner = {
  id: string;
  isOwner: boolean;
  revenueSharePct: number | null;
} | null;

export type SplitRule =
  | {
      status: "settled";
      book: Book;
      royPct: 0 | 50;
      basis: string;
    }
  | {
      status: "ambiguous";
      book: "fuzion";
      royPct: null;
      /** What each live calculation would pay Roy on this client. */
      readings: { settlement: 50; perRow: 0 };
      basis: string;
    };

export function splitRuleFor(client: {
  partner: string | null;
  owner: SplitOwner;
}): SplitRule {
  const book = bookOf(client);

  if (book === "personal") {
    return {
      status: "settled",
      book,
      royPct: 0,
      basis: "Client.partner = 'personal' — Elad's private book, outside the split on both sides",
    };
  }

  // Roy-owned: ownerId → revenueSharePct 50. Both calculations say 50.
  if (client.owner && (client.owner.revenueSharePct ?? 0) === ROY_SHARE_PCT) {
    return {
      status: "settled",
      book,
      royPct: 50,
      basis: "Client.partner = 'fuzion' and Client.ownerId → User.revenueSharePct = 50",
    };
  }

  return {
    status: "ambiguous",
    book: "fuzion",
    royPct: null,
    readings: { settlement: 50, perRow: 0 },
    basis: client.owner
      ? `Client.partner = 'fuzion' but ownerId → revenueSharePct = ${client.owner.revenueSharePct ?? "null"} (${client.owner.isOwner ? "Elad" : "a seller"}): the settlement halves it, the per-row share pays 0`
      : "Client.partner = 'fuzion' with no ownerId: the settlement halves it, the per-row share pays 0",
  };
}
