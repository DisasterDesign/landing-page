import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as authorization from "./authorization";

type RequirePersistedLeadReadRole = (
  userId: string,
  allowedRoles: readonly ("ADMIN" | "SELLER")[],
  dependencies: {
    db: {
      user: {
        findUnique(input: {
          where: { id: string };
          select: { role: true };
        }): Promise<{ role: "ADMIN" | "SELLER" | "MEMBER" } | null>;
      };
    };
  },
) => Promise<"ADMIN" | "SELLER">;

type SellerAgreementScope = (
  sellerId: string,
) => {
  OR: Array<Record<string, unknown>>;
};

interface SellerAgreementLead {
  ownerId: string | null;
  migrationReviewRequired: boolean;
  intentLevel: string | null;
  sourceKey: string | null;
  stage: string | null;
}

type CanSellerReadAgreement = (
  sellerId: string,
  agreement: {
    leadId: string | null;
    creditedSellerId: string | null;
    createdBy: string;
    lead: SellerAgreementLead | null;
  },
) => boolean;

type CanSellerManageAgreement = CanSellerReadAgreement;

type SellerAgreementOperationalFields = (
  canManage: boolean,
  fields: { phone: string; signToken: string },
) => Partial<{ phone: string; signToken: string }>;

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("persisted lead reader role fails closed after role revocation", async () => {
  const requireRole = (
    authorization as typeof authorization & {
      requirePersistedLeadReadRole?: RequirePersistedLeadReadRole;
    }
  ).requirePersistedLeadReadRole;
  assert.equal(typeof requireRole, "function");
  if (!requireRole) return;

  const db = {
    user: {
      async findUnique({ where }: { where: { id: string } }) {
        if (where.id === "admin-1") return { role: "ADMIN" as const };
        if (where.id === "seller-1") return { role: "SELLER" as const };
        if (where.id === "revoked-1") return { role: "MEMBER" as const };
        return null;
      },
    },
  };

  assert.equal(
    await requireRole("admin-1", ["ADMIN"], { db }),
    "ADMIN",
  );
  assert.equal(
    await requireRole("seller-1", ["ADMIN", "SELLER"], { db }),
    "SELLER",
  );
  await assert.rejects(
    requireRole("seller-1", ["ADMIN"], { db }),
    /forbidden|role|authorized/i,
  );
  await assert.rejects(
    requireRole("revoked-1", ["ADMIN", "SELLER"], { db }),
    /forbidden|role|authorized/i,
  );
  await assert.rejects(
    requireRole("deleted-1", ["ADMIN", "SELLER"], { db }),
    /forbidden|role|authorized/i,
  );
});

test("every admin and seller lead read route verifies the current persisted role", () => {
  const routes = [
    ["../../app/api/leads/route.ts", ["ADMIN"]],
    ["../../app/api/leads/[id]/route.ts", ["ADMIN"]],
    ["../../app/api/leads/analytics/route.ts", ["ADMIN"]],
    ["../../app/api/seller/leads/route.ts", ["ADMIN", "SELLER"]],
    ["../../app/api/seller/leads/[id]/route.ts", ["ADMIN", "SELLER"]],
    ["../../app/api/seller/cold-leads/route.ts", ["ADMIN", "SELLER"]],
    ["../../app/api/seller/cold-leads/[id]/route.ts", ["ADMIN", "SELLER"]],
    ["../../app/api/seller/follow-ups/route.ts", ["ADMIN", "SELLER"]],
    ["../../app/api/seller/agreements/route.ts", ["ADMIN", "SELLER"]],
  ] as const;

  for (const [file, roles] of routes) {
    const route = source(file);
    const call = route.match(
      /await\s+requirePersistedLeadReadRole\(\s*session\.user\.id,\s*\[([^\]]+)\]/,
    );
    assert.ok(call, `${file} must verify the persisted reader role`);
    for (const role of roles) {
      assert.match(call[1] ?? "", new RegExp(`["']${role}["']`), file);
    }
  }
});

test("seller agreement access follows the current linked lead owner without leaking frozen credit", () => {
  const access = authorization as typeof authorization & {
    sellerAgreementScope?: SellerAgreementScope;
    canSellerReadAgreement?: CanSellerReadAgreement;
    canSellerManageAgreement?: CanSellerManageAgreement;
  };
  assert.equal(typeof access.sellerAgreementScope, "function");
  assert.equal(typeof access.canSellerReadAgreement, "function");
  assert.equal(typeof access.canSellerManageAgreement, "function");
  if (
    !access.sellerAgreementScope ||
    !access.canSellerReadAgreement ||
    !access.canSellerManageAgreement
  ) {
    return;
  }

  assert.deepEqual(access.sellerAgreementScope("seller-2"), {
    OR: [
      {
        lead: {
          is: {
            ownerId: "seller-2",
            migrationReviewRequired: false,
            intentLevel: { not: null },
            sourceKey: { not: null },
            stage: { not: null },
          },
        },
      },
      { creditedSellerId: "seller-2" },
      { creditedSellerId: null, createdBy: "seller-2" },
    ],
  });

  const reassigned = {
    leadId: "lead-1",
    creditedSellerId: "seller-1",
    createdBy: "seller-1",
    lead: {
      ownerId: "seller-2",
      migrationReviewRequired: false,
      intentLevel: "INBOUND",
      sourceKey: "website",
      stage: "AGREEMENT_DRAFT",
    },
  };
  assert.equal(access.canSellerReadAgreement("seller-2", reassigned), true);
  assert.equal(access.canSellerReadAgreement("seller-1", reassigned), true);
  assert.equal(access.canSellerReadAgreement("seller-3", reassigned), false);
  assert.equal(access.canSellerManageAgreement("seller-2", reassigned), true);
  assert.equal(access.canSellerManageAgreement("seller-1", reassigned), false);
  assert.equal(access.canSellerManageAgreement("seller-3", reassigned), false);

  const route = source("../../app/api/seller/agreements/route.ts");
  assert.match(route, /canManage\s*[:,]/);
  assert.match(route, /canSellerManageAgreement/);
  assert.match(route, /migrationReviewRequired:\s*true/);
  assert.doesNotMatch(route, /persistedRole\s*===\s*"ADMIN"\s*\|\|/);
});

