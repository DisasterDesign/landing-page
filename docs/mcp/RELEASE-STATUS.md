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

Auth0 Dashboard is logged out. Chrome tab '🔐 Fuzion MCP setup' is open at the
supported manage.auth0.com login and marked for handoff. **Elad must sign into
his actual account.** No credentials have been entered/copied and no signup,
terms, tenant, client or grant was created. This is a login prerequisite, not
an unresolved approval for the already approved proposal. If the supported
flow presents new terms, a paid plan or materially broader tenant settings,
return that exact decision instead of silently accepting it.

The parent owns the PERSONAL Work plugin and final successful dot tool call.
No connection is complete until actual provider OAuth, production read-only
parity and that parent call succeed. A deployed disabled route is not an active
or connected MCP endpoint. See subsequent verified deployment notes before
naming any live endpoint or deployed commit.
