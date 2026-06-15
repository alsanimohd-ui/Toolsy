/* ────────────────────────────────────────────────────────────
   SSRF Protection — Private / Reserved IP Ranges
   Shared between the API route and unit tests.
   ──────────────────────────────────────────────────────────── */

const PRIVATE_RANGES: { start: number; end: number }[] = [
  { start: ipToNum("10.0.0.0"), end: ipToNum("10.255.255.255") },
  { start: ipToNum("172.16.0.0"), end: ipToNum("172.31.255.255") },
  { start: ipToNum("192.168.0.0"), end: ipToNum("192.168.255.255") },
  { start: ipToNum("127.0.0.0"), end: ipToNum("127.255.255.255") },
  { start: ipToNum("169.254.0.0"), end: ipToNum("169.254.255.255") },
  { start: ipToNum("0.0.0.0"), end: ipToNum("0.255.255.255") },
  { start: ipToNum("100.64.0.0"), end: ipToNum("100.127.255.255") },
  { start: ipToNum("192.0.0.0"), end: ipToNum("192.0.0.255") },
  { start: ipToNum("192.0.2.0"), end: ipToNum("192.0.2.255") },
  { start: ipToNum("198.51.100.0"), end: ipToNum("198.51.100.255") },
  { start: ipToNum("203.0.113.0"), end: ipToNum("203.0.113.255") },
  { start: ipToNum("198.18.0.0"), end: ipToNum("198.19.255.255") },
  { start: ipToNum("224.0.0.0"), end: ipToNum("239.255.255.255") },
  { start: ipToNum("240.0.0.0"), end: ipToNum("255.255.255.255") },
];

const PRIVATE_HOSTNAMES = [
  "localhost",
  "localhost.localdomain",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "127.0.1.1",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata.azure.internal",
];

export function ipToNum(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

export function isPrivateIPv6(addr: string): boolean {
  const normalized = addr.replace(/^\[|\]$/g, "").toLowerCase();

  if (normalized === "::1") return true;
  if (normalized === "::") return true;
  if (normalized.startsWith("fe80")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("ff")) return true;

  const v4Mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) {
    return isPrivateIPv4(v4Mapped[1]);
  }

  return false;
}

function isPrivateIPv4(ip: string): boolean {
  if (ip.includes(":")) return false;
  const ipNum = ipToNum(ip);
  return PRIVATE_RANGES.some((range) => ipNum >= range.start && ipNum <= range.end);
}

export function isPrivateIP(ip: string): boolean {
  if (ip.includes(":")) return isPrivateIPv6(ip);
  const ipNum = ipToNum(ip);
  return PRIVATE_RANGES.some((range) => ipNum >= range.start && ipNum <= range.end);
}

export function isPrivateHostname(host: string): boolean {
  return PRIVATE_HOSTNAMES.includes(host.toLowerCase());
}

export function isIPv4Literal(host: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
}

export function normalizeHost(host: string): string {
  return host.toLowerCase().trim().replace(/^\[|\]$/g, "");
}

export { PRIVATE_RANGES, PRIVATE_HOSTNAMES };
