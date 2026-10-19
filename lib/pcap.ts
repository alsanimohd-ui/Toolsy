/**
 * Packet capture parser. Pure functions, no DOM, no network.
 *
 * Reads classic pcap (both byte orders, µs and ns) and pcapng, decodes
 * Ethernet / VLAN / Linux cooked / loopback / raw IP frames down to
 * IPv4, IPv6, ARP, TCP, UDP, ICMP, ICMPv6 and a few application protocols
 * (DNS, HTTP, TLS ClientHello SNI, DHCP), then groups packets into real
 * 5-tuple streams and extracts hosts and indicators.
 */

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type Transport = "TCP" | "UDP" | "ICMP" | "ICMPv6";
export type L3 = "IPv4" | "IPv6" | "ARP";

export interface DnsRecord {
  name: string;
  type: string;
  data: string;
}

export interface DnsInfo {
  id: number;
  response: boolean;
  rcode: number;
  questions: { name: string; type: string }[];
  answers: DnsRecord[];
}

export interface HttpInfo {
  kind: "request" | "response";
  method?: string;
  path?: string;
  host?: string;
  status?: number;
  reason?: string;
  userAgent?: string;
  contentType?: string;
  server?: string;
}

export interface TlsInfo {
  recordType: string;
  handshake?: string;
  sni?: string;
}

export interface Packet {
  id: number;
  /** Absolute capture time in seconds since the epoch. */
  ts: number;
  /** Original length on the wire. */
  len: number;
  /** Bytes actually captured. */
  caplen: number;
  /** Highest recognised protocol (HTTP, TLS, DNS, TCP, ARP, ...). */
  protocol: string;
  l3?: L3;
  transport?: Transport;
  /** IP address, or MAC address for frames without an IP layer. */
  src: string;
  dst: string;
  srcPort?: number;
  dstPort?: number;
  srcMac?: string;
  dstMac?: string;
  vlan?: number;
  ttl?: number;
  seq?: number;
  ack?: number;
  window?: number;
  flags?: string[];
  info: string;
  /** Whole captured frame. */
  data: Uint8Array;
  /** Application payload above the transport header. */
  payload: Uint8Array;
  dns?: DnsInfo;
  http?: HttpInfo;
  tls?: TlsInfo;
  streamId?: number;
}

export interface Stream {
  id: number;
  protocol: Transport;
  /** Initiator (first sender, or the SYN sender for TCP). */
  a: string;
  aPort?: number;
  b: string;
  bPort?: number;
  /** Most specific application protocol seen (HTTP, TLS, DNS, ...). */
  app: string;
  packetIds: number[];
  packets: number;
  bytes: number;
  aToB: { packets: number; bytes: number };
  bToA: { packets: number; bytes: number };
  start: number;
  end: number;
  duration: number;
  /** TCP only. "partial" means the capture started mid-stream. */
  state?: "open" | "closed" | "reset" | "partial";
  /** Names seen in this stream: DNS queries, HTTP Host, TLS SNI. */
  names: string[];
}

export type IpScope = "public" | "private" | "special";

export interface Host {
  address: string;
  scope: IpScope;
  packetsSent: number;
  packetsReceived: number;
  bytesSent: number;
  bytesReceived: number;
  /** Names learned from DNS answers, TLS SNI and HTTP Host. */
  names: string[];
}

export interface Ioc {
  type: "IP" | "DOMAIN" | "URL";
  value: string;
  count: number;
  scope?: IpScope;
}

export interface CaptureStats {
  totalPackets: number;
  totalBytes: number;
  start: number;
  end: number;
  duration: number;
  protocols: Record<string, number>;
}

export interface Capture {
  format: "pcap" | "pcapng";
  packets: Packet[];
  streams: Stream[];
  hosts: Host[];
  iocs: Ioc[];
  stats: CaptureStats;
  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/*                                Byte helpers                                */
/* -------------------------------------------------------------------------- */

const EMPTY = new Uint8Array(0);

const u16 = (d: Uint8Array, o: number) => (d[o] << 8) | d[o + 1];
const u32 = (d: Uint8Array, o: number) =>
  d[o] * 0x1000000 + ((d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]);

const hex2 = (n: number) => n.toString(16).padStart(2, "0");

function macStr(d: Uint8Array, o: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) parts.push(hex2(d[o + i]));
  return parts.join(":");
}

function ipv4Str(d: Uint8Array, o: number): string {
  return `${d[o]}.${d[o + 1]}.${d[o + 2]}.${d[o + 3]}`;
}

function ipv6Str(d: Uint8Array, o: number): string {
  const g: number[] = [];
  for (let i = 0; i < 8; i++) g.push(u16(d, o + i * 2));
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > bestLen) {
      bestStart = i;
      bestLen = j - i;
    }
    i = j;
  }
  const h = (n: number) => n.toString(16);
  if (bestLen < 2) return g.map(h).join(":");
  const left = g.slice(0, bestStart).map(h).join(":");
  const right = g.slice(bestStart + bestLen).map(h).join(":");
  return `${left}::${right}`;
}

/** Latin-1 string of the first `max` bytes. */
function latin1(d: Uint8Array, max = d.length): string {
  const n = Math.min(d.length, max);
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(d[i]);
  return s;
}

/** Printable text view of bytes: control characters other than CR/LF/TAB become ".". */
export function toPrintable(d: Uint8Array): string {
  let s = "";
  for (let i = 0; i < d.length; i++) {
    const c = d[i];
    s += c === 10 || c === 13 || c === 9 || (c >= 32 && c < 127) ? String.fromCharCode(c) : ".";
  }
  return s;
}

export function ipScope(ip: string): IpScope {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    if (l === "::" || l === "::1" || l.startsWith("ff")) return "special";
    if (l.startsWith("fe8") || l.startsWith("fe9") || l.startsWith("fea") || l.startsWith("feb")) return "private";
    if (l.startsWith("fc") || l.startsWith("fd")) return "private";
    return "public";
  }
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(ip);
  if (!m) return "special";
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return "private";
  if (a === 172 && b >= 16 && b <= 31) return "private";
  if (a === 192 && b === 168) return "private";
  if (a === 169 && b === 254) return "private";
  if (a === 100 && b >= 64 && b <= 127) return "private";
  if (a === 0 || a === 127 || a >= 224) return "special";
  return "public";
}