test("seller agreement owner access fails closed until every canonical field is ready", () => {
  const access = authorization as typeof authorization & {
    canSellerReadAgreement?: CanSellerReadAgreement;
    canSellerManageAgreement?: CanSellerManageAgreement;
  };
  assert.equal(typeof access.canSellerReadAgreement, "function");
  assert.equal(typeof access.canSellerManageAgreement, "function");
  if (!access.canSellerReadAgreement || !access.canSellerManageAgreement) {
    return;
  }

  const ready = {
    leadId: "lead-1",
    creditedSellerId: "seller-1",
    createdBy: "seller-1",
    lead: {
      ownerId: "seller-2",
      migrationReviewRequired: false,
      intentLevel: "AD_RESPONSE",
      sourceKey: "meta_lead_ads",
      stage: "AGREEMENT_SENT",
    },
  };
  const incompleteLeads: SellerAgreementLead[] = [
    { ...ready.lead, migrationReviewRequired: true },
    { ...ready.lead, intentLevel: null },
    { ...ready.lead, sourceKey: null },
    { ...ready.lead, stage: null },
  ];

  for (const lead of incompleteLeads) {
    const agreement = { ...ready, lead };
    assert.equal(
      access.canSellerReadAgreement("seller-2", agreement),
      false,
    );
    assert.equal(
      access.canSellerManageAgreement("seller-2", agreement),
      false,
    );
    assert.equal(
      access.canSellerReadAgreement("seller-1", agreement),
      true,
    );
    assert.equal(
      access.canSellerManageAgreement("seller-1", agreement),
      false,
    );
  }
});

test("unlinked legacy agreement access preserves frozen-credit and creator fallback isolation", () => {
  const access = authorization as typeof authorization & {
      canSellerReadAgreement?: CanSellerReadAgreement;
      canSellerManageAgreement?: CanSellerManageAgreement;
    };
  assert.equal(typeof access.canSellerReadAgreement, "function");
  assert.equal(typeof access.canSellerManageAgreement, "function");
  if (!access.canSellerReadAgreement || !access.canSellerManageAgreement) {
    return;
  }

  const creditedLegacy = {
    leadId: null,
    creditedSellerId: "seller-1",
    createdBy: "seller-2",
    lead: null,
  };
  assert.equal(access.canSellerReadAgreement("seller-1", creditedLegacy), true);
  assert.equal(access.canSellerReadAgreement("seller-2", creditedLegacy), false);
  assert.equal(
    access.canSellerManageAgreement("seller-1", creditedLegacy),
    false,
  );

  const creatorFallback = {
    leadId: null,
    creditedSellerId: null,
    createdBy: "seller-2",
    lead: null,
  };
  assert.equal(access.canSellerReadAgreement("seller-2", creatorFallback), true);
  assert.equal(access.canSellerReadAgreement("seller-1", creatorFallback), false);
  assert.equal(
    access.canSellerManageAgreement("seller-2", creatorFallback),
    false,
  );
});

test("seller sales gates operational agreement actions by the explicit capability", () => {
  const sales = source("../../app/seller/(dashboard)/sales/page.tsx");

  assert.match(sales, /canManage:\s*true/);
  assert.match(sales, /canManage:\s*false/);
  assert.match(sales, /d\.canManage\s*&&\s*d\.lead/);
  assert.match(sales, /d\.canManage\s*\?\s*\(/);
  assert.match(sales, /לצפייה בלבד/);
});

test("history-only agreement DTO omits signing bearer fields and customer phone", () => {
  const operationalFields = (
    authorization as typeof authorization & {
      sellerAgreementOperationalFields?: SellerAgreementOperationalFields;
    }
  ).sellerAgreementOperationalFields;
  assert.equal(typeof operationalFields, "function");
  if (!operationalFields) return;

  const secrets = {
    phone: "050-123-4567",
    signToken: "public-signing-bearer-token",
  };
  assert.deepEqual(operationalFields(false, secrets), {});
  assert.deepEqual(operationalFields(true, secrets), secrets);

  const historyPayload = operationalFields(false, secrets);
  assert.equal("phone" in historyPayload, false);
  assert.equal("signToken" in historyPayload, false);
  assert.doesNotMatch(
    JSON.stringify(historyPayload),
    /050-123-4567|public-signing-bearer-token/,
  );

  const route = source("../../app/api/seller/agreements/route.ts");
  assert.match(route, /sellerAgreementOperationalFields/);
  assert.match(
    route,
    /\{\s*lead,\s*phone,\s*signToken,\s*\.\.\.agreement\s*\}/,
  );
});
