import { promises as dns } from "dns";

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

export interface SSRFValidationResult {
  allowed: boolean;
  reason?: string;
  resolvedIps?: string[];
}

export interface SSRFOptions {
  allowedProtocols?: string[];
}

/**
 * Validates a target host, IP literal, or URL for SSRF risks.
 * Hides URL/protocol checking, private/loopback range matching,
 * and dual-stack (IPv4 & IPv6) DNS resolution.
 */
export async function validateTarget(
  target: string,
  options?: SSRFOptions
): Promise<SSRFValidationResult> {
  let isUrl = false;
  let host = target;

  if (target.includes("://") || /^[a-zA-Z0-9.+-]+:/.test(target)) {
    isUrl = true;
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return { allowed: false, reason: "Invalid URL format" };
    }

    const { protocol, hostname } = parsed;

    if (options?.allowedProtocols) {
      if (!options.allowedProtocols.includes(protocol)) {
        return {
          allowed: false,
          reason: `Protocol "${protocol}" is not allowed. Only ${options.allowedProtocols
            .map((p) => p.toUpperCase().replace(":", ""))
            .join("/")} are permitted.`,
        };
      }
    }

    host = hostname;
  }

  const normalized = normalizeHost(host);

  const isLocalMessage = isUrl
    ? "Requests to local/loopback addresses are not allowed"
    : "Scanning local/loopback addresses is not allowed";

  const isPrivateV4Message = isUrl
    ? "Requests to private IP ranges are not allowed"
    : "Scanning private/reserved IP ranges is not allowed";

  const isPrivateV6Message = isUrl
    ? "Requests to private/reserved IPv6 ranges are not allowed"
    : "Scanning private/reserved IPv6 ranges is not allowed";

  const isResolvesPrivateMessage = (ip: string) =>
    isUrl
      ? `Target resolves to a private IP (${ip})`
      : "Target host resolves to a private/reserved address";

  if (isPrivateHostname(normalized)) {
    return { allowed: false, reason: isLocalMessage };
  }

  if (isIPv4Literal(normalized) && isPrivateIP(normalized)) {
    return { allowed: false, reason: isPrivateV4Message };
  }

  if (normalized.includes(":") && isPrivateIPv6(normalized)) {
    return { allowed: false, reason: isPrivateV6Message };
  }

  const resolvedIps: string[] = [];

  try {
    const v4Addresses = await dns.resolve4(normalized);
    for (const addr of v4Addresses) {
      resolvedIps.push(addr);
      if (isPrivateIP(addr)) {
        return { allowed: false, reason: isResolvesPrivateMessage(addr), resolvedIps };
      }
    }
  } catch {
    // DNS resolution failed
  }

  try {
    const v6Addresses = await dns.resolve6(normalized);
    for (const addr of v6Addresses) {
      resolvedIps.push(addr);
      if (isPrivateIPv6(addr)) {
        return { allowed: false, reason: isResolvesPrivateMessage(addr), resolvedIps };
      }
    }
  } catch {
    // DNS resolution failed
  }

  return { allowed: true, resolvedIps };
}

export { PRIVATE_RANGES, PRIVATE_HOSTNAMES };