/* -------------------------------------------------------------------------- */
/*                              Application layers                            */
/* -------------------------------------------------------------------------- */

const DNS_TYPES: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  12: "PTR",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  33: "SRV",
  65: "HTTPS",
  255: "ANY",
};

const dnsTypeName = (t: number) => DNS_TYPES[t] ?? `TYPE${t}`;

function readDnsName(d: Uint8Array, start: number): { name: string; next: number } | null {
  const labels: string[] = [];
  let off = start;
  let next = -1;
  for (let jumps = 0; jumps < 32; ) {
    if (off >= d.length) return null;
    const len = d[off];
    if (len === 0) {
      if (next < 0) next = off + 1;
      return { name: labels.join(".") || ".", next };
    }
    if ((len & 0xc0) === 0xc0) {
      if (off + 1 >= d.length) return null;
      if (next < 0) next = off + 2;
      off = ((len & 0x3f) << 8) | d[off + 1];
      jumps++;
      continue;
    }
    if (len > 63 || off + 1 + len > d.length) return null;
    labels.push(latin1(d.subarray(off + 1, off + 1 + len)));
    off += 1 + len;
  }
  return null;
}

function parseDns(d: Uint8Array): DnsInfo | null {
  if (d.length < 12) return null;
  const flags = u16(d, 2);
  const qd = u16(d, 4);
  const an = u16(d, 6);
  if (qd > 16 || an > 64) return null;
  // Opcode must be a known one; keeps random UDP payloads on port 53 out.
  if (((flags >> 11) & 0xf) > 5) return null;

  const info: DnsInfo = {
    id: u16(d, 0),
    response: (flags & 0x8000) !== 0,
    rcode: flags & 0xf,
    questions: [],
    answers: [],
  };

  let off = 12;
  for (let i = 0; i < qd; i++) {
    const n = readDnsName(d, off);
    if (!n || n.next + 4 > d.length) return null;
    info.questions.push({ name: n.name, type: dnsTypeName(u16(d, n.next)) });
    off = n.next + 4;
  }
  for (let i = 0; i < an; i++) {
    const n = readDnsName(d, off);
    if (!n || n.next + 10 > d.length) break;
    const type = u16(d, n.next);
    const rdlen = u16(d, n.next + 8);
    const rd = n.next + 10;
    if (rd + rdlen > d.length) break;
    let data = "";
    if (type === 1 && rdlen === 4) data = ipv4Str(d, rd);
    else if (type === 28 && rdlen === 16) data = ipv6Str(d, rd);
    else if (type === 5 || type === 2 || type === 12) data = readDnsName(d, rd)?.name ?? "";
    else if (type === 15 && rdlen > 2) data = readDnsName(d, rd + 2)?.name ?? "";
    else if (type === 16 && rdlen > 1) data = latin1(d.subarray(rd + 1, rd + Math.min(rdlen, 1 + d[rd])));
    info.answers.push({ name: n.name, type: dnsTypeName(type), data });
    off = rd + rdlen;
  }
  return info;
}

function dnsSummary(m: DnsInfo): string {
  const q = m.questions[0];
  const id = `0x${m.id.toString(16).padStart(4, "0")}`;
  const qtext = q ? `${q.type} ${q.name}` : "";
  if (!m.response) return `Standard query ${id} ${qtext}`.trim();
  if (m.rcode === 3) return `Standard query response ${id} No such name ${qtext}`.trim();
  if (m.rcode !== 0) return `Standard query response ${id} Error ${m.rcode} ${qtext}`.trim();
  const ans = m.answers.map((a) => (a.data ? `${a.type} ${a.data}` : a.type)).join(", ");
  return `Standard query response ${id} ${qtext}${ans ? ` → ${ans}` : ""}`.trim();
}

const HTTP_REQUEST = /^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|CONNECT|TRACE) (\S+) HTTP\/1\.[01]\r?\n/;
const HTTP_RESPONSE = /^HTTP\/1\.[01] (\d{3})[ ]?([^\r\n]*)\r?\n/;

function parseHttp(payload: Uint8Array): HttpInfo | null {
  if (payload.length < 12) return null;
  const text = latin1(payload, 4096);
  const req = HTTP_REQUEST.exec(text);
  const res = req ? null : HTTP_RESPONSE.exec(text);
  if (!req && !res) return null;

  const info: HttpInfo = req
    ? { kind: "request", method: req[1], path: req[2] }
    : { kind: "response", status: Number(res![1]), reason: res![2].trim() };

  const headerEnd = text.indexOf("\r\n\r\n");
  const head = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
  for (const line of head.split(/\r?\n/).slice(1)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const key = line.slice(0, i).toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === "host") info.host = val;
    else if (key === "user-agent") info.userAgent = val;
    else if (key === "content-type") info.contentType = val;
    else if (key === "server") info.server = val;
  }
  return info;
}

const TLS_RECORD: Record<number, string> = {
  20: "Change Cipher Spec",
  21: "Alert",
  22: "Handshake",
  23: "Application Data",
};

const TLS_HANDSHAKE: Record<number, string> = {
  1: "Client Hello",
  2: "Server Hello",
  4: "New Session Ticket",
  11: "Certificate",
  12: "Server Key Exchange",
  14: "Server Hello Done",
  16: "Client Key Exchange",
  20: "Finished",
};

function parseSni(p: Uint8Array): string | undefined {
  // record(5) + handshake header(4) + version(2) + random(32)
  let o = 5 + 4 + 2 + 32;
  if (o >= p.length) return undefined;
  o += 1 + p[o]; // session id
  if (o + 2 > p.length) return undefined;
  o += 2 + u16(p, o); // cipher suites
  if (o + 1 > p.length) return undefined;
  o += 1 + p[o]; // compression methods
  if (o + 2 > p.length) return undefined;
  const end = Math.min(p.length, o + 2 + u16(p, o));
  o += 2;
  while (o + 4 <= end) {
    const type = u16(p, o);
    const len = u16(p, o + 2);
    o += 4;
    if (o + len > end) return undefined;
    if (type === 0 && len >= 5 && p[o + 2] === 0) {
      const nameLen = u16(p, o + 3);
      if (o + 5 + nameLen > end) return undefined;
      return latin1(p.subarray(o + 5, o + 5 + nameLen));
    }
    o += len;
  }
  return undefined;
}

