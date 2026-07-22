import assert from "node:assert/strict";
import test from "node:test";

import { classifyWebsiteUrl, looksParked } from "./classify-website";

test("social profiles and directory links are not classified as websites", () => {
  for (const url of [
    "https://facebook.com/bakery",
    "https://www.instagram.com/bakery",
    "https://tiktok.com/@bakery",
    "https://linktr.ee/bakery",
    "https://wa.me/972501234567",
    "https://www.waze.com/live-map/directions",
  ]) {
    assert.equal(classifyWebsiteUrl(url), "SOCIAL_ONLY", url);
  }
});

test("valid business URLs are active and malformed values are unknown", () => {
  assert.equal(classifyWebsiteUrl("http://example.com"), "ACTIVE");
  assert.equal(classifyWebsiteUrl("not a url"), "UNKNOWN");
  assert.equal(classifyWebsiteUrl("ftp://example.com"), "UNKNOWN");
});

test("registrar and domain-sale pages look parked", () => {
  assert.equal(
    looksParked({ title: "This domain is for sale", bodyText: "Buy this domain through Sedo." }),
    true,
  );
  assert.equal(
    looksParked({ title: "Coming Soon", bodyText: "This website is parked free, courtesy of GoDaddy." }),
    true,
  );
});

test("a normal Hebrew business page is not parked", () => {
  assert.equal(
    looksParked({
      title: "מאפיית השכונה",
      bodyText: "לחמים טריים בכל בוקר, שעות פתיחה ויצירת קשר.",
    }),
    false,
  );
});
