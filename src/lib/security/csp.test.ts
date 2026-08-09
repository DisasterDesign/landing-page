import assert from "node:assert/strict";
import test from "node:test";

import { CSP_DIRECTIVES, buildCsp } from "./csp";

function directive(name: string): string[] {
  const line = CSP_DIRECTIVES.find((d) => d.startsWith(`${name} `));
  assert.ok(line, `missing ${name} directive`);
  return line.split(/\s+/).slice(1);
}

/**
 * The CSP silently killed analytics for months: the gtag script tag rendered
 * into the HTML, so every check that grepped the page for the measurement ID
 * passed, while the browser refused to execute it. These tests assert the
 * origins each vendor actually needs, so the next person who tightens the
 * policy breaks a test instead of the data.
 */

test("gtag.js can load — the failure that made GA4 collect nothing", () => {
  assert.ok(directive("script-src").includes("https://www.googletagmanager.com"));
});

test("GA4 can post its payload back", () => {
  const connect = directive("connect-src");
  assert.ok(connect.includes("https://*.google-analytics.com"));
  assert.ok(connect.includes("https://*.analytics.google.com"));
  assert.ok(connect.includes("https://www.googletagmanager.com"));
});

test("Google Ads conversion tracking can load and report", () => {
  const script = directive("script-src");
  const connect = directive("connect-src");
  for (const origin of [
    "https://www.googleadservices.com",
    "https://googleads.g.doubleclick.net",
  ]) {
    assert.ok(script.includes(origin), `script-src missing ${origin}`);
    assert.ok(connect.includes(origin), `connect-src missing ${origin}`);
  }
});

test("the Google Maps embed on /contact still has its frame origin", () => {
  assert.ok(directive("frame-src").includes("https://www.google.com"));
});

test("Vercel analytics and the audio CDN keep working", () => {
  assert.ok(directive("script-src").includes("https://va.vercel-scripts.com"));
  assert.ok(directive("connect-src").includes("https://vitals.vercel-insights.com"));
  assert.ok(directive("media-src").includes("https://auxio.b-cdn.net"));
});

test("the policy stays locked down where it matters", () => {
  assert.deepEqual(directive("default-src"), ["'self'"]);
  assert.deepEqual(directive("object-src"), ["'none'"]);
  assert.deepEqual(directive("base-uri"), ["'self'"]);
});

test("no directive opens itself to the whole web", () => {
  for (const line of CSP_DIRECTIVES) {
    const [name, ...values] = line.split(/\s+/);
    // img-src is deliberately https: — client logos and OG images come from
    // arbitrary hosts. Everything else must name its origins.
    if (name === "img-src") continue;
    assert.ok(!values.includes("*"), `${name} allows *`);
    assert.ok(!values.includes("https:"), `${name} allows all of https:`);
  }
});

test("buildCsp joins directives the way a header expects", () => {
  const header = buildCsp();
  assert.ok(header.includes("; "));
  assert.ok(!header.endsWith(";"));
  assert.equal(header.split("; ").length, CSP_DIRECTIVES.length);
});