function parseTls(p: Uint8Array): TlsInfo | null {
  if (p.length < 5) return null;
  if (p[0] < 20 || p[0] > 23 || p[1] !== 3 || p[2] > 4) return null;
  const info: TlsInfo = { recordType: TLS_RECORD[p[0]] };
  if (p[0] === 22 && p.length >= 6) {
    info.handshake = TLS_HANDSHAKE[p[5]] ?? `Handshake (${p[5]})`;
    if (p[5] === 1) {
      try {
        info.sni = parseSni(p);
      } catch {
        // malformed hello: keep what we have
      }
    }
  }
  return info;
}

const DHCP_TYPES: Record<number, string> = {
  1: "Discover",
  2: "Offer",
  3: "Request",
  4: "Decline",
  5: "ACK",
  6: "NAK",
  7: "Release",
  8: "Inform",
};

function parseDhcp(p: Uint8Array): string | null {
  if (p.length < 241 || u32(p, 236) !== 0x63825363) return null;
  const xid = u32(p, 4).toString(16).padStart(8, "0");
  for (let o = 240; o + 1 < p.length; ) {
    const code = p[o];
    if (code === 255) break;
    if (code === 0) {
      o++;
      continue;
    }
    const len = p[o + 1];
    if (code === 53 && len === 1) {
      return `DHCP ${DHCP_TYPES[p[o + 2]] ?? `type ${p[o + 2]}`} - Transaction ID 0x${xid}`;
    }
    o += 2 + len;
  }
  return `DHCP - Transaction ID 0x${xid}`;
}

/* -------------------------------------------------------------------------- */
/*                               Frame decoding                               */
/* -------------------------------------------------------------------------- */

const LINK_NULL = 0;
const LINK_ETHERNET = 1;
const LINK_RAW_NIBBLE = new Set([12, 14, 101]);
const LINK_SLL = 113;
const LINK_SLL2 = 276;
const LINK_IPV4 = 228;
const LINK_IPV6 = 229;

const ETH_IPV4 = 0x0800;
const ETH_ARP = 0x0806;
const ETH_VLAN = 0x8100;
const ETH_QINQ = 0x88a8;
const ETH_IPV6 = 0x86dd;

const ETHERTYPE_NAMES: Record<number, string> = { 0x88cc: "LLDP", 0x8809: "Slow Protocols", 0x8863: "PPPoE", 0x8864: "PPPoE" };

const IP_PROTO_NAMES: Record<number, string> = { 2: "IGMP", 47: "GRE", 50: "ESP", 51: "AH", 89: "OSPF", 132: "SCTP" };

const ICMP_TYPES: Record<number, string> = {
  0: "Echo reply",
  3: "Destination unreachable",
  5: "Redirect",
  8: "Echo request",
  11: "Time exceeded",
};

const ICMP6_TYPES: Record<number, string> = {
  1: "Destination unreachable",
  3: "Time exceeded",
  128: "Echo request",
  129: "Echo reply",
  133: "Router solicitation",
  134: "Router advertisement",
  135: "Neighbor solicitation",
  136: "Neighbor advertisement",
};

const TCP_FLAGS: [number, string][] = [
  [0x02, "SYN"],
  [0x10, "ACK"],
  [0x01, "FIN"],
  [0x04, "RST"],
  [0x08, "PSH"],
  [0x20, "URG"],
  [0x40, "ECE"],
  [0x80, "CWR"],
];

function decodeFrame(id: number, ts: number, data: Uint8Array, len: number, linkType: number): Packet {
  const p: Packet = {
    id,
    ts,
    len,
    caplen: data.length,
    protocol: "Other",
    src: "",
    dst: "",
    info: "",
    data,
    payload: EMPTY,
  };

  let off = 0;
  let etherType = 0;

  if (linkType === LINK_ETHERNET) {
    if (data.length < 14) {
      p.info = "Truncated Ethernet frame";
      return p;
    }
    p.dstMac = macStr(data, 0);
    p.srcMac = macStr(data, 6);
    etherType = u16(data, 12);
    off = 14;
    for (let i = 0; i < 4 && (etherType === ETH_VLAN || etherType === ETH_QINQ) && data.length >= off + 4; i++) {
      p.vlan ??= u16(data, off) & 0x0fff;
      etherType = u16(data, off + 2);
      off += 4;
    }
  } else if (linkType === LINK_NULL) {
    if (data.length < 4) {
      p.info = "Truncated loopback frame";
      return p;
    }
    let fam = (data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24)) >>> 0;
    if (fam > 255) fam = u32(data, 0);
    etherType = fam === 2 ? ETH_IPV4 : fam === 24 || fam === 28 || fam === 30 ? ETH_IPV6 : 0;
    off = 4;
  } else if (linkType === LINK_SLL) {
    if (data.length < 16) {
      p.info = "Truncated Linux cooked frame";
      return p;
    }
    if (u16(data, 4) === 6) p.srcMac = macStr(data, 6);
    etherType = u16(data, 14);
    off = 16;
  } else if (linkType === LINK_SLL2) {
    if (data.length < 20) {
      p.info = "Truncated Linux cooked frame";
      return p;
    }
    if (data[11] === 6) p.srcMac = macStr(data, 12);
    etherType = u16(data, 0);
    off = 20;
  } else if (LINK_RAW_NIBBLE.has(linkType) || linkType === LINK_IPV4 || linkType === LINK_IPV6) {
    const v = linkType === LINK_IPV4 ? 4 : linkType === LINK_IPV6 ? 6 : data[0] >> 4;
    etherType = v === 4 ? ETH_IPV4 : v === 6 ? ETH_IPV6 : 0;
  } else {
    p.info = `Unsupported link type ${linkType}`;
    return p;
  }

  if (etherType === ETH_IPV4) decodeIPv4(p, off);
  else if (etherType === ETH_IPV6) decodeIPv6(p, off);
  else if (etherType === ETH_ARP) decodeArp(p, off);
  else {
    p.protocol = ETHERTYPE_NAMES[etherType] ?? "Other";
    p.info = etherType ? `EtherType 0x${etherType.toString(16).padStart(4, "0")}` : "Unknown frame";
  }

  if (!p.src) p.src = p.srcMac ?? "";
  if (!p.dst) p.dst = p.dstMac ?? "";
  return p;
}

