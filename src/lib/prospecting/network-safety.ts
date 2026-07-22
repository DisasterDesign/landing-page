import { BlockList, isIP } from "node:net";

const blockedIpv4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedIpv4.addSubnet(network, prefix, "ipv4");
}

const blockedIpv6 = new BlockList();
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const) {
  blockedIpv6.addSubnet(network, prefix, "ipv6");
}

const FORBIDDEN_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.aws.internal",
]);

function mappedIpv4(address: string): string | null {
  const match = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  return match?.[1] ?? null;
}

export function isPublicIp(address: string): boolean {
  const normalized = address.trim().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = mappedIpv4(normalized);
  if (mapped) return isPublicIp(mapped);

  const family = isIP(normalized);
  if (family === 4) return !blockedIpv4.check(normalized, "ipv4");
  if (family === 6) return !blockedIpv6.check(normalized, "ipv6");
  return false;
}

export function isForbiddenHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized) return true;
  if (FORBIDDEN_HOSTS.has(normalized)) return true;
  if (
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }
  return false;
}
