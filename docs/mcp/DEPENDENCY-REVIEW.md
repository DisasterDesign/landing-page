# Dependency and Auth0 release review — 2026-10-26

> Current status: Elad approved the exact proposal at21:00UTC. Historical pending-approval/dependency notes below are superseded by [RELEASE-STATUS.md](RELEASE-STATUS.md); Auth0 user login is still required.


Follow-up to implementation commit `04a4288`; persistent access approval remains
**pending**. No deployment, provider/account creation, grant, credential,
security-setting change, paid plan or Terms acceptance occurred.

## Scoped fixes

| Package | Before | Final | Reason |
| --- | --- | --- | --- |
| next | 16.2.1 | 16.4.3 | Patched same-major server/image/metadata/middleware security releases |
| next-auth | 5.0.0-beta.30 | 5.0.0-beta.32 | Patched existing Credentials/session middleware stack |
| @auth/core | 0.41.0 / 0.41.1 | 0.41.3, deduplicated | Removes vulnerable copies under NextAuth and adapter |
| @auth/prisma-adapter | 2.11.1 | 2.11.3 | Compatible patch; current auth does not configure this adapter |
| zod | 4.3.6 | 4.6.6 | Patched MCP/app validation parser |
| source-map-js | 1.2.1 | 1.2.2 | Lock-only compatible Next/PostCSS security patch |
| prosemirror-view | 1.41.7 | 1.42.8 | Lock-only compatible fix for real same-origin editor paste-XSS |
| eslint-config-next | 16.2.1 | 16.2.1 | Original config retained; not a runtime dependency |
| eslint-plugin-react-hooks | 7.0.1 | 7.0.1 override | Preserve the original compiler/lint behavior during lock refresh |

No application behavior, finance formula, MCP auth policy or schema was changed.
The Node requirement for the selected Next is >=20.9; local verification uses
Node 24.11. No framework/auth architecture migration was needed. The attempted
16.4.3 lint config / transitive Hooks 7.1.1 activated four new errors in untouched
UI components. Those tooling changes were not retained; pinning the original
Hooks plugin avoids unrelated refactors without disabling any rule.

Final production audit: **10 affected dependency entries: 0 critical, 4 high,
6 moderate**, down from 21 (4 critical, 10 high, 7 moderate). Full audit including
dev tools: **14 entries: 0 critical, 6 high, 7 moderate, 1 low**. These are package
entries with inherited severity, not 10/14 distinct exploits. No advisory remains
for Next, NextAuth/Auth core/adapter, Zod, source-map-js, ProseMirror, the MCP SDK
or jose in the returned audit. This is not a claim that the entire app is
vulnerability-free.

## Actual exposure and residual findings