function decodeArp(p: Packet, off: number): void {
  const d = p.data;
  p.l3 = "ARP";
  p.protocol = "ARP";
  if (d.length < off + 28 || d[off + 4] !== 6 || d[off + 5] !== 4) {
    p.info = "ARP (truncated or non-Ethernet/IPv4)";
    return;
  }
  const op = u16(d, off + 6);
  const sha = macStr(d, off + 8);
  const spa = ipv4Str(d, off + 14);
  const tpa = ipv4Str(d, off + 24);
  p.src = spa;
  p.dst = tpa;
  p.srcMac ??= sha;
  if (op === 1) p.info = spa === tpa ? `Gratuitous ARP for ${spa}` : `Who has ${tpa}? Tell ${spa}`;
  else if (op === 2) p.info = `${spa} is at ${sha}`;
  else p.info = `ARP opcode ${op}`;
}

function decodeIPv4(p: Packet, off: number): void {
  const d = p.data;
  p.l3 = "IPv4";
  p.protocol = "IPv4";
  if (d.length < off + 20) {
    p.info = "Truncated IPv4 header";
    return;
  }
  const ihl = (d[off] & 0x0f) * 4;
  if (ihl < 20 || d.length < off + ihl) {
    p.info = "Invalid IPv4 header";
    return;
  }
  const total = u16(d, off + 2);
  // Trim Ethernet padding; keep everything if the length field is bogus.
  const end = total >= ihl && off + total <= d.length ? off + total : d.length;
  const frag = u16(d, off + 6);
  const proto = d[off + 9];
  p.ttl = d[off + 8];
  p.src = ipv4Str(d, off + 12);
  p.dst = ipv4Str(d, off + 16);

  if ((frag & 0x1fff) > 0) {
    p.info = `Fragmented IP (proto ${proto}, offset ${(frag & 0x1fff) * 8})`;
    return;
  }
  decodeTransport(p, proto, off + ihl, end);
}

function decodeIPv6(p: Packet, off: number): void {
  const d = p.data;
  p.l3 = "IPv6";
  p.protocol = "IPv6";
  if (d.length < off + 40) {
    p.info = "Truncated IPv6 header";
    return;
  }
  const payloadLen = u16(d, off + 4);
  let next = d[off + 6];
  p.ttl = d[off + 7];
  p.src = ipv6Str(d, off + 8);
  p.dst = ipv6Str(d, off + 24);
  const end = payloadLen > 0 && off + 40 + payloadLen <= d.length ? off + 40 + payloadLen : d.length;

  let o = off + 40;
  for (let i = 0; i < 8; i++) {
    if (next === 0 || next === 43 || next === 60) {
      if (o + 8 > end) return void (p.info = "Truncated IPv6 extension header");
      const nh = d[o];
      o += (d[o + 1] + 1) * 8;
      next = nh;
    } else if (next === 44) {
      if (o + 8 > end) return void (p.info = "Truncated IPv6 fragment header");
      const fragOff = u16(d, o + 2) >> 3;
      const nh = d[o];
      o += 8;
      if (fragOff > 0) return void (p.info = `Fragmented IPv6 (proto ${nh}, offset ${fragOff * 8})`);
      next = nh;
    } else if (next === 51) {
      if (o + 8 > end) return void (p.info = "Truncated IPv6 AH header");
      const nh = d[o];
      o += (d[o + 1] + 2) * 4;
      next = nh;
    } else break;
  }
  decodeTransport(p, next, o, end);
}

function decodeTransport(p: Packet, proto: number, o: number, end: number): void {
  const d = p.data;
  const avail = Math.min(end, d.length) - o;

  if (proto === 6) {
    p.transport = "TCP";
    p.protocol = "TCP";
    if (avail < 20) return void (p.info = "Truncated TCP header");
    const dataOff = (d[o + 12] >> 4) * 4;
    if (dataOff < 20 || dataOff > avail) return void (p.info = "Invalid TCP header");
    p.srcPort = u16(d, o);
    p.dstPort = u16(d, o + 2);
    p.seq = u32(d, o + 4);
    p.ack = u32(d, o + 8);
    p.window = u16(d, o + 14);
    const fl = d[o + 13];
    p.flags = TCP_FLAGS.filter(([bit]) => fl & bit).map(([, name]) => name);
    p.payload = d.subarray(o + dataOff, o + avail);
    p.info =
      `${p.srcPort} → ${p.dstPort} [${p.flags.join(", ")}] Seq=${p.seq} Ack=${p.ack} Win=${p.window} Len=${p.payload.length}`;
    decodeTcpApp(p);
  } else if (proto === 17) {
    p.transport = "UDP";
    p.protocol = "UDP";
    if (avail < 8) return void (p.info = "Truncated UDP header");
    p.srcPort = u16(d, o);
    p.dstPort = u16(d, o + 2);
    const ulen = u16(d, o + 4);
    const pend = ulen >= 8 && ulen <= avail ? o + ulen : o + avail;
    p.payload = d.subarray(o + 8, pend);
    p.info = `${p.srcPort} → ${p.dstPort} Len=${p.payload.length}`;
    decodeUdpApp(p);
  } else if (proto === 1) {
    p.transport = "ICMP";
    p.protocol = "ICMP";
    if (avail < 4) return void (p.info = "Truncated ICMP header");
    const type = d[o];
    p.info = ICMP_TYPES[type] ?? `Type ${type} code ${d[o + 1]}`;
    if ((type === 0 || type === 8) && avail >= 8) p.info += ` id=0x${u16(d, o + 4).toString(16)} seq=${u16(d, o + 6)}`;
    p.payload = d.subarray(o + 4, o + avail);
  } else if (proto === 58) {
    p.transport = "ICMPv6";
    p.protocol = "ICMPv6";
    if (avail < 4) return void (p.info = "Truncated ICMPv6 header");
    const type = d[o];
    p.info = ICMP6_TYPES[type] ?? `Type ${type} code ${d[o + 1]}`;
    p.payload = d.subarray(o + 4, o + avail);
  } else {
    p.protocol = IP_PROTO_NAMES[proto] ?? `IP/${proto}`;
    p.info = `IP protocol ${proto}`;
  }
}

