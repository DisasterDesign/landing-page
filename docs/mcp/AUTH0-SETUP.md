# Auth0 setup proposal and action-time boundaries

**Approval PENDING. Nothing in this checklist has been provisioned.**
The parent has already presented the approval question; do not ask it again
or interpret elapsed time as consent. No live MCP endpoint is verified.

## Cost and account findings — checked 2026-10-26

Auth0's published Free tier is $0/month with up to 25,000 MAU and no signup card
requirement. Its official MCP article explicitly includes Auth for MCP in Free.
A custom domain requires credit-card verification; use the provider's normal
host for this proposal. Higher limits, custom database login and advanced
features have different paid tiers. This implementation needs no Token Vault,
M2M API credentials, FGA service or custom-database password bridge. It maps a
verified OAuth identity to an existing app User record instead.

Sources: [pricing](https://auth0.com/pricing),
[official Free/MCP confirmation](https://auth0.com/blog/adding-ui-auth0-secured-mcp-server-skybridge/).
Published eligibility is not a verified quote or entitlement for this account;
confirm the actual plan before making changes. Do not accept a paid plan or add
a payment method if Free does not support the needed configuration.

No Auth0 management connector is available in this session. A read-only visit
to manage.auth0.com in the existing Mac Chrome profile reached the Auth0 login
page. No login, signup, SSO button or terms flow was submitted. Consequently
**existing account, tenant, region and actual plan are unverified**, not proven
absent. No browser tokens/cookies/passwords were extracted.

## Supported setup after exact approval

1. Parent confirms the existing pending approval: personal Elad-only access,
   scopes finance:read, clients:read, debtors:read, access-token age <= 1 hour,
   initial revocable app grant 30 days, no Roy access and no public sharing.
   Deployment approval is separate. Resolve/document residual app-wide security
   risk in DEPENDENCY-REVIEW.md; do not call the whole app vulnerability-free.
2. User signs into Auth0 through its normal login flow. Inspect the selected
   tenant and plan read-only. If a new account/tenant or terms acceptance is
   needed, stop at the action-time boundary and obtain the exact supported
   approval/user action. Do not guess a tenant name or region. Do not reuse
   business/database/payment secrets as Auth0 credentials.
3. On the exact approved tenant, review Settings -> Advanced. Auth0's documented
   MCP compatibility setup enables **Resource Parameter Compatibility Profile**
   and **Include Issuer in Authorization Responses**. These are tenant-wide
   settings: inspect whether other integrations rely on forwarding resource to
   upstream IdPs. Get exact approval for the selected tenant/settings before
   applying; a shared existing tenant may require isolation instead. No custom
   OAuth proxy or resource-to-audience shim is introduced.
4. After an approved deployment yields a verified HTTPS resource URL, register
   the API with that exact URI as identifier/audience, RS256 signing and only
   the three read permissions. Configure <=3600-second access tokens. Set the
   public MCP_RESOURCE_URL, MCP_OAUTH_ISSUER and issuer-origin JWKS URI. Keep
   MCP_ENABLED=false until the scoped identity/grant and acceptance checks are
   ready; applying configuration is itself an approved release action.
5. Parent reads each actual client's connection-management metadata. Register
   only the required personal local-Codex and Work clients, using the exact
   displayed redirect URIs and supported PKCE S256/token-auth method. Prefer
   explicit predefined registration or manual CIMD when supported. No global
   DCR/CIMD auto-registration change is authorized by this document. If the
   actual local Codex client requires DCR rather than a predefined client,
   return that concrete setting/tenant consequence for approval instead of
   silently broadening registration. Configure refresh rotation/expiry only
   if the user explicitly approves persistent refresh access.
6. User authenticates through the actual OAuth flow. Verify the issuer/subject
   and signed client identity (azp or client_id) against the actual persisted
   app User.id using approved management/app login evidence. No automatic email
   match, copied session cookie, model-supplied userId or app password transfer.
   Apply the additive grant migration only in the approved deployment flow;
   it creates zero grants. The specific approved identity/client binding then
   receives the exact three scopes, finite expiry and notBefore. Separate
   client IDs get separate grants. Do not create any Roy grant.
7. Complete read-only live initialize/list/call and report parity checks with
   the approved identity. Invalid/expired/revoked test identities and permission
   changes remain synthetic unless separately authorized. Verify that an app
   cookie alone never authenticates MCP. Test immediate local-grant revocation
   before acceptance using an explicitly approved temporary test grant.
8. Parent configures local Codex through its supported Streamable HTTP/OAuth
   setup, then separately creates/installs a **PERSONAL** Work plugin through
   ChatGPT Plugins -> + -> Add custom MCP server -> OAuth. Copy callbacks from
   that actual setup page. Parent executes a real tool in this dot conversation
   and checks all three user acceptance questions. Local configuration alone
   is not dot access. Only then report the live verified endpoint/account/scopes.

The tenant toggles and application registrations above are **future** actions,
not performed or preapproved by this checklist. If provider UI entitlements or
client metadata differ, stop that specific action and report the exact blocker.

Primary setup sources:
[Auth0 MCP authorization](https://auth0.com/ai/docs/mcp/get-started/authorization-for-your-mcp-server),
[resource compatibility](https://auth0.com/ai/docs/mcp/guides/resource-param-compatibility-profile),
[client registration](https://auth0.com/ai/docs/mcp/guides/registering-your-mcp-client-application),
[OpenAI auth](https://developers.openai.com/plugins/build/auth),
[OpenAI personal connection/testing](https://developers.openai.com/plugins/deploy/connect-chatgpt).
