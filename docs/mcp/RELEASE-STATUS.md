# Current MCP release status — 2026-10-26

Elad approved the exact Auth0/personal read-only proposal at21:00UTC and
proceeding to publication/setup. This supersedes historical 'approval pending'
notes. The approved scope remains Elad only, finance:read / clients:read /
debtors:read, <=1-hour access tokens and an initial revocable30-day app grant.
No paid plan, new explicit terms, Roy access or materially broader security
settings are authorized by that approval.

## Security release candidate

- Stored blog HTML is allowlisted in the server before SSR and client
  serialization; there is no raw-first client hydration window.
- JSON-LD escapes literal tag openers before insertion into an HTML script.
- Standard Hebrew/article/editor formatting is retained; active tags, event
  attributes and executable URL schemes are rejected.
- Tiptap's compatible3.30.5 packages/peers replace the vulnerable editor set.
  The unused DOMPurify client dependency was removed. The existing maintenance
  script's Markdown parser and types are now declared explicitly as dev tools.
- sanitize-html2.18.1 is the maintained Apostrophe monorepo package. Its Node
  requirement>=22.12 is met by the existing verified Vercel project Node24.x;
  no hosting-runtime change was made.
- Clean npm ci succeeded and npm ls reports a consistent editor peer tree.
- Final suite: **633 passed,0 failed,0 skipped**, including four blog security
  regressions and both synthetic finance/grant Postgres integrations.
- Typecheck and production build passed. Lint passed with0 errors and the same
  17 existing warnings.
- Independent review found no important/critical issue. One test initially
  rejected inert escaped onerror text inside a title attribute; its assertion
  was corrected to the exact safe serialization, then the full suite reran.
- Real browser synthetic fixture: article has0 scripts/0 event attributes,
  injected execution marker remains unset, JSON-LD stays data, and actual
  BlogEditor typing/bold output still works. No real blog record was edited.
- Production npm audit: **0 critical,0 high,6 moderate package entries**. Remaining
  groups are typography/selector parsing during trusted CSS builds, unused
  Three archive/type paths, and Svix/Resend's uuid API path (observed v4, while
  the advisory concerns v3/v5/v6 output buffers). No new MCP read path invokes
  those operations. This is not a claim that every application path was audited.

## Provisioning and deployment checkpoint

Existing Vercel CLI login and the exact landing-page project are verified.
Current production and project Node24.x were inspected read-only. Current
origin/main3bd19f8 is the merge of the already included88fa1d3 debtor fixes,
with no source-tree difference from that baseline. Other local edits remain
untouched.

The clean source at `060e1f47b4b2e338c0d66936671dacaa9ff8e63f` was deployed
through the existing Vercel project on 2026-10-26 at 21:21 UTC. Deployment
`dpl_EYb6DAFquuYGnar3hrVtQP7FFaB6` is Ready and aliased to
`https://www.fuzionwebz.com`. Read-only checks verified a published blog page
returns 200 with article markup in the server HTML. The deployed
`https://www.fuzionwebz.com/api/mcp` returns **503 Service unavailable** with
no-store because MCP configuration remains disabled/unset. This is a deployed
disabled route, **not an active MCP connection**. No production grant/schema
migration or business-data mutation was performed.

Elad signed into Auth0 using its supported user flow and authorized ordinary
signup completion. Business profile (Fuzion Webz, 1–49, Israel) was submitted.
Auth0's continuation callback failed with an invalid-state error; opening its
linked Dashboard recovered the authenticated account and displayed first-tenant
setup. There is no tenant yet. The current screen has a generated name, US
region, and Create Account; no payment or additional agreement was visible.
The profile notice references Auth0's Privacy Policy and international data
processing. Public signup advertised Free / no credit card; actual tenant plan
and any trial conditions remain unverified until a tenant exists.

Automatic approval review **denied** the attempt to create the proposed
`fuzion-webz-mcp.us.auth0.com` tenant: permanent name/data-region settings require
concrete action-time confirmation. A fresh read verified the generated name
was unchanged and no tenant was created. The reviewer mentioned Australia;
the actual page suffix and selected styling indicate US. No retry or alternate
creation route was used. Ask Elad one focused question approving the exact
name and **US** region. The Chrome Welcome tab is marked for handoff.
No credentials, clients, OAuth grants, paid plans or new terms were created or
accepted by the agent. The prior exact three-scope approval remains valid.

The parent owns the PERSONAL Work plugin and final successful dot tool call.
Actual provider OAuth, production read-only parity, local Codex configuration
and the parent dot tool call remain **NOT RUN**. Complete these after the
concrete tenant prerequisite; do not claim connected before that acceptance.
