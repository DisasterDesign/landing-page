import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type PersistedRole = "ADMIN" | "SELLER" | "MEMBER";

type RequirePersistedUserRole = (
  userId: string,
  allowedRoles: readonly PersistedRole[],
  dependencies: {
    db: {
      user: {
        findUnique(input: {
          where: { id: string };
          select: { role: true };
        }): Promise<{ role: PersistedRole } | null>;
      };
    };
  },
) => Promise<PersistedRole>;

async function loadRequirePersistedUserRole(): Promise<
  RequirePersistedUserRole | undefined
> {
  const loaded = await import("./persisted-role").catch(() => ({}));
  return (
    loaded as {
      requirePersistedUserRole?: RequirePersistedUserRole;
    }
  ).requirePersistedUserRole;
}

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function getNamedHandlerSource(route: string, method: string): string {
  const handler = route.match(
    new RegExp(
      `export async function ${method}[\\s\\S]*?(?=\\nexport (?:async )?function |\\nexport const |$)`,
    ),
  );
  assert.ok(handler, `${method} handler must exist`);
  return handler[0];
}

function getHandlerSource(route: string): string {
  return getNamedHandlerSource(route, "GET");
}

test("persisted role guard reads only the current role", async () => {
  const requireRole = await loadRequirePersistedUserRole();
  assert.equal(typeof requireRole, "function");
  if (!requireRole) return;

  const calls: unknown[] = [];
  const db = {
    user: {
      async findUnique(input: {
        where: { id: string };
        select: { role: true };
      }) {
        calls.push(input);
        return { role: "ADMIN" as const };
      },
    },
  };

  assert.equal(await requireRole("admin-1", ["ADMIN"], { db }), "ADMIN");
  assert.deepEqual(calls, [
    {
      where: { id: "admin-1" },
      select: { role: true },
    },
  ]);
});

test("persisted role guard fails closed for revoked and deleted admins", async () => {
  const requireRole = await loadRequirePersistedUserRole();
  assert.equal(typeof requireRole, "function");
  if (!requireRole) return;

  const db = {
    user: {
      async findUnique({ where }: { where: { id: string } }) {
        if (where.id === "revoked-admin") {
          return { role: "MEMBER" as const };
        }
        return null;
      },
    },
  };

  await assert.rejects(
    requireRole("revoked-admin", ["ADMIN"], { db }),
    /role|authorized|forbidden/i,
  );
  await assert.rejects(
    requireRole("deleted-admin", ["ADMIN"], { db }),
    /role|authorized|forbidden/i,
  );
});

test("admin PII list and detail routes guard persisted ADMIN before querying", () => {
  const routes = [
    [
      "../../app/api/agreements/route.ts",
      "prisma.agreement.findMany",
    ],
    [
      "../../app/api/agreements/[id]/route.ts",
      "prisma.agreement.findUnique",
    ],
    [
      "../../app/api/agreements/[id]/download/route.ts",
      "prisma.agreement.findUnique",
    ],
    [
      "../../app/api/contacts/route.ts",
      "prisma.contactSubmission.findMany",
    ],
    [
      "../../app/api/users/route.ts",
      "prisma.user.findMany",
    ],
  ] as const;

  for (const [relativePath, firstPiiQuery] of routes) {
    const handler = getHandlerSource(source(relativePath));
    const guard = handler.match(
      // requireAdmin joined the accepted forms on 12.8.2026 (Roy's return to
      // ADMIN): it reads the persisted role via getViewer — DB, never the
      // JWT — which is exactly the property this test exists to pin.
      /await\s+(?:requirePersistedUserRole\(\s*session\.user\.id,\s*\[\s*"ADMIN"\s*\]\s*\)|requireOwner\(\s*\)|requireAdmin\(\s*\))/,
    );
    assert.ok(guard, `${relativePath} must require persisted ADMIN`);
    assert.ok(
      handler.indexOf(guard[0]) < handler.indexOf(firstPiiQuery),
      `${relativePath} must authorize before its first PII query`,
    );
  }
});

test("admin agreement PATCH authorizes before its no-op PII response", () => {
  const route = source("../../app/api/agreements/[id]/route.ts");
  const handler = getNamedHandlerSource(route, "PATCH");
  const guard = handler.match(
    /await\s+(?:requirePersistedUserRole\(\s*session\.user\.id,\s*\[\s*"ADMIN"\s*\]\s*\)|requireOwner\(\s*\))/,
  );
  assert.ok(guard, "PATCH must require persisted ADMIN");
  assert.ok(
    handler.indexOf(guard[0]) <
      handler.indexOf("prisma.agreement.findUnique"),
    "PATCH must authorize before reading or returning Agreement PII",
  );
});

