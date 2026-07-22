import assert from "node:assert/strict";
import test from "node:test";

import { isForbiddenHostname, isPublicIp } from "./network-safety";
import { safeFetchHtml } from "./safe-fetch";

test("private, loopback, link-local, unspecified and metadata IPs are rejected", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fdff::1",
    "fe80::1",
    "::ffff:192.168.1.1",
  ]) {
    assert.equal(isPublicIp(address), false, address);
  }
});

test("representative Google and Cloudflare public IPs are accepted", () => {
  for (const address of [
    "8.8.8.8",
    "1.1.1.1",
    "2001:4860:4860::8888",
    "2606:4700:4700::1111",
  ]) {
    assert.equal(isPublicIp(address), true, address);
  }
});

test("metadata and local hostnames are rejected before DNS", () => {
  for (const hostname of [
    "localhost",
    "api.localhost",
    "metadata.google.internal",
    "metadata.aws.internal",
  ]) {
    assert.equal(isForbiddenHostname(hostname), true, hostname);
  }
  assert.equal(isForbiddenHostname("fuzionwebz.com"), false);
});

test("safe fetch rejects a public host that resolves to a private address", async () => {
  const result = await safeFetchHtml("https://example.com", {
    lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    fetchImpl: async () => new Response("should not run"),
  });

  assert.deepEqual(result, { ok: false, code: "BLOCKED_HOST" });
});

test("safe fetch validates every redirect target", async () => {
  let calls = 0;
  const result = await safeFetchHtml("https://example.com", {
    lookup: async (hostname) => [
      { address: hostname === "example.com" ? "1.1.1.1" : "127.0.0.1", family: 4 },
    ],
    fetchImpl: async () => {
      calls += 1;
      return new Response(null, {
        status: 302,
        headers: { location: "http://internal.example/private" },
      });
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: false, code: "BLOCKED_HOST" });
});

test("safe fetch accepts bounded HTML and rejects oversized or non-HTML responses", async () => {
  const lookup = async () => [{ address: "1.1.1.1", family: 4 as const }];
  const html = await safeFetchHtml("https://example.com", {
    lookup,
    fetchImpl: async () =>
      new Response("<html><title>Business</title></html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  });
  assert.equal(html.ok, true);

  const nonHtml = await safeFetchHtml("https://example.com/file.pdf", {
    lookup,
    fetchImpl: async () =>
      new Response("pdf", { headers: { "content-type": "application/pdf" } }),
  });
  assert.deepEqual(nonHtml, { ok: false, code: "NON_HTML" });

  const oversized = await safeFetchHtml("https://example.com/large", {
    lookup,
    fetchImpl: async () =>
      new Response("small", {
        headers: {
          "content-type": "text/html",
          "content-length": String(5 * 1024 * 1024 + 1),
        },
      }),
  });
  assert.deepEqual(oversized, { ok: false, code: "RESPONSE_TOO_LARGE" });
});
