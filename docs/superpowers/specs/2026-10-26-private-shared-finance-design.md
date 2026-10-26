# Private and shared finance

Approved implementation: immutable PRIVATE / SHARED / UNASSIGNED financial attribution, independent of sales ownership or whoever typed the record.

## Access and money

- Persisted owner sees all books and alone chooses PRIVATE or SHARED. New owner quotes default PRIVATE; nonowner ADMIN quotes default SHARED and cannot select a book.
- SHARED profit after shared costs is split equally. PRIVATE income and direct costs belong solely to the owner. General overhead needs explicit classification; a missing client link is not overhead evidence.
- One client may have products in different books. Client-wide totals and payment dates must not reveal private children to a shared viewer.
- Paid financial records cannot be reclassified or rewritten. Future sharing changes use new records. Product-to-agreement links are claimed atomically.
- Forecast subscriptions/expenses remain separate from verified receipts and recorded expense payments. Missing currency valuation, incomplete payment evidence or provider coverage marks totals partial.
- Cardcom receipt identity is provider + terminal + transaction + kind. Webhooks, recurring charges and pulls must not count the same receipt twice. Distinct first and recurring payments both count.
- Supplier invoices may carry a shared basis-point allocation. Only that allocation is visible to the partner; raw mixed evidence remains owner-only. Payer reimbursement is separate from profit share and is not deducted twice.

## Boundaries

Query-side scope applies to lists, detail, mutation, downloads, related tasks/comments/attachments, lead timelines, counts and financial notification fanout. A lead with any private/unassigned agreement is conservatively hidden from nonowners, including a mixed lead. Customer signing by bearer link remains available to the intended customer.

FinanceTransaction stores verified receipts with attribution snapshots. FinanceExpensePayment records actual ILS paid, paidAt, payer, frequency and frozen allocation, with idempotent payment keys. It does not initiate provider charges.

## Data and supplier handling

Customer identities, account numbers, amounts and reconciliation findings belong in private operational evidence and external validated import manifests. They must never be committed to this public code repository. Generic migration scripts run dry by default and require an explicitly selected database. Classification precedes receipt import; unknown identities stay owner-only.

Cloudflare billing history is evidence in original currency. Neon consumption is usage, not a paid invoice. Provider credentials remain server-side; failure preserves the last successful snapshot. Other suppliers use manual invoice/payment recording until connected. Settlement is a computed entitlement; closed-month and completed-transfer ledgers are outside this release.
