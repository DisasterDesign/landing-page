# Fuzion read-only MCP — implementation and approval gate

Status: implemented and locally tested, **disabled, not deployed, not connected**.
No production grant, OAuth client, credential, provider account, local Codex
configuration or Work plugin has been created. `/api/mcp` is a source route,
not a verified live connection URL.

## Source and existing work

Canonical repository: `DisasterDesign/landing-page`, checkout
`/Users/eladnissim/Desktop/Projects/Fuzion/fuzion-webz`. Main was at `65fb437`
with unrelated uncommitted edits. Those edits were preserved. This isolated
branch `codex/read-only-mcp` starts from `88fa1d3`, the committed finance and
debtor fixes in the existing private-shared-finance worktree. Do not release
against the older main snapshot or silently overwrite the newer finance work.
The canonical `~/Projects/Foundation/code-library/INDEX.md` and admin-auth
README/implementation were checked; there is no MCP/OAuth-server primitive.
The application's existing NextAuth Credentials login is retained.
No project `.agents` directory or project AGENTS.md was present; ancestor
Fuzion instructions and DECISIONS.md were read.

## Maintained authentication proposal — approval required

Use **Auth0 Auth for MCP**, OAuth authorization-code with PKCE S256, a dedicated
API/resource and explicit personal client registration. Auth0 owns login,
consent, code exchange, refresh and OAuth discovery; this app implements no
custom OAuth authorization/token endpoint. The app verifies RS256 signatures
using `jose` and issuer-pinned JWKS. The official MCP SDK 1.32.2 supplies
stateless Streamable HTTP with JSON responses. Versions are pinned in the lock.

Public provider/resource metadata must be approved and set after deployment:

| Setting | Required value |
| --- | --- |
| `MCP_ENABLED` | Keep `false` until approval and deployment verification |
| `MCP_RESOURCE_URL` | Exact deployed HTTPS resource URL, not a guessed URL |
| `MCP_OAUTH_ISSUER` | Exact approved Auth0 issuer, including trailing slash |
| `MCP_OAUTH_JWKS_URI` | Issuer's HTTPS public-key endpoint on the same origin |
| `MCP_ALLOWED_ORIGINS` | Only actual required browser origins; no wildcard |

Register only necessary personal OAuth clients for local Codex and the Work
plugin. If they have distinct client IDs, use separate grant rows. Copy each
actual callback URI from its supported client setup flow; do not guess it.
Configure Auth0's MCP resource indicator/audience support and discovery.
Use a predefined client when available; enabling public DCR is not required
for this personal integration. No password/client-secret grant is supported.
Set access-token lifetime at most one hour (the verifier also enforces age).
Choose a finite initial app grant, recommended 30 days; renewal is another
explicit approved access action. If persistent refresh is approved, configure
provider rotation/expiry in its supported flow and store refresh tokens only
in the OAuth clients' secure stores, never this application or repository.

For each explicitly approved client, bind the provider's verified issuer,
subject and signed OAuth client ID (`azp` or RFC 9068 `client_id`) to the actual
persisted app User.id. Verify the two identities through their own supported
login/management flows before writing the mapping; never bind by matching an
email or accept a model/tool-supplied user ID. The additive `McpAccessGrant`
records the mapping, allowed scopes, notBefore, expiry and revokedAt. It stores
no tokens or secrets. Its migration creates zero grants.

Initial target: **Elad only**, `finance:read clients:read debtors:read`.
No grant, client access, public plugin, or plugin sharing for Roy. The Roy-like
account is tested synthetically to prove that a later role change or mistakenly
provisioned shared reader cannot access private data or debtor counts/totals.
Every HTTP request re-reads the grant and current user in one database query;
JWT role/userId/financeBook claims and tool arguments confer no authority.
Persisted ADMIN is required; must-change-password and missing users fail closed.
Scopes are the intersection of the signed token and current grant. Owner status
comes only from current User.isOwner. There is no principal/result/session cache.

Approval question for the parent to present at the action-time boundary:
**Approve Auth0 managed OAuth/PKCE for an Elad-only personal connection with the
three read scopes, one-hour tokens and an initial 30-day revocable app grant?**
Provider cost/available tenant and callback/client metadata must be confirmed
in the supported setup flow before creating anything. Approval does not waive
existing deployment/security gates.

## Tools and interpretation

- `finance_summary`: optional paired ISO dates `from`, `to`; UTC cash period
  `[from,to)`, maximum 366 days. Defaults to current UTC month through now.
  Reuses `buildFinanceReport`, `loadReceipts`, receipt deduplication, VAT,
  rounding and profit allocation. Cash cannot include future receipts. Current
  product MRR, current forecast after monthly costs, collected cash/refunds,
  recorded expense coverage, estimated fees, unvalued FX and freshness are
  distinct. Owner sees private/shared and personal share; Roy sees shared only.
  Shared expenses are deducted before 50/50 allocation. Forecast is current
  product run-rate, not proof of active collection or historical subscription
  state. Missing/unclassified owner data is flagged rather than treated as zero.
