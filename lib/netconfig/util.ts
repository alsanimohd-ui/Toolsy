import type { IpAddress } from "./types";

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isIpv4(s: string): boolean {
  const m = IPV4.exec(s);
  return !!m && m.slice(1).every((o) => Number(o) <= 255);
}

export function ipToInt(ip: string): number {
  const m = IPV4.exec(ip);
  if (!m) return NaN;
  return ((Number(m[1]) << 24) | (Number(m[2]) << 16) | (Number(m[3]) << 8) | Number(m[4])) >>> 0;
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

/** Dotted netmask ("255.255.255.0") or wildcard mask to prefix length; -1 when invalid. */
export function maskToPrefix(mask: string): number {
  if (!isIpv4(mask)) return -1;
  const n = ipToInt(mask);
  const bits = n.toString(2).padStart(32, "0");
  if (!/^1*0*$/.test(bits)) return -1;
  return bits.replace(/0/g, "").length;
}

export function parseCidr(s: string): IpAddress | null {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(s);
  if (!m || !isIpv4(m[1]) || Number(m[2]) > 32) return null;
  return { address: m[1], prefix: Number(m[2]) };
}

export function networkOf(ip: string, prefix: number): string {
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return `${intToIp((ipToInt(ip) & mask) >>> 0)}/${prefix}`;
}

export function ipInPrefix(ip: string, net: IpAddress): boolean {
  if (!isIpv4(ip)) return false;
  return networkOf(ip, net.prefix) === networkOf(net.address, net.prefix);
}

export function fmtIp(ip: IpAddress): string {
  return `${ip.address}/${ip.prefix}`;
}

/** "10,20-22" -> [10,20,21,22]. Ignores junk tokens. */
export function expandVlanList(s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(/[,\s]+/)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (b < a || b - a > 4094) continue;
    for (let v = a; v <= b; v++) out.push(v);
  }
  return out;
}

export function unique<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

export function unquote(s: string): string {
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

/** Splits a line into tokens, keeping "quoted strings" together (quotes removed). */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}