function decodeTcpApp(p: Packet): void {
  const pl = p.payload;
  if (pl.length === 0) return;

  const tls = parseTls(pl);
  if (tls) {
    p.tls = tls;
    p.protocol = "TLS";
    const detail = tls.handshake ?? tls.recordType;
    p.info = tls.sni ? `${detail} (SNI: ${tls.sni})` : detail;
    return;
  }

  const http = parseHttp(pl);
  if (http) {
    p.http = http;
    p.protocol = "HTTP";
    p.info =
      http.kind === "request"
        ? `${http.method} ${http.path}${http.host ? ` (Host: ${http.host})` : ""}`
        : `HTTP ${http.status} ${http.reason}${http.contentType ? ` (${http.contentType})` : ""}`.trim();
    return;
  }

  if (p.srcPort === 53 || p.dstPort === 53) {
    // DNS over TCP carries a 2-byte length prefix.
    if (pl.length > 2 && u16(pl, 0) === pl.length - 2) {
      const dns = parseDns(pl.subarray(2));
      if (dns) applyDns(p, dns);
    }
  }
}

function decodeUdpApp(p: Packet): void {
  const pl = p.payload;
  if (pl.length === 0) return;
  const ports = [p.srcPort, p.dstPort];

  if (ports.includes(53) || ports.includes(5353) || ports.includes(5355)) {
    const dns = parseDns(pl);
    if (dns) return applyDns(p, dns);
  }
  if ((ports.includes(67) || ports.includes(68)) && !ports.includes(53)) {
    const dhcp = parseDhcp(pl);
    if (dhcp) {
      p.protocol = "DHCP";
      p.info = dhcp;
    }
  }
}

function applyDns(p: Packet, dns: DnsInfo): void {
  p.dns = dns;
  p.protocol = "DNS";
  p.info = dnsSummary(dns);
}

/* -------------------------------------------------------------------------- */
/*                                  File readers                              */
/* -------------------------------------------------------------------------- */

interface RawRecord {
  ts: number;
  len: number;
  data: Uint8Array;
  linkType: number;
}

interface RawFile {
  format: "pcap" | "pcapng";
  records: RawRecord[];
  warnings: string[];
}

function readPcap(buffer: ArrayBuffer, magic: number): RawFile {
  const view = new DataView(buffer);
  const le = magic === 0xa1b2c3d4 || magic === 0xa1b23c4d;
  const nano = magic === 0xa1b23c4d || magic === 0x4d3cb2a1;
  const warnings: string[] = [];
  if (buffer.byteLength < 24) throw new Error("File is too short for a pcap header");

  const linkType = view.getUint32(20, le) & 0x0fffffff;
  const records: RawRecord[] = [];
  let off = 24;
  while (off + 16 <= buffer.byteLength) {
    const sec = view.getUint32(off, le);
    const frac = view.getUint32(off + 4, le);
    const caplen = view.getUint32(off + 8, le);
    const len = view.getUint32(off + 12, le);
    off += 16;
    if (off + caplen > buffer.byteLength) {
      warnings.push(`Capture is truncated: the last packet is incomplete (${records.length.toLocaleString()} packets read).`);
      break;
    }
    records.push({
      ts: sec + frac / (nano ? 1e9 : 1e6),
      len,
      data: new Uint8Array(buffer, off, caplen),
      linkType,
    });
    off += caplen;
  }
  return { format: "pcap", records, warnings };
}

function readPcapng(buffer: ArrayBuffer): RawFile {
  const view = new DataView(buffer);
  const total = buffer.byteLength;
  const warnings: string[] = [];
  const records: RawRecord[] = [];
  let le = true;
  let ifaces: { linkType: number; snaplen: number; div: number }[] = [];
  let off = 0;

  while (off + 12 <= total) {
    const type = view.getUint32(off, le);
    if (type === 0x0a0d0d0a) {
      const bom = view.getUint32(off + 8, true);
      if (bom === 0x1a2b3c4d) le = true;
      else if (bom === 0x4d3c2b1a) le = false;
      else throw new Error("Invalid pcapng section header");
      ifaces = [];
    }
    const blen = view.getUint32(off + 4, le);
    if (blen < 12 || blen % 4 !== 0 || off + blen > total) {
      warnings.push(`Capture is truncated or has a damaged block (${records.length.toLocaleString()} packets read).`);
      break;
    }
    const body = off + 8;
    const bodyEnd = off + blen - 4;

    if (type === 1 && bodyEnd - body >= 8) {
      let div = 1e6;
      for (let o = body + 8; o + 4 <= bodyEnd; ) {
        const code = view.getUint16(o, le);
        const olen = view.getUint16(o + 2, le);
        if (code === 0) break;
        if (code === 9 && olen >= 1 && o + 5 <= bodyEnd) {
          const b = view.getUint8(o + 4);
          div = b & 0x80 ? 2 ** (b & 0x7f) : 10 ** b;
        }
        o += 4 + Math.ceil(olen / 4) * 4;
      }
      ifaces.push({ linkType: view.getUint16(body, le), snaplen: view.getUint32(body + 4, le), div });
    } else if (type === 6 && bodyEnd - body >= 20) {
      const iface = ifaces[view.getUint32(body, le)];
      const caplen = view.getUint32(body + 12, le);
      if (iface && body + 20 + caplen <= bodyEnd) {
        const hi = view.getUint32(body + 4, le);
        const lo = view.getUint32(body + 8, le);
        records.push({
          ts: (hi * 4294967296) / iface.div + lo / iface.div,
          len: view.getUint32(body + 16, le),
          data: new Uint8Array(buffer, body + 20, caplen),
          linkType: iface.linkType,
        });
      }
    } else if (type === 3 && bodyEnd - body >= 4) {
      const iface = ifaces[0];
      const len = view.getUint32(body, le);
      if (iface) {
        const caplen = Math.min(len, bodyEnd - body - 4, iface.snaplen || len);
        records.push({
          ts: records.length ? records[records.length - 1].ts : 0,
          len,
          data: new Uint8Array(buffer, body + 4, caplen),
          linkType: iface.linkType,
        });
      }
    }
    off += blen;
  }
  return { format: "pcapng", records, warnings };
}