test("client admin routes guard persisted ADMIN before reads and mutations", () => {
  const routes = [
    [
      "../../app/api/clients/route.ts",
      "GET",
      "prisma.client.findMany",
    ],
    [
      "../../app/api/clients/route.ts",
      "POST",
      "prisma.client.create",
    ],
    [
      "../../app/api/clients/[id]/route.ts",
      "GET",
      "prisma.client.findUnique",
    ],
    [
      "../../app/api/clients/[id]/route.ts",
      "PATCH",
      "prisma.clientProduct.findMany",
    ],
    [
      "../../app/api/clients/[id]/route.ts",
      "DELETE",
      "prisma.client.delete",
    ],
    [
      "../../app/api/clients/bulk-urls/route.ts",
      "POST",
      "prisma.$transaction",
    ],
    [
      "../../app/api/clients/[id]/notes/route.ts",
      "GET",
      "prisma.clientNote.findMany",
    ],
    [
      "../../app/api/clients/[id]/notes/route.ts",
      "POST",
      "prisma.client.findUnique",
    ],
    [
      "../../app/api/clients/[id]/archive/route.ts",
      "POST",
      "prisma.client.update",
    ],
    [
      "../../app/api/clients/[id]/products/route.ts",
      "GET",
      "prisma.clientProduct.findMany",
    ],
    [
      "../../app/api/clients/[id]/products/route.ts",
      "POST",
      "prisma.client.findUnique",
    ],
    [
      "../../app/api/clients/[id]/products/[productId]/route.ts",
      "PATCH",
      "prisma.clientProduct.findUnique",
    ],
    [
      "../../app/api/clients/[id]/products/[productId]/route.ts",
      "DELETE",
      "prisma.clientProduct.findUnique",
    ],
  ] as const;

  for (const [relativePath, method, firstQuery] of routes) {
    const handler = getNamedHandlerSource(source(relativePath), method);
    const guard = handler.match(
      // requireAdmin joined the accepted forms on 12.8.2026 (Roy's return to
      // ADMIN): it reads the persisted role via getViewer — DB, never the
      // JWT — which is exactly the property this test exists to pin.
      /await\s+(?:requirePersistedUserRole\(\s*session\.user\.id,\s*\[\s*"ADMIN"\s*\]\s*\)|requireOwner\(\s*\)|requireAdmin\(\s*\))/,
    );
    assert.ok(
      guard,
      `${method} ${relativePath} must require persisted ADMIN`,
    );
    assert.ok(
      handler.indexOf(guard[0]) < handler.indexOf(firstQuery),
      `${method} ${relativePath} must authorize before ${firstQuery}`,
    );
  }
});

test("finance and billing repair routes guard persisted ADMIN before sensitive work", () => {
  const routes = [
    [
      "../../app/api/finance/debtors/route.ts",
      "GET",
      "prisma.agreementCharge.findMany",
    ],
    [
      "../../app/api/finance/debtors/refresh/route.ts",
      "POST",
      "sweepTerminalFailures",
    ],
    [
      "../../app/api/finance/route.ts",
      "GET",
      "prisma.client.findMany",
    ],
    [
      "../../app/api/finance/debtors/dismiss/route.ts",
      "POST",
      "getDismissedDebtors",
    ],
    [
      "../../app/api/agreements/retry-recurring/route.ts",
      "POST",
      "prisma.agreement.findMany",
    ],
    [
      "../../app/api/agreements/fix-lowprofile/route.ts",
      "POST",
      "prisma.agreement.update",
    ],
    [
      "../../app/api/payments/create/route.ts",
      "POST",
      "ensurePaymentUrlForAgreement",
    ],
  ] as const;

  for (const [relativePath, method, firstSensitiveAction] of routes) {
    const handler = getNamedHandlerSource(source(relativePath), method);
    const guard = handler.match(
      // requireAdmin joined the accepted forms on 12.8.2026 (Roy's return to
      // ADMIN): it reads the persisted role via getViewer — DB, never the
      // JWT — which is exactly the property this test exists to pin.
      /await\s+(?:requirePersistedUserRole\(\s*session\.user\.id,\s*\[\s*"ADMIN"\s*\]\s*\)|requireOwner\(\s*\)|requireAdmin\(\s*\))/,
    );
    assert.ok(
      guard,
      `${method} ${relativePath} must require persisted ADMIN`,
    );
    assert.ok(
      handler.indexOf(guard[0]) < handler.indexOf(firstSensitiveAction),
      `${method} ${relativePath} must authorize before ${firstSensitiveAction}`,
    );
  }
});
