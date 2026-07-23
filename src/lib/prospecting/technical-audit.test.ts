import assert from "node:assert/strict";
import test from "node:test";

import {
  auditCommerce,
  COMMERCE_AUDIT_VERSION,
} from "./commerce-audit";
import { auditHtml } from "./technical-audit";

const HEALTHY_STORE_HTML = `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <title>חנות מקומית למוצרי בית</title>
    <meta name="description" content="מוצרים לבית עם משלוח מהיר ושירות אישי">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="canonical" href="https://shop.example/products">
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"מוצר","offers":{"@type":"Offer","price":"99"}}
    </script>
  </head>
  <body>
    <h1>מוצרים לבית</h1>
    <a href="/products/item">למוצר</a>
    <a href="/cart">עגלה</a>
    <a href="/checkout">לתשלום</a>
    <a href="/shipping">משלוחים והחזרות</a>
    <img src="/product.jpg" alt="מוצר לבית">
    <time datetime="2026-06-10">עודכן ביוני 2026</time>
  </body>
</html>`;

test("technical audit extracts indexability, SEO, links, images and explicit dates", () => {
  const result = auditHtml({
    url: "https://shop.example/products",
    html: HEALTHY_STORE_HTML,
    brokenLinks: ["https://shop.example/missing"],
    brokenImages: ["https://shop.example/broken.jpg"],
    now: new Date("2026-07-22T00:00:00Z"),
  });

  assert.deepEqual(result, {
    indexable: true,
    hasTitle: true,
    hasMetaDescription: true,
    h1Count: 1,
    hasCanonical: true,
    hasViewport: true,
    structuredDataTypes: ["Offer", "Product"],
    internalLinkCount: 4,
    imageCount: 1,
    imagesMissingAlt: 0,
    brokenLinkCount: 1,
    brokenImageCount: 1,
    latestExplicitDate: "2026-06-10",
    hasStaleExplicitDate: false,
  });
});

test("non-indexable thin pages expose missing fundamentals and stale dates", () => {
  const result = auditHtml({
    url: "https://example.com",
    html: `<html><head><meta name="robots" content="noindex,nofollow"></head>
      <body><h2>בקרוב</h2><img src="logo.png"><time datetime="2019-01-02">2019</time></body></html>`,
    now: new Date("2026-07-22T00:00:00Z"),
  });

  assert.equal(result.indexable, false);
  assert.equal(result.hasTitle, false);
  assert.equal(result.hasMetaDescription, false);
  assert.equal(result.h1Count, 0);
  assert.equal(result.hasCanonical, false);
  assert.equal(result.hasViewport, false);
  assert.equal(result.imagesMissingAlt, 1);
  assert.equal(result.latestExplicitDate, "2019-01-02");
  assert.equal(result.hasStaleExplicitDate, true);
});

test("commerce audit recognizes a functioning store funnel", () => {
  assert.equal(COMMERCE_AUDIT_VERSION, 1);
  const result = auditCommerce({
    url: "https://shop.example/products",
    html: HEALTHY_STORE_HTML,
  });

  assert.equal(result.hasProductStructuredData, true);
  assert.equal(result.hasProductLink, true);
  assert.equal(result.hasCartLink, true);
  assert.equal(result.hasCheckoutLink, true);
  assert.equal(result.hasShippingOrReturnsEvidence, true);
  assert.equal(result.businessShape, "ECOMMERCE");
});

test("ordinary contact sites are classified as service businesses", () => {
  const result = auditCommerce({
    url: "https://plumber.example",
    html: `<html><body><h1>אינסטלטור</h1><a href="/contact">צרו קשר</a><a href="tel:0501234567">התקשרו</a></body></html>`,
  });

  assert.equal(result.hasContactPath, true);
  assert.equal(result.businessShape, "SERVICE");
});