function readFile(buffer: ArrayBuffer): RawFile {
  if (buffer.byteLength < 12) throw new Error("File is too short to be a packet capture");
  const bytes = new Uint8Array(buffer, 0, 4);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    throw new Error("This file is gzip-compressed. Decompress it first, then open the .pcap or .pcapng inside.");
  }
  const magic = new DataView(buffer).getUint32(0, true);
  if (magic === 0x0a0d0d0a) return readPcapng(buffer);
  if (magic === 0xa1b2c3d4 || magic === 0xd4c3b2a1 || magic === 0xa1b23c4d || magic === 0x4d3cb2a1) {
    return readPcap(buffer, magic);
  }
  throw new Error(`Not a pcap or pcapng file (magic 0x${magic.toString(16).padStart(8, "0")}).`);
}

/* -------------------------------------------------------------------------- */
/*                              Streams, hosts, IOCs                          */
/* -------------------------------------------------------------------------- */

const APP_RANK: Record<string, number> = { HTTP: 3, TLS: 3, DNS: 3, DHCP: 3 };

function packetNames(p: Packet): string[] {
  const out: string[] = [];
  if (p.dns && !p.dns.response) for (const q of p.dns.questions) out.push(q.name);
  if (p.http?.host) out.push(p.http.host);
  if (p.tls?.sni) out.push(p.tls.sni);
  return out;
}

function buildStreams(packets: Packet[]): Stream[] {
  const map = new Map<string, Stream>();
  const names = new Map<number, Set<string>>();
  const flagsSeen = new Map<number, Set<string>>();

  for (const p of packets) {
    if (!p.transport || (p.l3 !== "IPv4" && p.l3 !== "IPv6")) continue;
    const e1 = `${p.src}|${p.srcPort ?? ""}`;
    const e2 = `${p.dst}|${p.dstPort ?? ""}`;
    const key = `${p.transport}|${e1 < e2 ? e1 : e2}|${e1 < e2 ? e2 : e1}`;

    let s = map.get(key);
    if (!s) {
      // A SYN-ACK as the first packet means we joined mid-handshake: flip.
      const flip = p.flags?.includes("SYN") && p.flags.includes("ACK");
      s = {
        id: map.size,
        protocol: p.transport,
        a: flip ? p.dst : p.src,
        aPort: flip ? p.dstPort : p.srcPort,
        b: flip ? p.src : p.dst,
        bPort: flip ? p.srcPort : p.dstPort,
        app: p.transport,
        packetIds: [],
        packets: 0,
        bytes: 0,
        aToB: { packets: 0, bytes: 0 },
        bToA: { packets: 0, bytes: 0 },
        start: p.ts,
        end: p.ts,
        duration: 0,
        names: [],
      };
      map.set(key, s);
      names.set(s.id, new Set());
      flagsSeen.set(s.id, new Set());
    }

    p.streamId = s.id;
    s.packetIds.push(p.id);
    s.packets++;
    s.bytes += p.len;
    s.end = p.ts;
    s.duration = s.end - s.start;
    const forward = p.src === s.a && p.srcPort === s.aPort;
    const dir = forward ? s.aToB : s.bToA;
    dir.packets++;
    dir.bytes += p.len;

    if ((APP_RANK[p.protocol] ?? 0) > (APP_RANK[s.app] ?? 0)) s.app = p.protocol;
    for (const n of packetNames(p)) names.get(s.id)!.add(n);
    p.flags?.forEach((f) => flagsSeen.get(s!.id)!.add(f));
    if (p.flags?.includes("SYN") && !p.flags.includes("ACK") && !forward) {
      // Initiator was seen second (reordered or mid-capture); trust the SYN.
      [s.a, s.b] = [s.b, s.a];
      [s.aPort, s.bPort] = [s.bPort, s.aPort];
      const t = s.aToB;
      s.aToB = s.bToA;
      s.bToA = t;
    }
  }

  const streams = Array.from(map.values());
  for (const s of streams) {
    s.names = Array.from(names.get(s.id)!);
    if (s.protocol === "TCP") {
      const f = flagsSeen.get(s.id)!;
      s.state = f.has("RST") ? "reset" : f.has("FIN") ? "closed" : f.has("SYN") ? "open" : "partial";
    }
  }
  return streams;
}

function buildHosts(packets: Packet[]): Host[] {
  const map = new Map<string, Host>();
  const get = (address: string): Host => {
    let h = map.get(address);
    if (!h) {
      h = { address, scope: ipScope(address), packetsSent: 0, packetsReceived: 0, bytesSent: 0, bytesReceived: 0, names: [] };
      map.set(address, h);
    }
    return h;
  };
  const names = new Map<string, Set<string>>();
  const addName = (ip: string, name: string) => {
    let s = names.get(ip);
    if (!s) names.set(ip, (s = new Set()));
    s.add(name);
  };

  for (const p of packets) {
    if (!p.l3) continue;
    const s = get(p.src);
    s.packetsSent++;
    s.bytesSent += p.len;
    const d = get(p.dst);
    d.packetsReceived++;
    d.bytesReceived += p.len;

    if (p.dns?.response) {
      for (const a of p.dns.answers) if ((a.type === "A" || a.type === "AAAA") && a.data) addName(a.data, a.name);
    }
    if (p.http?.host && p.http.kind === "request") addName(p.dst, p.http.host);
    if (p.tls?.sni) addName(p.dst, p.tls.sni);
  }
  for (const h of Array.from(map.values())) h.names = Array.from(names.get(h.address) ?? []);
  return Array.from(map.values()).sort(
    (a, b) => b.packetsSent + b.packetsReceived - (a.packetsSent + a.packetsReceived),
  );
}

