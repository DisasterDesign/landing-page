import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { applyPaymentToProduct } from "./client-products";

type Product = {
  id: string;
  agreementId: string | null;
  financeBook: "PRIVATE" | "SHARED";
  monthlyAmount: number;
  status: string;
  startDate: Date | null;
};
function paymentStore(products: Product[]) {
  const client = { monthlyAmount: 0 };
  const db = {
    agreement: { async findUnique() { return { financeBook: "SHARED" }; } },
    clientProduct: {
      async findMany() { return products; },
      async update({ where, data }: { where: { id: string }; data: Partial<Product> }) {
        const product = products.find(row => row.id === where.id)!;
        Object.assign(product, data);
        return product;
      },
      async updateMany({ where, data }: { where: { id: string; agreementId: string | null; financeBook: string }; data: Partial<Product> }) {
        const existing = products.find(row => row.id === where.id && row.agreementId === where.agreementId && row.financeBook === where.financeBook);
        if (!existing) return { count: 0 };
        Object.assign(existing, data);
        return { count: 1 };
      },
      async create({ data }: { data: Omit<Product, "id"> }) {
        const product = { id: "created", ...data };
        products.push(product);
        return product;
      },
    },
    client: {
      async findUnique() { return { name: "Client" }; },
      async update({ data }: { data: { monthlyAmount: number } }) { Object.assign(client, data); return client; },
    },
  };
  return { db: db as unknown as Prisma.TransactionClient, client };
}
const paidAt = new Date("2026-10-26T10:00:00Z");
function product(agreementId: string | null): Product {
  return { id: "existing", agreementId, financeBook: "SHARED", monthlyAmount: 200, status: "בוצע", startDate: new Date("2026-08-01T10:00:00Z") };
}

test("payment never steals the client's only product from a different agreement in the same book", async () => {
  const original = product("other-agreement");
  const products = [{ ...original }];
  const store = paymentStore(products);
  await applyPaymentToProduct(store.db, "client", "incoming-agreement", 900, paidAt);
  assert.deepEqual(products, [original]);
  assert.equal(store.client.monthlyAmount, 200);
});

test("a same-book payment may claim the sole unlinked product", async () => {
  const products = [product(null)];
  const store = paymentStore(products);
  await applyPaymentToProduct(store.db, "client", "incoming-agreement", 900, paidAt);
  assert.equal(products[0].agreementId, "incoming-agreement");
  assert.equal(products[0].monthlyAmount, 900);
  assert.equal(store.client.monthlyAmount, 900);
});

test("payment updates its exact product while preserving a second agreement's product", async () => {
  const untouched = product("other-agreement");
  const products = [{ ...untouched }, { ...product("incoming-agreement"), id: "matching" }];
  const store = paymentStore(products);
  await applyPaymentToProduct(store.db, "client", "incoming-agreement", 900, paidAt);
  assert.deepEqual(products[0], untouched);
  assert.equal(products[1].monthlyAmount, 900);
  assert.equal(store.client.monthlyAmount, 1100);
});

test("atomic product claim rejects an already linked record and never overwrites the link", async () => {
  const api = await import("./client-products") as typeof import("./client-products");
  assert.equal(typeof api.claimUnlinkedProductForAgreement, "function");
  const stored = product("other-agreement");
  const db = { clientProduct: { async updateMany({ where, data }: { where: { agreementId: null }; data: { agreementId: string } }) {
    if (stored.agreementId !== where.agreementId) return { count: 0 };
    stored.agreementId = data.agreementId;
    return { count: 1 };
  } } } as unknown as Prisma.TransactionClient;
  await assert.rejects(api.claimUnlinkedProductForAgreement(db, { productId: stored.id, clientId: "client", financeBook: "SHARED", agreementId: "new-agreement" }));
  assert.equal(stored.agreementId, "other-agreement");
});

test("payment cannot claim a product that another agreement linked after the lookup", async () => {
 const products = [product(null)];
 const store = paymentStore(products);
 const db = store.db;
 let lookedUp = false;
 db.clientProduct.findMany = (async () => {
   if (lookedUp) return products;
   lookedUp = true;
   const snapshot = products.map(row => ({ ...row }));
   products[0].agreementId = "concurrent-agreement";
   return snapshot;
 }) as typeof db.clientProduct.findMany;
 await applyPaymentToProduct(db, "client", "incoming-agreement", 900, paidAt);
 assert.equal(products[0].agreementId, "concurrent-agreement");
 assert.equal(products[0].monthlyAmount, 200);
});
