import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Every admin surface that renders a signing link builds it as
 * `/agreement/${a.signToken}`. When the API behind that surface omits
 * signToken the href silently becomes `/agreement/undefined` — the page still
 * returns 200 (Next renders not-found), nothing throws, and nobody notices
 * until a customer says the link is dead. That is exactly what happened:
 * fde5baf stripped the token from the agreements listing, and the clients
 * endpoint never selected it at all.
 *
 * These are source guards rather than request tests because the failure is a
 * missing field in a Prisma select, which no amount of runtime mocking of the
 * route would catch.
 */

const read = (p: string) => readFileSync(p, "utf8");

const AGREEMENTS_ROUTE = "src/app/api/agreements/route.ts";
const CLIENT_ROUTE = "src/app/api/clients/[id]/route.ts";
const ADMIN_AGREEMENTS_PAGE = "src/app/admin/(dashboard)/agreements/page.tsx";
const ADMIN_CLIENT_PAGE = "src/app/admin/(dashboard)/clients/[id]/page.tsx";

test("the agreements listing does not strip signToken out of the response", () => {
  const source = read(AGREEMENTS_ROUTE);

  assert.ok(
    !/signToken:\s*_signToken/.test(source),
    "GET /api/agreements destructures signToken away again — the admin " +
      "copy-link button will build /agreement/undefined",
  );
});

test("the client detail endpoint selects signToken for its agreements", () => {
  const source = read(CLIENT_ROUTE);
  const agreementsSelect = source.slice(
    source.indexOf("agreements: {"),
    source.indexOf("clientNotes:"),
  );

  assert.ok(
    agreementsSelect.length > 0,
    "could not locate the agreements select in the client detail route",
  );
  assert.ok(
    /signToken:\s*true/.test(agreementsSelect),
    "GET /api/clients/[id] omits signToken — the agreement and PDF links on " +
      "the client card render /agreement/undefined",
  );
});

test("admin surfaces still feed signToken into the signing link", () => {
  // If a page stops reading signToken the guards above lose their purpose, so
  // pin the coupling explicitly rather than let it drift. The two pages reach
  // the link differently: the listing passes the token to copyLink(), the
  // client card interpolates it straight into the href.
  assert.ok(
    /copyLink\(\s*\w+\.signToken\s*\)/.test(read(ADMIN_AGREEMENTS_PAGE)),
    `${ADMIN_AGREEMENTS_PAGE} no longer passes signToken to copyLink — update these guards`,
  );
  assert.ok(
    /\/agreement\/\$\{\s*\w+\.signToken\s*\}/.test(read(ADMIN_CLIENT_PAGE)),
    `${ADMIN_CLIENT_PAGE} no longer builds /agreement/\${...signToken} — update these guards`,
  );
});