function buildIocs(packets: Packet[]): Ioc[] {
  const map = new Map<string, Ioc>();
  const bump = (type: Ioc["type"], value: string, scope?: IpScope) => {
    const key = `${type}|${value}`;
    const e = map.get(key);
    if (e) e.count++;
    else map.set(key, { type, value, count: 1, scope });
  };

  for (const p of packets) {
    if (p.l3 === "IPv4" || p.l3 === "IPv6") {
      bump("IP", p.src, ipScope(p.src));
      if (p.dst !== p.src) bump("IP", p.dst, ipScope(p.dst));
    }
    const seen = new Set<string>();
    if (p.dns) {
      for (const q of p.dns.questions) seen.add(q.name.toLowerCase());
      for (const a of p.dns.answers) if (a.type === "CNAME" && a.data) seen.add(a.data.toLowerCase());
    }
    if (p.tls?.sni) seen.add(p.tls.sni.toLowerCase());
    if (p.http?.host) seen.add(p.http.host.toLowerCase().replace(/:\d+$/, ""));
    for (const n of Array.from(seen)) bump("DOMAIN", n);
    if (p.http?.kind === "request" && p.http.path) bump("URL", `http://${p.http.host ?? p.dst}${p.http.path}`);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/* -------------------------------------------------------------------------- */
/*                                  Public API                                */
/* -------------------------------------------------------------------------- */

export function parseCapture(buffer: ArrayBuffer): Capture {
  const raw = readFile(buffer);
  const warnings = [...raw.warnings];
  const unsupported = new Set<number>();

  const packets = raw.records.map((r, i) => {
    const p = decodeFrame(i + 1, r.ts, r.data, r.len, r.linkType);
    if (p.info.startsWith("Unsupported link type")) unsupported.add(r.linkType);
    return p;
  });
  for (const lt of Array.from(unsupported)) warnings.push(`Link type ${lt} is not supported; those packets are listed but not decoded.`);
  if (packets.length === 0) warnings.push("No packets found in this file.");

  const protocols: Record<string, number> = {};
  let totalBytes = 0;
  for (const p of packets) {
    protocols[p.protocol] = (protocols[p.protocol] ?? 0) + 1;
    totalBytes += p.len;
  }
  const start = packets.length ? Math.min(...packets.map((p) => p.ts)) : 0;
  const end = packets.length ? Math.max(...packets.map((p) => p.ts)) : 0;

  return {
    format: raw.format,
    packets,
    streams: buildStreams(packets),
    hosts: buildHosts(packets),
    iocs: buildIocs(packets),
    stats: { totalPackets: packets.length, totalBytes, start, end, duration: end - start, protocols },
    warnings,
  };
}

export interface StreamSegment {
  /** "a→b" is initiator to responder. */
  dir: "a→b" | "b→a";
  ts: number;
  data: Uint8Array;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/**
 * Rebuild the application data of one stream in capture order.
 * TCP retransmissions and overlaps are dropped; consecutive data in the same
 * direction is merged into one segment.
 */
export function followStream(capture: Capture, streamId: number): StreamSegment[] {
  const stream = capture.streams[streamId];
  if (!stream) return [];

  const next: Record<"a→b" | "b→a", number | undefined> = { "a→b": undefined, "b→a": undefined };
  const segments: { dir: StreamSegment["dir"]; ts: number; parts: Uint8Array[] }[] = [];

  for (const id of stream.packetIds) {
    const p = capture.packets[id - 1];
    if (!p || p.payload.length === 0) continue;
    const dir = p.src === stream.a && p.srcPort === stream.aPort ? "a→b" : "b→a";
    let chunk = p.payload;

    if (stream.protocol === "TCP" && p.seq !== undefined) {
      const expected = next[dir];
      if (expected !== undefined) {
        const diff = (p.seq - expected) | 0; // signed 32-bit, survives wraparound
        if (diff < 0) {
          if (-diff >= chunk.length) continue;
          chunk = chunk.subarray(-diff);
        }
      }
      next[dir] = (p.seq + p.payload.length) >>> 0;
    }

    const last = segments[segments.length - 1];
    if (last && last.dir === dir) last.parts.push(chunk);
    else segments.push({ dir, ts: p.ts, parts: [chunk] });
  }
  return segments.map((s) => ({ dir: s.dir, ts: s.ts, data: concatBytes(s.parts) }));
}

/* -------------------------------------------------------------------------- */
/*                                   Filtering                                */
/* -------------------------------------------------------------------------- */

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/** Exact address, a "10.1." style prefix, or an IPv4 CIDR block. */
function addressMatches(addr: string, want: string): boolean {
  if (!addr) return false;
  const a = addr.toLowerCase();
  if (a === want) return true;
  const slash = want.indexOf("/");
  if (slash > 0) {
    const base = ipv4ToInt(want.slice(0, slash));
    const bits = Number(want.slice(slash + 1));
    const value = ipv4ToInt(addr);
    if (base === null || value === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((base & mask) >>> 0) === ((value & mask) >>> 0);
  }
  if (want.endsWith(".") || want.endsWith(":")) return a.startsWith(want);
  return false;
}

function packetNamesAll(p: Packet): string[] {
  const out = packetNames(p);
  if (p.dns?.response) for (const a of p.dns.answers) out.push(a.name, a.data);
  return out.map((n) => n.toLowerCase());
}

function numberCompare(spec: string): ((n: number) => boolean) | null {
  const m = /^(>=|<=|>|<|=)?(\d+)$/.exec(spec);
  if (!m) return null;
  const v = Number(m[2]);
  switch (m[1]) {
    case ">=": return (n) => n >= v;
    case "<=": return (n) => n <= v;
    case ">": return (n) => n > v;
    case "<": return (n) => n < v;
    default: return (n) => n === v;
  }
}

const FILTER_KEYS = new Set(["ip", "src", "dst", "port", "sport", "dport", "proto", "flag", "len", "host", "stream", "data", "mac"]);

type Predicate = (p: Packet) => boolean;

function keyedPredicate(key: string, raw: string): Predicate {
  const val = raw.toLowerCase();
  const num = Number(val);
  switch (key) {
    case "ip": return (p) => p.l3 !== undefined && (addressMatches(p.src, val) || addressMatches(p.dst, val));
    case "src": return (p) => addressMatches(p.src, val);
    case "dst": return (p) => addressMatches(p.dst, val);
    case "port": return (p) => p.srcPort === num || p.dstPort === num;
    case "sport": return (p) => p.srcPort === num;
    case "dport": return (p) => p.dstPort === num;
    case "proto": return (p) => p.protocol.toLowerCase() === val || p.transport?.toLowerCase() === val || p.l3?.toLowerCase() === val;
    case "flag": return (p) => p.flags?.some((f) => f.toLowerCase() === val) ?? false;
    case "len": {
      const cmp = numberCompare(val);
      return cmp ? (p) => cmp(p.len) : () => false;
    }
    case "host": return (p) => packetNamesAll(p).some((n) => n.includes(val));
    case "stream": return (p) => p.streamId === num;
    case "mac": return (p) => p.srcMac === val || p.dstMac === val;
    case "data": return (p) => p.payload.length > 0 && latin1(p.payload).toLowerCase().includes(val);
    default: return () => false;
  }
}

function bareTerm(term: string): Predicate {
  const t = term.toLowerCase();
  const num = /^\d+$/.test(t) ? Number(t) : null;
  // "syn", "ack", ... mean the TCP flag, not the "Ack=" text in Info.
  if (TCP_FLAGS.some(([, name]) => name.toLowerCase() === t)) {
    return (p) => p.flags?.some((f) => f.toLowerCase() === t) ?? false;
  }
  return (p) =>
    p.protocol.toLowerCase() === t ||
    p.transport?.toLowerCase() === t ||
    (p.flags?.some((f) => f.toLowerCase() === t) ?? false) ||
    addressMatches(p.src, t) ||
    addressMatches(p.dst, t) ||
    (num !== null && (p.srcPort === num || p.dstPort === num)) ||
    p.info.toLowerCase().includes(t) ||
    packetNamesAll(p).some((n) => n.includes(t));
}

/**
 * Compile a filter query into a predicate. All terms must match (AND).
 *
 *   ip:10.0.0.0/8  src:1.2.3.4  dst:10.1.   port:443  sport:  dport:
 *   proto:dns  flag:syn  len:>1000  host:example.com  stream:3  mac:aa:bb:..
 *   data:"password"   (search inside payloads)
 *   !term or -term negates. Bare words match protocol, flags, address,
 *   port, host names and the Info column.
 */
export function compileFilter(query: string): Predicate {
  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const preds: Predicate[] = [];

  for (let token of tokens) {
    let negate = false;
    if ((token.startsWith("!") || token.startsWith("-")) && token.length > 1) {
      negate = true;
      token = token.slice(1);
    }
    token = token.replace(/"/g, "");
    if (!token) continue;

    const colon = token.indexOf(":");
    const key = colon > 0 ? token.slice(0, colon).toLowerCase() : "";
    let pred: Predicate;
    if (key && FILTER_KEYS.has(key)) {
      const val = token.slice(colon + 1);
      pred = val ? keyedPredicate(key, val) : () => true;
    } else {
      pred = bareTerm(token);
    }
    preds.push(negate ? (p) => !pred(p) : pred);
  }
  return (p) => preds.every((f) => f(p));
}

/* -------------------------------------------------------------------------- */
/*                               Packet details                               */
/* -------------------------------------------------------------------------- */

export interface PacketLayer {
  name: string;
  fields: { name: string; value: string | number }[];
}

/** Layer-by-layer breakdown of one packet for a detail view. */
export function describePacket(p: Packet): PacketLayer[] {
  const layers: PacketLayer[] = [
    { name: "Frame", fields: [{ name: "Number", value: p.id }, { name: "Captured / on wire", value: `${p.caplen} / ${p.len} bytes` }] },
  ];
  if (p.srcMac || p.dstMac) {
    const fields: PacketLayer["fields"] = [];
    if (p.srcMac) fields.push({ name: "Source", value: p.srcMac });
    if (p.dstMac) fields.push({ name: "Destination", value: p.dstMac });
    if (p.vlan !== undefined) fields.push({ name: "VLAN", value: p.vlan });
    layers.push({ name: "Link", fields });
  }
  if (p.l3 === "IPv4" || p.l3 === "IPv6") {
    layers.push({
      name: p.l3,
      fields: [
        { name: "Source", value: p.src },
        { name: "Destination", value: p.dst },
        ...(p.ttl !== undefined ? [{ name: p.l3 === "IPv4" ? "TTL" : "Hop limit", value: p.ttl }] : []),
      ],
    });
  } else if (p.l3 === "ARP") {
    layers.push({ name: "ARP", fields: [{ name: "Summary", value: p.info }] });
  }
  if (p.transport === "TCP") {
    layers.push({
      name: "TCP",
      fields: [
        { name: "Source port", value: p.srcPort ?? 0 },
        { name: "Destination port", value: p.dstPort ?? 0 },
        { name: "Sequence", value: p.seq ?? 0 },
        { name: "Acknowledgment", value: p.ack ?? 0 },
        { name: "Flags", value: p.flags?.join(", ") || "none" },
        { name: "Window", value: p.window ?? 0 },
        { name: "Payload", value: `${p.payload.length} bytes` },
      ],
    });
  } else if (p.transport === "UDP") {
    layers.push({
      name: "UDP",
      fields: [
        { name: "Source port", value: p.srcPort ?? 0 },
        { name: "Destination port", value: p.dstPort ?? 0 },
        { name: "Payload", value: `${p.payload.length} bytes` },
      ],
    });
  } else if (p.transport) {
    layers.push({ name: p.transport, fields: [{ name: "Summary", value: p.info }] });
  }
  if (p.dns) {
    layers.push({
      name: "DNS",
      fields: [
        { name: "Transaction ID", value: `0x${p.dns.id.toString(16).padStart(4, "0")}` },
        { name: "Type", value: p.dns.response ? "Response" : "Query" },
        ...p.dns.questions.map((q) => ({ name: "Question", value: `${q.name} (${q.type})` })),
        ...p.dns.answers.map((a) => ({ name: "Answer", value: `${a.name} ${a.type} ${a.data}`.trim() })),
      ],
    });
  }
  if (p.http) {
    const h = p.http;
    const fields: PacketLayer["fields"] =
      h.kind === "request"
        ? [{ name: "Method", value: h.method ?? "" }, { name: "Path", value: h.path ?? "" }]
        : [{ name: "Status", value: `${h.status} ${h.reason ?? ""}`.trim() }];
    if (h.host) fields.push({ name: "Host", value: h.host });
    if (h.userAgent) fields.push({ name: "User-Agent", value: h.userAgent });
    if (h.contentType) fields.push({ name: "Content-Type", value: h.contentType });
    if (h.server) fields.push({ name: "Server", value: h.server });
    layers.push({ name: "HTTP", fields });
  }
  if (p.tls) {
    const fields: PacketLayer["fields"] = [{ name: "Record", value: p.tls.recordType }];
    if (p.tls.handshake) fields.push({ name: "Handshake", value: p.tls.handshake });
    if (p.tls.sni) fields.push({ name: "Server name (SNI)", value: p.tls.sni });
    layers.push({ name: "TLS", fields });
  }
  if (p.protocol === "DHCP") layers.push({ name: "DHCP", fields: [{ name: "Summary", value: p.info }] });
  return layers;
}