| Package / advisory group | Evidence in this checkout | Assessment |
| --- | --- | --- |
| Next security group | Actual Node App Router/middleware; public image optimization enabled; src/lib/og-image.tsx uses ImageResponse | Runtime surface is present. Individual exploit prerequisites differ: no Windows hosting evidence, no use-cache typed-array functions found, and no arbitrary attacker SVG entry was proven. Patched all cited Next advisories instead of relying on those exclusions. |
| next-auth GHSA-8fpg-xm3f-6cx3 | Middleware uses !!req.auth | Real wrapper surface. Existing downstream role/User checks mitigate a configuration-error fail-open; patched the underlying bug too. |
| Auth core GHSA-xmf8-cvqr-rfgj | Auth wrapper receives Authorization headers, including MCP traffic | Malformed-bearer exception surface is relevant even though MCP later independently verifies JWTs; patched. |
| Auth GHSA-x445-f3h2-j279 / GHSA-7rqj-j65f-68wh | Credentials only; no email-login provider, OAuth account linking or adapter configured | Listed API preconditions not present; versions nevertheless patched through the existing auth dependencies. Auth0 proposal does not add an OAuth provider to NextAuth. |
| Zod GHSA-mrhx-c7xc-m3w5 | MCP schemas and other app validations use Zod | Runtime parser present. MCP additionally bounds bodies to16KiB; its own schemas lack unconstrained collection input. Patched instead of treating that as sufficient coverage. |
| source-map-js GHSA-68fv-2mgg-jv7q | Next/PostCSS build dependency | No MCP user-controlled source-map parsing found. Compatible lock patch applied as framework build hardening. |
| ProseMirror GHSA-c8x8-7fp4-3x9w | src/components/admin/BlogEditor.tsx uses Tiptap contenteditable and browser paste | Real browser production path on the management origin; patched the shared ProseMirror dependency without upgrading the full editor bundle. |
| @tiptap/core GHSA-cp6q-959q-f8rh / GHSA-j95f-988m-3j2f | Fixed StarterKit/Image/Link/Placeholder schemas, HTML-string input; no project custom mergeAttributes/untrusted attribute-object or Markdown parser call found | Conditional existing editor surface, outside MCP import/call graph. No exploit was demonstrated for this configuration. A full Tiptap bundle refresh is a separate bounded editor-maintenance change, not required to change MCP architecture. |
| DOMPurify advisory group | Public BlogPostClient calls sanitize(post.content) with default string options | Installed browser production code, not MCP. Listed IN_PLACE/hooks/custom-elements/template/TrustedTypes modes are not configured. Do not label all sanitizer warnings dev-only. Existing initial rendering uses stored HTML before the hydration sanitizer; that separate trust assumption needs a blog HTML-hardening review before accepting untrusted authors. No blog changes were made here. |
| markdown-it / linkify-it advisory groups | Via @tiptap/pm -> prosemirror-markdown; no project MarkdownParser/Markdown conversion path | Transitive editor parsers; no untrusted Markdown entry was found, and MCP returns JSON text without these libraries. No proof of current production exploitability; not upgraded broadly. |
| fflate GHSA-px8p-9vwx-vf98 | 0.6.10 via drei/three-stdlib; 0.8.2 via @types/three | No project untrusted ZIP/model loader or unzipSync entry found. The @types branch is type-only despite npm's production label; browser-loader branch is conditional/unused in observed source, not an MCP server path. |
| postcss-selector-parser GHSA-rj75-hqrm-r3gf / typography | Typography plugin pins6.0.10 | Trusted repository CSS build path; no dynamic user CSS parse endpoint. Production package label does not imply runtime MCP reachability. No forced typography downgrade/override. |
| uuid GHSA-w5hq-g745-h8pq / svix / resend | Svix request.js uses uuid.v4() for generated idempotency keys | Advisory requires v3/v5/v6 with external buffer/offset; observed Svix call is v4(). Existing notification/email stack is outside MCP reads. No broad email SDK upgrade. |
| @humanfs/node, brace-expansion, js-yaml, esbuild | Only in full audit, absent from omit-dev inventory | Existing lint/test/build-tool paths; no production-server input path demonstrated. Full IDs appear below. Not justification to expose dev servers or accept untrusted build configuration. |

Remaining app-wide decision is narrow: if release policy requires every browser
high finding cleared, authorize a separate **blog/editor hardening** scope
(Tiptap/Markdown dependency set plus DOMPurify and the pre-hydration HTML trust
assumption) with paste/render interaction checks. No database/auth migration is
required. This work does not silently accept that residual risk for deployment.
The account/access approval and production verification gates remain independent.

## Verification of final stack

The complete 629-test suite, both guarded synthetic Postgres integrations and
real-loopback MCP auth tests are rerun against the final lock. The final results
are recorded in VERIFICATION.md. Provider OAuth browser flow, live production
parity, local Codex setup and Work dot call remain NOT RUN. A real production
login/editor visual session was not used for this dependency-only change.
No raw npm audit/log data or environment credentials are committed.

## Advisory inventory

IDs below are the exact npm-registry advisory inventory read on 2026-10-26,
linked to reviewed primary advisories. 'Fixed' means the final installed package
is absent from the final audit; 'Residual' is not a claim of exploitability in
this app. See the exposure table for the required API/runtime conditions.