- `search_clients`: required name query (1–100 characters), limit 1–20. Filters
  client and child permissions inside queries before limiting/projection.
  Returns necessary client/product/agreement status, not phone/email, identity
  numbers, payment/order IDs, signing links, notes or provider errors. At most
  ten visible products/agreements per client; truncation is explicit. No global
  total or ID lookup allows existence probing.
- `debtors_report`: current owner only, including listing/counts/totals. Reuses
  the same stored read loader and partition as the app report, including hidden
  historical entries outside the 45-day sweep. Unknown historical amounts are
  null and flagged stale/outside-window, never zero or paid. Snapshot older than
  36 hours/missing is stale. Limits 1–100 apply to each category; counts and known
  snapshot amounts are owner-only. Agreement charges retain the existing source
  limit of 100 and explicitly flag possible truncation. Categories may overlap;
  their totals must not be added. No identity numbers or payment identifiers.

Strict schemas reject role, userId, financeBook, arbitrary filters and unknown
fields. Tools advertise read-only/idempotent/closed-world metadata. Every
operation is authenticated, including initialize and tools/list; 401 provides
RFC 9728 resource metadata discovery. Missing configuration returns 503.
Unknown/not-authorized tool names expose no data. Data failures use generic
errors without server exception details. Responses use no-store/private cache
headers. Request bodies are bounded to 16 KiB even with chunked transfer.
Unexpected Origin/host are denied. Existing per-IP middleware throttling and
an additional per-user 30/minute in-memory throttle apply; a distributed quota
would require separately approved infrastructure, not an unverified claim.

## Read boundary

MCP calls never invoke report refresh, synchronization, Cardcom requests,
charge/order creation, notifications or business writes. The debtors read path
was extracted from the existing GET route and no longer imports the debtor
sweep. Finance report reads existing stored receipts; its Cardcom config helper
only supplies the existing terminal identity for receipt deduplication.
Only public JWKS retrieval can make an outbound auth request. Synthetic module
harnesses reject unknown dependencies and mutations. A Postgres integration
also rejects every non-read Prisma action throughout initialize/list/call;
setup, role/grant changes and cleanup run exclusively outside the read phase
against a guarded loopback synthetic database.

## Deploy and connect — pending explicit approval

1. Use the patched stack and document the residual-risk decision in
   DEPENDENCY-REVIEW.md; read VERIFICATION.md and AUTH0-SETUP.md. Review the
   exact diff and base commit; any PR must be draft only. Merge/release/deploy
   and apply the additive migration only within the user's explicit approval.
2. Set public resource/provider metadata and perform the exact approved Auth0
   configuration and verified subject→User binding. Never reuse DB password,
   Cardcom keys, NEXTAUTH_SECRET, browser cookies or a hand-rolled bearer key.
3. With no grant/token, verify real HTTPS initialize/list/call all return 401,
   valid discovery points to the approved issuer, Origin rejection works, and
   no app cookie permits MCP access. Confirm expiry/revocation live with a
   dedicated approved test identity/grant. Production tests are read-only;
   role changes and synthetic data fixtures remain local only.
4. User completes OAuth via the local Codex Streamable HTTP setup. Verify a
   real tool call; local configuration does **not** give dot access.
5. Parent creates/installs a **PERSONAL** Work MCP plugin in the supported flow,
   with OAuth and actual callback URI. Do not publish or share it with Roy.
   Parent invokes a real tool from this dot conversation and checks the three
   requested user questions against app reports using identical filters/period.
6. Only then report the verified live endpoint, connected account and scopes.

## Immediate revocation / rollback

An approved operator sets the corresponding `McpAccessGrant.revokedAt` (or
removes the grant); the next request fails even for an already issued JWT and
an already initialized MCP client. To invalidate old tokens while allowing a
new login, advance notBefore; require a token issued after that boundary.
Remove a scope or change actual User permissions to limit the next request.
Revoke the Auth0 authorization/refresh grant and disconnect both clients too:
provider refresh revocation alone does not instantly invalidate existing JWTs.
App-grant revocation is the immediate enforcement point. Never merely remove a
local config entry and claim remote authorization was revoked.

Emergency disable: set `MCP_ENABLED=false` in the approved deployment flow.
There are no business-data changes to reverse. The additive grant table can
remain empty; schema removal is a separate reviewed migration. Retain the
existing finance/debtor fixes and other contributors' changes.

Primary references checked 2026-10-26:
[official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk),
[Streamable HTTP SDK](https://ts.sdk.modelcontextprotocol.io/server.html),
[Auth0 Auth for MCP](https://auth0.com/ai/docs/mcp/overview),
[OpenAI auth](https://developers.openai.com/plugins/build/auth),
[OpenAI connect/test](https://developers.openai.com/plugins/deploy/connect-chatgpt).

Follow-up security/plan review: see [DEPENDENCY-REVIEW.md](DEPENDENCY-REVIEW.md)
for the scoped runtime fixes and remaining advisory/API exposure, and
[AUTH0-SETUP.md](AUTH0-SETUP.md) for Free-plan constraints, the unverified tenant
status, exact future tenant-wide settings and supported action-time steps.
Approval remains pending.
