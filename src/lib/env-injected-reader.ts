/**
 * Reads env vars from the build-time generated JSON file.
 *
 * Workaround for Vercel bug: env vars added after project creation are not
 * injected into serverless function runtime. The prebuild script writes
 * env-injected.json, and next.config.ts copies it to the output directory
 * via the `outputFileTracingIncludes` option.
 *
 * Uses require() which embeds the JSON directly into the server bundle
 * at compile time — no filesystem access needed at runtime.
 */

let _cache: Record<string, string> | null = null;

export function getInjectedEnv(): Record<string, string> {
  if (_cache) return _cache;
  try {
    // require() is resolved at compile time by the bundler.
    // The JSON content gets inlined into the bundle.
    _cache = require("../../env-injected.json");
  } catch {
    _cache = {};
  }
  return _cache!;
}