| Package | Advisory | Status |
| --- | --- | --- |
| @auth/core | [GHSA-7rqj-j65f-68wh](https://github.com/advisories/GHSA-7rqj-j65f-68wh) — Auth.js: Email normalizer validates the address before Unicode normalization, allowing a homoglyph @ bypass | Fixed |
| @auth/core | [GHSA-xmf8-cvqr-rfgj](https://github.com/advisories/GHSA-xmf8-cvqr-rfgj) — Auth.js: getToken() throws an uncaught exception on malformed Bearer authorization headers | Fixed |
| @auth/core | [GHSA-x445-f3h2-j279](https://github.com/advisories/GHSA-x445-f3h2-j279) — Auth.js: OAuth state, nonce, and PKCE check cookies are not bound to the provider that created them | Fixed |
| @tiptap/core | [GHSA-cp6q-959q-f8rh](https://github.com/advisories/GHSA-cp6q-959q-f8rh) — Tiptap: mergeAttributes() turns an own __proto__ key into inherited executable DOM attributes | Residual |
| @tiptap/core | [GHSA-j95f-988m-3j2f](https://github.com/advisories/GHSA-j95f-988m-3j2f) — Tiptap: Quadratic ReDoS in block and inline Markdown attribute parsing | Residual |
| baseline-browser-mapping | [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) — baseline-browser-mapping process termination on invalid input causes denial of service | Fixed |
| dompurify | [GHSA-h7mw-gpvr-xq4m](https://github.com/advisories/GHSA-h7mw-gpvr-xq4m) — DOMPurify: FORBID_TAGS bypassed by function-based ADD_TAGS predicate (asymmetry with FORBID_ATTR fix) | Residual |
| dompurify | [GHSA-crv5-9vww-q3g8](https://github.com/advisories/GHSA-crv5-9vww-q3g8) — DOMPurify has a SAFE_FOR_TEMPLATES bypass in RETURN_DOM mode | Residual |
| dompurify | [GHSA-v9jr-rg53-9pgp](https://github.com/advisories/GHSA-v9jr-rg53-9pgp) — DOMPurify: Prototype Pollution to XSS Bypass via CUSTOM_ELEMENT_HANDLING Fallback | Residual |
| dompurify | [GHSA-hpcv-96wg-7vj8](https://github.com/advisories/GHSA-hpcv-96wg-7vj8) — DOMPurify: Cross-realm IN_PLACE sanitization leaves executable markup intact via realm-bound `instanceof` checks | Residual |
| dompurify | [GHSA-r47g-fvhr-h676](https://github.com/advisories/GHSA-r47g-fvhr-h676) — DOMPurify: IN_PLACE mode preserves attributes of a clobbered root element, allowing XSS via attacker-controlled root DOM | Residual |
| dompurify | [GHSA-rp9w-3fw7-7cwq](https://github.com/advisories/GHSA-rp9w-3fw7-7cwq) — DOMPurify IN_PLACE Sanitization Bypass via Attached Shadow Root Inside <template>.content | Residual |
| dompurify | [GHSA-cmwh-pvxp-8882](https://github.com/advisories/GHSA-cmwh-pvxp-8882) — DOMPurify: Permanent `ALLOWED_ATTR` pollution via `setConfig()` bypassing the hook clone-guard (incomplete fix of the 3.4.7 hook-pollution patch) | Residual |
| dompurify | [GHSA-vxr8-fq34-vvx9](https://github.com/advisories/GHSA-vxr8-fq34-vvx9) — DOMPurify: Trusted Types policy survives `clearConfig()` and can poison later `RETURN_TRUSTED_TYPE` output | Residual |
| dompurify | [GHSA-gvmj-g25r-r7wr](https://github.com/advisories/GHSA-gvmj-g25r-r7wr) — DOMPurify: SAFE_FOR_TEMPLATES bypass - template expressions survive sanitization inside <template> content when using DOM output modes | Residual |
| dompurify | [GHSA-x4vx-rjvf-j5p4](https://github.com/advisories/GHSA-x4vx-rjvf-j5p4) — DOMPurify: `IN_PLACE` mode trusts attacker-controlled `nodeName` on live non-form nodes, allowing script retention and XSS via attacker-supplied DOM objects | Residual |
| dompurify | [GHSA-76mc-f452-cxcm](https://github.com/advisories/GHSA-76mc-f452-cxcm) — DOMPurify: Hook mutation of `data.allowedTags` / `data.allowedAttributes` permanently pollutes `DEFAULT_ALLOWED_TAGS` / `DEFAULT_ALLOWED_ATTR` | Residual |
| dompurify | [GHSA-39q2-94rc-95cp](https://github.com/advisories/GHSA-39q2-94rc-95cp) — DOMPurify's ADD_TAGS function form bypasses FORBID_TAGS due to short-circuit evaluation | Residual |
| dompurify | [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7) — DOMPurify: IN_PLACE hook removal leaves a detached subtree executable, causing XSS | Residual |
| dompurify | [GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4) — DOMPurify: `CUSTOM_ELEMENT_HANDLING` bypasses `afterSanitizeElements` for allowed custom elements. | Residual |
| dompurify | [GHSA-6688-9rhm-gjv2](https://github.com/advisories/GHSA-6688-9rhm-gjv2) — DOMPurify: IN_PLACE returns a force-removed rawtext root whose text carries attacker markup — pure HTML reparse executes | Residual |
| dompurify | [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr) — DOMPurify IN_PLACE: hook that removes a parent or sibling leaves the detached subtree's event handlers armed (incomplete fix for GHSA-p98j-92pf-mc4p) | Residual |
| dompurify | [GHSA-c6gr-qvv4-5v3f](https://github.com/advisories/GHSA-c6gr-qvv4-5v3f) — DOMPurify: SMIL attributeName=href guard is skipped when PARSER_MEDIA_TYPE is application/xhtml+xml | Residual |
| fflate | [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98) — fflate unzipSync can enter an infinite loop when parsing malformed ZIP64 archives | Residual |
| linkify-it | [GHSA-22p9-wv53-3rq4](https://github.com/advisories/GHSA-22p9-wv53-3rq4) — LinkifyIt#match scan loop has quadratic algorithmic complexity | Residual |
| linkify-it | [GHSA-v245-v573-v5vm](https://github.com/advisories/GHSA-v245-v573-v5vm) — linkify-it: Quadratic-complexity DoS via the `mailto:` validator scan-loop on attacker text | Residual |
| markdown-it | [GHSA-6v5v-wf23-fmfq](https://github.com/advisories/GHSA-6v5v-wf23-fmfq) — markdown-it: Quadratic complexity DoS in smartquotes rule via replaceAt string operations | Residual |
| markdown-it | [GHSA-r7fv-28h4-cvq7](https://github.com/advisories/GHSA-r7fv-28h4-cvq7) — markdown-it: Quadratic complexity in smartquotes with unmatched closing quotes | Residual |
| markdown-it | [GHSA-vfgh-jcmw-g37q](https://github.com/advisories/GHSA-vfgh-jcmw-g37q) — markdown-it: Quadratic-time denial of service in inline HTML parsing with html enabled | Residual |
| markdown-it | [GHSA-gfr2-rv44-r23c](https://github.com/advisories/GHSA-gfr2-rv44-r23c) — markdown-it: Quadratic-time rendering of a single multi-line link reference definition with default options (regression since 14.0) | Residual |
| markdown-it | [GHSA-253c-mchw-3w2r](https://github.com/advisories/GHSA-253c-mchw-3w2r) — markdown-it linkify: true has two quadratic paths, so a few hundred KB of markdown blocks the event loop for tens of seconds | Residual |
| nanoid | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) — nanoid: non-secure generators can loop indefinitely with negative size | Fixed |
| nanoid | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) — nanoid: custom generators can loop indefinitely when size is zero | Fixed |
| nanoid | [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) — nanoid: Integer Overflow or Wraparound | Fixed |
| next | [GHSA-q4gf-8mx6-v5v3](https://github.com/advisories/GHSA-q4gf-8mx6-v5v3) — Next.js has a Denial of Service with Server Components | Fixed |
| next | [GHSA-8h8q-6873-q5fj](https://github.com/advisories/GHSA-8h8q-6873-q5fj) — Next.js Vulnerable to Denial of Service with Server Components | Fixed |
| next | [GHSA-26hh-7cqf-hhc6](https://github.com/advisories/GHSA-26hh-7cqf-hhc6) — Next.js has a Middleware / Proxy bypass in App Router applications via segment-prefetch routes - Incomplete Fix Follow-Up | Fixed |
| next | [GHSA-3g8h-86w9-wvmq](https://github.com/advisories/GHSA-3g8h-86w9-wvmq) — Next.js's Middleware / Proxy redirects can be cache-poisoned | Fixed |
| next | [GHSA-ffhc-5mcf-pf4q](https://github.com/advisories/GHSA-ffhc-5mcf-pf4q) — Next.js vulnerable to cross-site scripting in App Router applications using CSP nonces | Fixed |
| next | [GHSA-vfv6-92ff-j949](https://github.com/advisories/GHSA-vfv6-92ff-j949) — Next.js vulnerable to cache poisoning via collisions in React Server Component cache-busting | Fixed |
| next | [GHSA-gx5p-jg67-6x7h](https://github.com/advisories/GHSA-gx5p-jg67-6x7h) — Next.js has cross-site scripting in beforeInteractive scripts with untrusted input | Fixed |
| next | [GHSA-mg66-mrh9-m8jx](https://github.com/advisories/GHSA-mg66-mrh9-m8jx) — Next.js vulnerable to Denial of Service via connection exhaustion in applications using Cache Components | Fixed |
| next | [GHSA-h64f-5h5j-jqjh](https://github.com/advisories/GHSA-h64f-5h5j-jqjh) — Next.js has a Denial of Service in the Image Optimization API | Fixed |
| next | [GHSA-c4j6-fc7j-m34r](https://github.com/advisories/GHSA-c4j6-fc7j-m34r) — Next.js vulnerable to server-side request forgery in applications using WebSocket upgrades | Fixed |
| next | [GHSA-492v-c6pp-mqqv](https://github.com/advisories/GHSA-492v-c6pp-mqqv) — Next.js has a Middleware / Proxy bypass through dynamic route parameter injection | Fixed |
| next | [GHSA-wfc6-r584-vfw7](https://github.com/advisories/GHSA-wfc6-r584-vfw7) — Next.js vulnerable to cache poisoning in React Server Component responses | Fixed |
| next | [GHSA-267c-6grr-h53f](https://github.com/advisories/GHSA-267c-6grr-h53f) — Next.js has a Middleware / Proxy bypass in App Router applications via segment-prefetch routes | Fixed |
| next | [GHSA-36qx-fr4f-26g5](https://github.com/advisories/GHSA-36qx-fr4f-26g5) — Next.js has a Middleware / Proxy bypass in Pages Router applications using i18n | Fixed |
| next | [GHSA-6gpp-xcg3-4w24](https://github.com/advisories/GHSA-6gpp-xcg3-4w24) — Next.js: Middleware / Proxy bypass in App Router applications using Turbopack and single locale | Fixed |
| next | [GHSA-m99w-x7hq-7vfj](https://github.com/advisories/GHSA-m99w-x7hq-7vfj) — Next.js: Denial of Service in App Router using Server Actions | Fixed |
| next | [GHSA-89xv-2m56-2m9x](https://github.com/advisories/GHSA-89xv-2m56-2m9x) — Next.js: Server-Side Request Forgery in Server Actions on custom servers | Fixed |
| next | [GHSA-68g3-v927-f742](https://github.com/advisories/GHSA-68g3-v927-f742) — Next.js: Cache confusion of response bodies for requests with bodies | Fixed |
| next | [GHSA-4633-3j49-mh5q](https://github.com/advisories/GHSA-4633-3j49-mh5q) — Next.js: Cache confusion of response bodies for requests with bodies containing invalid UTF-8 byte sequences | Fixed |
| next | [GHSA-4c39-4ccg-62r3](https://github.com/advisories/GHSA-4c39-4ccg-62r3) — Next.js: Unbounded Server Action payload in Edge runtime | Fixed |
| next | [GHSA-p9j2-gv94-2wf4](https://github.com/advisories/GHSA-p9j2-gv94-2wf4) — Next.js: Server-Side Request Forgery in rewrites via attacker-controlled destination hostname | Fixed |
| next | [GHSA-q8wf-6r8g-63ch](https://github.com/advisories/GHSA-q8wf-6r8g-63ch) — Next.js: Denial of Service in the Image Optimization API using SVGs | Fixed |
| next | [GHSA-955p-x3mx-jcvp](https://github.com/advisories/GHSA-955p-x3mx-jcvp) — Next.js: Unauthenticated disclosure of internal Server Function endpoints | Fixed |
| next | [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) — Next.js: Unauthenticated Remote Code Execution on windows-hosted servers | Fixed |
| next | [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) — Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used | Fixed |
| next | [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) — Next.js: Remote Code Execution in next/og ImageResponse | Fixed |
| next | [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676) — Next.js has cache poisoning of SSG and ISR pages in self-hosted applications | Fixed |
| next | [GHSA-39w2-rjm5-chcv](https://github.com/advisories/GHSA-39w2-rjm5-chcv) — Next.js has information disclosure in development server's Model Context Protocol endpoint | Fixed |
| next | [GHSA-f87g-xv8r-7p7x](https://github.com/advisories/GHSA-f87g-xv8r-7p7x) — Next.js has information disclosure in App Router metadata image routes via dynamicParams bypass | Fixed |
| next | [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) — Next.js has cache poisoning in SSG/ISR rendering that leads to cross-user content substitution and persistent denial of service | Fixed |
| next | [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) — Next.js has Server-Side Request Forgery in Image Optimization | Fixed |
| next | [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) — Next.js: Unauthenticated Remote Code Execution in Image Optimization API when SVG files are used | Fixed |
| next | [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) — Next.js: Denial of Service in App Router using Server Actions | Fixed |
| next | [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) — Next.js: Unauthenticated Remote Code Execution in `use cache` functions returning typed arrays | Fixed |
| next-auth | [GHSA-8fpg-xm3f-6cx3](https://github.com/advisories/GHSA-8fpg-xm3f-6cx3) — Auth.js: Configuration errors can cause existence-based auth checks to fail open (auth object populated with an error) | Fixed |
| next-auth | [GHSA-7rqj-j65f-68wh](https://github.com/advisories/GHSA-7rqj-j65f-68wh) — Auth.js: Email normalizer validates the address before Unicode normalization, allowing a homoglyph @ bypass | Fixed |
| next-auth | [GHSA-xmf8-cvqr-rfgj](https://github.com/advisories/GHSA-xmf8-cvqr-rfgj) — Auth.js: getToken() throws an uncaught exception on malformed Bearer authorization headers | Fixed |
| next-auth | [GHSA-x445-f3h2-j279](https://github.com/advisories/GHSA-x445-f3h2-j279) — Auth.js: OAuth state, nonce, and PKCE check cookies are not bound to the provider that created them | Fixed |
| postcss | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) — PostCSS has XSS via Unescaped </style> in its CSS Stringify Output | Fixed |
| postcss | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) — PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments | Fixed |
| postcss | [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) — PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset | Fixed |
| postcss | [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) — PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure | Fixed |
| postcss-selector-parser | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) — PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion | Residual |
| prosemirror-view | [GHSA-c8x8-7fp4-3x9w](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w) — ProseMirror has a XSS vulnerability in prosemirror-view's paste handling | Fixed |
| sharp | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 | Fixed |
| sharp | [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) — sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545 | Fixed |
| sharp | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) — sharp : Vulnerability in librsvg dependency CVE-2026-96889 | Fixed |
| source-map-js | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) — source-map-js allows event-loop denial of service through indexed source-map section offsets | Fixed |
| uuid | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided | Residual |
| zod | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) — Zod can exhaust memory while validating oversized constrained collections | Fixed |

### Additional dev-only inventory

| Package | Advisory |
| --- | --- |
| @humanfs/node | [GHSA-p498-v437-472g](https://github.com/advisories/GHSA-p498-v437-472g) — humanfs: Recursive copy follows symlinked files and copies data from outside the source tree |
| brace-expansion | [GHSA-jxxr-4gwj-5jf2](https://github.com/advisories/GHSA-jxxr-4gwj-5jf2) — brace-expansion: Large numeric range defeats documented `max` DoS protection |
| brace-expansion | [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) — brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups |
| brace-expansion | [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash |
| brace-expansion | [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) — brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation |
| brace-expansion | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) — brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service |
| brace-expansion | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) — brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion |
| brace-expansion | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) — brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion |
| esbuild | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) — esbuild allows arbitrary file read when running the development server on Windows |
| js-yaml | [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) — JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases |
| js-yaml | [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) — js-yaml: YAML merge-key chains can force quadratic CPU consumption |
| js-yaml | [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) — JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported |
| js-yaml | [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) — js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources |
