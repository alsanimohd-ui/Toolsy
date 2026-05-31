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
];

const PRIVATE_HOSTNAMES = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "127.0.1.1"];

export function ipToNum(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

export function isPrivateIP(ip: string): boolean {
  if (ip.includes(":")) return false;
  const ipNum = ipToNum(ip);
  return PRIVATE_RANGES.some((range) => ipNum >= range.start && ipNum <= range.end);
}

export function isPrivateHostname(host: string): boolean {
  return PRIVATE_HOSTNAMES.includes(host.toLowerCase());
}

export function isIPv4Literal(host: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
}

export { PRIVATE_RANGES, PRIVATE_HOSTNAMES };
