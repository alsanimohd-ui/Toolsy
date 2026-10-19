import { describe, it, expect } from "vitest";
import { parseCapture, followStream, compileFilter, ipScope, toPrintable } from "@/lib/pcap";

/* ------------------------------ frame builders ----------------------------- */

const be16 = (n: number) => [(n >> 8) & 255, n & 255];
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const mac = (s: string) => s.split(":").map((h) => parseInt(h, 16));
const ip4 = (s: string) => s.split(".").map(Number);
const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));

const MAC_A = "aa:aa:aa:aa:aa:01";
const MAC_B = "bb:bb:bb:bb:bb:02";

const eth = (type: number, payload: number[], dst = MAC_B, src = MAC_A) => [...mac(dst), ...mac(src), ...be16(type), ...payload];

const ipv4 = (proto: number, src: string, dst: string, payload: number[]) => [
  0x45, 0, ...be16(20 + payload.length), 0, 1, 0x40, 0, 64, proto, 0, 0, ...ip4(src), ...ip4(dst), ...payload,
];

const tcp = (sp: number, dp: number, flags: number, seq: number, ack: number, payload: number[] = []) => [
  ...be16(sp), ...be16(dp), ...be32(seq), ...be32(ack), 0x50, flags, ...be16(64240), 0, 0, 0, 0, ...payload,
];

const udp = (sp: number, dp: number, payload: number[]) => [...be16(sp), ...be16(dp), ...be16(8 + payload.length), 0, 0, ...payload];

const SYN = 0x02;
const ACK = 0x10;
const PSH = 0x08;

const tcp4 = (src: string, dst: string, sp: number, dp: number, flags: number, seq: number, ack: number, payload: number[] = []) =>
  eth(0x0800, ipv4(6, src, dst, tcp(sp, dp, flags, seq, ack, payload)));

const udp4 = (src: string, dst: string, sp: number, dp: number, payload: number[]) =>
  eth(0x0800, ipv4(17, src, dst, udp(sp, dp, payload)));

const dnsName = (name: string) => [...name.split(".").flatMap((l) => [l.length, ...ascii(l)]), 0];

const dnsQuery = (name: string, id = 0x1234, type = 1) => [
  ...be16(id), 0x01, 0x00, ...be16(1), ...be16(0), ...be16(0), ...be16(0), ...dnsName(name), ...be16(type), ...be16(1),
];

/** Response with one question and an A answer using a compression pointer to the question name. */
const dnsResponseA = (name: string, ip: string, id = 0x1234) => [
  ...be16(id), 0x81, 0x80, ...be16(1), ...be16(1), ...be16(0), ...be16(0),
  ...dnsName(name), ...be16(1), ...be16(1),
  0xc0, 0x0c, ...be16(1), ...be16(1), ...be32(60), ...be16(4), ...ip4(ip),
];

const tlsClientHello = (host: string) => {
  const h = ascii(host);
  const ext = [0, 0, ...be16(h.length + 5), ...be16(h.length + 3), 0, ...be16(h.length), ...h];
  const body = [3, 3, ...new Array(32).fill(0), 0, ...be16(2), 0x13, 0x01, 1, 0, ...be16(ext.length), ...ext];
  const hs = [1, 0, ...be16(body.length), ...body];
  return [0x16, 3, 1, ...be16(hs.length), ...hs];
};

/* ------------------------------ file builders ------------------------------ */

interface Frame {
  ts: number;
  data: number[];
}

function pcapFile(frames: Frame[], opts: { le?: boolean; linkType?: number; nano?: boolean } = {}): ArrayBuffer {
  const { le = true, linkType = 1, nano = false } = opts;
  const w32 = (n: number) => (le ? [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255] : be32(n));
  const w16 = (n: number) => (le ? [n & 255, (n >>> 8) & 255] : be16(n));
  const bytes = [
    ...w32(nano ? 0xa1b23c4d : 0xa1b2c3d4), ...w16(2), ...w16(4), ...w32(0), ...w32(0), ...w32(65535), ...w32(linkType),
  ];
  for (const f of frames) {
    const sec = Math.floor(f.ts);
    const frac = Math.round((f.ts - sec) * (nano ? 1e9 : 1e6));
    bytes.push(...w32(sec), ...w32(frac), ...w32(f.data.length), ...w32(f.data.length), ...f.data);
  }
  return Uint8Array.from(bytes).buffer;
}

function pcapngFile(frames: Frame[], opts: { linkType?: number; tsresol?: number } = {}): ArrayBuffer {
  const { linkType = 1, tsresol } = opts;
  const w32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const w16 = (n: number) => [n & 255, (n >>> 8) & 255];
  const pad = (b: number[]) => [...b, ...new Array((4 - (b.length % 4)) % 4).fill(0)];
  const block = (type: number, body: number[]) => {
    const p = pad(body);
    return [...w32(type), ...w32(12 + p.length), ...p, ...w32(12 + p.length)];
  };
  const shb = block(0x0a0d0d0a, [...w32(0x1a2b3c4d), ...w16(1), ...w16(0), ...new Array(8).fill(0xff)]);
  const idbOpts = tsresol === undefined ? [] : [...w16(9), ...w16(1), tsresol, 0, 0, 0, ...w16(0), ...w16(0)];
  const idb = block(1, [...w16(linkType), ...w16(0), ...w32(65535), ...idbOpts]);
  const div = tsresol === undefined ? 1e6 : tsresol & 0x80 ? 2 ** (tsresol & 0x7f) : 10 ** tsresol;
  const epbs = frames.flatMap((f) => {
    const ticks = Math.round(f.ts * div);
    const hi = Math.floor(ticks / 4294967296);
    const lo = ticks % 4294967296;
    return block(6, [...w32(0), ...w32(hi), ...w32(lo), ...w32(f.data.length), ...w32(f.data.length), ...f.data]);
  });
  return Uint8Array.from([...shb, ...idb, ...epbs]).buffer;
}

/* ---------------------------------- tests ---------------------------------- */

describe("capture file formats", () => {
  const frame = udp4("10.0.0.1", "10.0.0.2", 5000, 6000, ascii("hi"));

  it("reads little-endian pcap", () => {
    const c = parseCapture(pcapFile([{ ts: 1700000000.25, data: frame }]));
    expect(c.format).toBe("pcap");
    expect(c.packets).toHaveLength(1);
    expect(c.packets[0].ts).toBeCloseTo(1700000000.25, 5);
    expect(c.packets[0].src).toBe("10.0.0.1");
  });

  it("reads big-endian pcap", () => {
    const c = parseCapture(pcapFile([{ ts: 1700000000.5, data: frame }], { le: false }));
    expect(c.packets).toHaveLength(1);
    expect(c.packets[0].ts).toBeCloseTo(1700000000.5, 5);
    expect(c.packets[0].dstPort).toBe(6000);
  });

  it("reads nanosecond pcap", () => {
    const c = parseCapture(pcapFile([{ ts: 1700000000.123456789, data: frame }], { nano: true }));
    expect(c.packets[0].ts).toBeCloseTo(1700000000.123456, 4);
  });

  it("reads pcapng with default microsecond resolution", () => {
    const c = parseCapture(pcapngFile([{ ts: 1700000000.5, data: frame }, { ts: 1700000001, data: frame }]));
    expect(c.format).toBe("pcapng");
    expect(c.packets).toHaveLength(2);
    expect(c.packets[0].ts).toBeCloseTo(1700000000.5, 5);
    expect(c.stats.duration).toBeCloseTo(0.5, 5);
  });

  it("honours the pcapng if_tsresol option (nanoseconds)", () => {
    const c = parseCapture(pcapngFile([{ ts: 1700000000.5, data: frame }], { tsresol: 9 }));
    expect(c.packets[0].ts).toBeCloseTo(1700000000.5, 3);
  });

  it("reports a truncated pcap instead of failing", () => {
    const full = new Uint8Array(pcapFile([{ ts: 1, data: frame }, { ts: 2, data: frame }]));
    const cut = full.slice(0, full.length - 5).buffer;
    const c = parseCapture(cut);
    expect(c.packets).toHaveLength(1);
    expect(c.warnings.join(" ")).toMatch(/truncated/i);
  });

  it("rejects files that are not captures", () => {
    expect(() => parseCapture(new Uint8Array(64).fill(65).buffer)).toThrow(/Not a pcap/);
    expect(() => parseCapture(new Uint8Array(4).buffer)).toThrow(/too short/);
    const gz = new Uint8Array(32);
    gz[0] = 0x1f;
    gz[1] = 0x8b;
    expect(() => parseCapture(gz.buffer)).toThrow(/gzip/);
  });

  it("warns about unsupported link types but keeps the packets", () => {
    const c = parseCapture(pcapFile([{ ts: 1, data: [1, 2, 3, 4, 5] }], { linkType: 147 }));
    expect(c.packets).toHaveLength(1);
    expect(c.warnings.join(" ")).toMatch(/Link type 147/);
  });
});

describe("link layers", () => {
  it("decodes VLAN tagged frames", () => {
    const inner = ipv4(17, "10.0.0.1", "10.0.0.2", udp(1, 2, [0]));
    const f = [...mac(MAC_B), ...mac(MAC_A), ...be16(0x8100), ...be16(0x0064), ...be16(0x0800), ...inner];
    const c = parseCapture(pcapFile([{ ts: 1, data: f }]));
    expect(c.packets[0].vlan).toBe(100);
    expect(c.packets[0].protocol).toBe("UDP");
  });

  it("decodes raw IP captures", () => {
    const c = parseCapture(pcapFile([{ ts: 1, data: ipv4(17, "1.1.1.1", "2.2.2.2", udp(9, 10, [1])) }], { linkType: 101 }));
    expect(c.packets[0].src).toBe("1.1.1.1");
    expect(c.packets[0].dstPort).toBe(10);
  });

  it("decodes Linux cooked captures", () => {
    const sll = [0, 0, 0, 1, 0, 6, ...mac(MAC_A), 0, 0, ...be16(0x0800), ...ipv4(17, "3.3.3.3", "4.4.4.4", udp(1, 2, [0]))];
    const c = parseCapture(pcapFile([{ ts: 1, data: sll }], { linkType: 113 }));
    expect(c.packets[0].src).toBe("3.3.3.3");
    expect(c.packets[0].srcMac).toBe(MAC_A);
  });

  it("ignores Ethernet padding after the IP datagram", () => {
    const f = [...tcp4("10.0.0.1", "10.0.0.2", 1000, 80, ACK, 1, 1), 0, 0, 0, 0, 0, 0];
    const c = parseCapture(pcapFile([{ ts: 1, data: f }]));
    expect(c.packets[0].payload.length).toBe(0);
  });

  it("labels non-IP frames with their MAC addresses", () => {
    const c = parseCapture(pcapFile([{ ts: 1, data: eth(0x88cc, [1, 2, 3]) }]));
    expect(c.packets[0].protocol).toBe("LLDP");
    expect(c.packets[0].src).toBe(MAC_A);
  });
});

describe("ARP", () => {
  const arp = (op: number, sha: string, spa: string, tha: string, tpa: string) =>
    eth(0x0806, [...be16(1), ...be16(0x0800), 6, 4, ...be16(op), ...mac(sha), ...ip4(spa), ...mac(tha), ...ip4(tpa)]);

  it("describes requests and replies", () => {
    const c = parseCapture(
      pcapFile([
        { ts: 1, data: arp(1, MAC_A, "192.168.1.10", "00:00:00:00:00:00", "192.168.1.1") },
        { ts: 2, data: arp(2, MAC_B, "192.168.1.1", MAC_A, "192.168.1.10") },
        { ts: 3, data: arp(1, MAC_A, "192.168.1.10", "00:00:00:00:00:00", "192.168.1.10") },
      ]),
    );
    expect(c.packets[0].protocol).toBe("ARP");
    expect(c.packets[0].info).toBe("Who has 192.168.1.1? Tell 192.168.1.10");
    expect(c.packets[1].info).toBe(`192.168.1.1 is at ${MAC_B}`);
    expect(c.packets[2].info).toMatch(/Gratuitous/);
    expect(c.hosts.map((h) => h.address)).toContain("192.168.1.1");
  });
});

describe("IPv6", () => {
  const v6 = (next: number, src: number[], dst: number[], payload: number[]) => [
    0x60, 0, 0, 0, ...be16(payload.length), next, 64, ...src, ...dst, ...payload,
  ];
  const addr = (...groups: number[]) => groups.flatMap(be16);
  const SRC = addr(0x2001, 0xdb8, 0, 0, 0, 0, 0, 1);
  const DST = addr(0x2001, 0xdb8, 0, 0, 0, 0, 0, 2);

  it("decodes TCP over IPv6 and compresses addresses", () => {
    const f = eth(0x86dd, v6(6, SRC, DST, tcp(40000, 443, SYN, 100, 0)));
    const c = parseCapture(pcapFile([{ ts: 1, data: f }]));
    const p = c.packets[0];
    expect(p.l3).toBe("IPv6");
    expect(p.src).toBe("2001:db8::1");
    expect(p.dst).toBe("2001:db8::2");
    expect(p.transport).toBe("TCP");
    expect(p.flags).toEqual(["SYN"]);
  });

  it("skips extension headers", () => {
    // Hop-by-hop header (8 bytes) in front of UDP
    const hbh = [17, 0, 1, 4, 0, 0, 0, 0];
    const f = eth(0x86dd, v6(0, SRC, DST, [...hbh, ...udp(1000, 2000, [9])]));
    const p = parseCapture(pcapFile([{ ts: 1, data: f }])).packets[0];
    expect(p.transport).toBe("UDP");
    expect(p.dstPort).toBe(2000);
  });

  it("formats loopback and unspecified addresses", () => {
    const lo = addr(0, 0, 0, 0, 0, 0, 0, 1);
    const f = eth(0x86dd, v6(58, lo, lo, [128, 0, 0, 0]));
    const p = parseCapture(pcapFile([{ ts: 1, data: f }])).packets[0];
    expect(p.src).toBe("::1");
    expect(p.protocol).toBe("ICMPv6");
    expect(p.info).toBe("Echo request");
  });
});

describe("TCP", () => {
  it("decodes ports, flags, sequence numbers and ICMP", () => {
    const c = parseCapture(
      pcapFile([
        { ts: 1, data: tcp4("10.0.0.1", "10.0.0.2", 50000, 22, SYN, 1000, 0) },
        { ts: 2, data: eth(0x0800, ipv4(1, "10.0.0.1", "10.0.0.2", [8, 0, 0, 0, 0x12, 0x34, 0, 7])) },
      ]),
    );
    const t = c.packets[0];
    expect(t.srcPort).toBe(50000);
    expect(t.dstPort).toBe(22);
    expect(t.seq).toBe(1000);
    expect(t.info).toContain("[SYN]");
    expect(c.packets[1].protocol).toBe("ICMP");
    expect(c.packets[1].info).toBe("Echo request id=0x1234 seq=7");
  });
});

describe("DNS", () => {
  it("decodes queries and compressed responses, and learns host names", () => {
    const c = parseCapture(
      pcapFile([
        { ts: 1, data: udp4("10.0.0.5", "10.0.0.1", 53124, 53, dnsQuery("www.example.com")) },
        { ts: 2, data: udp4("10.0.0.1", "10.0.0.5", 53, 53124, dnsResponseA("www.example.com", "93.184.216.34")) },
        { ts: 3, data: tcp4("10.0.0.5", "93.184.216.34", 50000, 443, SYN, 1, 0) },
      ]),
    );
    expect(c.packets[0].protocol).toBe("DNS");
    expect(c.packets[0].info).toBe("Standard query 0x1234 A www.example.com");
    expect(c.packets[1].info).toBe("Standard query response 0x1234 A www.example.com → A 93.184.216.34");
    const host = c.hosts.find((h) => h.address === "93.184.216.34");
    expect(host?.names).toEqual(["www.example.com"]);
    expect(c.iocs.find((i) => i.type === "DOMAIN")?.value).toBe("www.example.com");
  });

  it("flags NXDOMAIN", () => {
    const resp = dnsResponseA("nope.test", "0.0.0.0");
    resp[3] = 0x83;
    const p = parseCapture(pcapFile([{ ts: 1, data: udp4("10.0.0.1", "10.0.0.5", 53, 1111, resp.slice(0, 12 + dnsName("nope.test").length + 4)) }])).packets[0];
    expect(p.info).toContain("No such name");
  });

  it("does not crash on garbage on port 53", () => {
    const p = parseCapture(pcapFile([{ ts: 1, data: udp4("10.0.0.1", "10.0.0.2", 53, 53, [1, 2, 3]) }])).packets[0];
    expect(p.protocol).toBe("UDP");
  });

  it("survives a compression pointer loop", () => {
    const bad = [...be16(1), 0x01, 0x00, ...be16(1), 0, 0, 0, 0, 0, 0, 0xc0, 12, ...be16(1), ...be16(1)];
    const p = parseCapture(pcapFile([{ ts: 1, data: udp4("10.0.0.1", "10.0.0.2", 1111, 53, bad) }])).packets[0];
    expect(p.protocol).toBe("UDP");
  });
});

describe("HTTP", () => {
  const req = ascii("GET /login?x=1 HTTP/1.1\r\nHost: app.example.com\r\nUser-Agent: curl/8.0\r\n\r\n");
  const res = ascii("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nServer: nginx\r\n\r\n<html>");

  it("decodes requests and responses", () => {
    const c = parseCapture(
      pcapFile([
        { ts: 1, data: tcp4("10.0.0.1", "10.0.0.2", 51000, 80, PSH | ACK, 1, 1, req) },
        { ts: 2, data: tcp4("10.0.0.2", "10.0.0.1", 80, 51000, PSH | ACK, 1, 1 + req.length, res) },
      ]),
    );
    const [q, r] = c.packets;
    expect(q.protocol).toBe("HTTP");
    expect(q.http).toMatchObject({ kind: "request", method: "GET", path: "/login?x=1", host: "app.example.com", userAgent: "curl/8.0" });
    expect(r.http).toMatchObject({ kind: "response", status: 200, contentType: "text/html", server: "nginx" });
    expect(c.streams[0].app).toBe("HTTP");
    expect(c.iocs.find((i) => i.type === "URL")?.value).toBe("http://app.example.com/login?x=1");
    expect(c.iocs.some((i) => i.type === "DOMAIN" && i.value === "app.example.com")).toBe(true);
  });
});

describe("TLS", () => {
  it("extracts the SNI from a ClientHello", () => {
    const p = parseCapture(
      pcapFile([{ ts: 1, data: tcp4("10.0.0.1", "10.0.0.2", 52000, 443, PSH | ACK, 1, 1, tlsClientHello("secure.example.org")) }]),
    ).packets[0];
    expect(p.protocol).toBe("TLS");
    expect(p.tls?.sni).toBe("secure.example.org");
    expect(p.info).toBe("Client Hello (SNI: secure.example.org)");
  });

  it("copes with a truncated ClientHello", () => {
    const hello = tlsClientHello("secure.example.org").slice(0, 60);
    const p = parseCapture(pcapFile([{ ts: 1, data: tcp4("10.0.0.1", "10.0.0.2", 52000, 443, PSH | ACK, 1, 1, hello) }])).packets[0];
    expect(p.protocol).toBe("TLS");
    expect(p.tls?.sni).toBeUndefined();
  });
});

describe("DHCP", () => {
  it("names the message type", () => {
    const body = new Array(240).fill(0);
    body.splice(4, 4, 0xde, 0xad, 0xbe, 0xef);
    body.splice(236, 4, 0x63, 0x82, 0x53, 0x63);
    const dhcp = [...body, 53, 1, 1, 255];
    const p = parseCapture(pcapFile([{ ts: 1, data: udp4("0.0.0.0", "255.255.255.255", 68, 67, dhcp) }])).packets[0];
    expect(p.protocol).toBe("DHCP");
    expect(p.info).toBe("DHCP Discover - Transaction ID 0xdeadbeef");
  });
});

describe("streams", () => {
  const A = "10.0.0.1";
  const B = "10.0.0.2";

  it("separates connections between the same two hosts by port", () => {
    const c = parseCapture(
      pcapFile([
        { ts: 1, data: tcp4(A, B, 40001, 80, SYN, 1, 0) },
        { ts: 2, data: tcp4(B, A, 80, 40001, SYN | ACK, 1, 2) },
        { ts: 3, data: tcp4(A, B, 40002, 80, SYN, 5, 0) },
        { ts: 4, data: tcp4(A, B, 40001, 80, ACK, 2, 2) },
      ]),
    );
    expect(c.streams).toHaveLength(2);
    const s = c.streams[0];
    expect(s.packets).toBe(3);
    expect(s.a).toBe(A);
    expect(s.aPort).toBe(40001);
    expect(s.aToB.packets).toBe(2);
    expect(s.bToA.packets).toBe(1);
    expect(s.state).toBe("open");
    expect(c.packets[3].streamId).toBe(0);
  });

  it("makes the SYN sender the initiator even when the capture starts at the SYN-ACK", () => {
    const c = parseCapture(pcapFile([{ ts: 1, data: tcp4(B, A, 80, 40001, SYN | ACK, 1, 2) }]));
    expect(c.streams[0].a).toBe(A);
    expect(c.streams[0].bPort).toBe(80);
  });

  it("tracks reset, closed and mid-stream connections", () => {
    const c = parseCapture(
      pcapFile([
        { ts: 1, data: tcp4(A, B, 1000, 80, SYN, 1, 0) },
        { ts: 2, data: tcp4(B, A, 80, 1000, 0x04, 0, 0) },
        { ts: 3, data: tcp4(A, B, 2000, 80, 0x01 | ACK, 1, 1) },
        { ts: 4, data: tcp4(A, B, 3000, 80, ACK, 1, 1) },
      ]),
    );
    expect(c.streams.map((s) => s.state)).toEqual(["reset", "closed", "partial"]);
  });

  it("keeps UDP flows apart from TCP flows with the same ports", () => {
    const c = parseCapture(
      pcapFile([
        { ts: 1, data: tcp4(A, B, 5000, 53, SYN, 1, 0) },
        { ts: 2, data: udp4(A, B, 5000, 53, [0]) },
      ]),
    );
    expect(c.streams.map((s) => s.protocol)).toEqual(["TCP", "UDP"]);
  });

  it("follows a TCP stream, dropping retransmissions", () => {
    const q = ascii("GET / HTTP/1.1\r\nHost: a.test\r\n\r\n");
    const r1 = ascii("HTTP/1.1 200 OK\r\n\r\nhel");
    const r2 = ascii("lo");
    const c = parseCapture(
      pcapFile([
        { ts: 1, data: tcp4(A, B, 4000, 80, SYN, 100, 0) },
        { ts: 2, data: tcp4(B, A, 80, 4000, SYN | ACK, 500, 101) },
        { ts: 3, data: tcp4(A, B, 4000, 80, PSH | ACK, 101, 501, q) },
        { ts: 4, data: tcp4(A, B, 4000, 80, PSH | ACK, 101, 501, q) }, // retransmission
        { ts: 5, data: tcp4(B, A, 80, 4000, PSH | ACK, 501, 101 + q.length, r1) },
        { ts: 6, data: tcp4(B, A, 80, 4000, PSH | ACK, 501 + r1.length, 101 + q.length, r2) },
      ]),
    );
    const segs = followStream(c, 0);
    expect(segs.map((s) => s.dir)).toEqual(["a→b", "b→a"]);
    expect(toPrintable(segs[0].data)).toBe("GET / HTTP/1.1\r\nHost: a.test\r\n\r\n");
    expect(toPrintable(segs[1].data)).toBe("HTTP/1.1 200 OK\r\n\r\nhello");
  });

  it("returns nothing for an unknown stream", () => {
    const c = parseCapture(pcapFile([{ ts: 1, data: tcp4(A, B, 1, 2, SYN, 1, 0) }]));
    expect(followStream(c, 99)).toEqual([]);
  });
});

describe("hosts and indicators", () => {
  it("counts traffic per host and scopes addresses", () => {
    const c = parseCapture(
      pcapFile([
        { ts: 1, data: udp4("192.168.1.5", "8.8.8.8", 1000, 53, dnsQuery("x.test")) },
        { ts: 2, data: udp4("192.168.1.5", "8.8.8.8", 1001, 53, dnsQuery("y.test")) },
      ]),
    );
    const lan = c.hosts.find((h) => h.address === "192.168.1.5")!;
    expect(lan.packetsSent).toBe(2);
    expect(lan.scope).toBe("private");
    expect(c.hosts.find((h) => h.address === "8.8.8.8")?.scope).toBe("public");
    expect(c.iocs.find((i) => i.value === "8.8.8.8")).toMatchObject({ type: "IP", count: 2, scope: "public" });
  });

  it("classifies address scopes", () => {
    expect(ipScope("10.1.2.3")).toBe("private");
    expect(ipScope("172.20.0.1")).toBe("private");
    expect(ipScope("172.32.0.1")).toBe("public");
    expect(ipScope("127.0.0.1")).toBe("special");
    expect(ipScope("224.0.0.251")).toBe("special");
    expect(ipScope("fe80::1")).toBe("private");
    expect(ipScope("2001:db8::1")).toBe("public");
  });
});

describe("compileFilter", () => {
  const c = parseCapture(
    pcapFile([
      { ts: 1, data: tcp4("10.0.0.1", "10.0.0.2", 40000, 443, SYN, 1, 0) },
      { ts: 2, data: tcp4("10.0.0.2", "10.0.0.1", 443, 40000, SYN | ACK, 1, 2) },
      { ts: 3, data: udp4("10.0.0.1", "8.8.8.8", 5000, 53, dnsQuery("evil.example.net")) },
      { ts: 4, data: tcp4("10.0.0.1", "11.0.0.9", 41000, 80, PSH | ACK, 1, 1, ascii("GET /a HTTP/1.1\r\nHost: Files.Test\r\nX: secret-token\r\n\r\n")) },
    ]),
  );
  const ids = (q: string) => c.packets.filter(compileFilter(q)).map((p) => p.id);

  it("matches everything for an empty query", () => {
    expect(ids("")).toEqual([1, 2, 3, 4]);
    expect(ids("   ")).toEqual([1, 2, 3, 4]);
  });

  it("matches addresses exactly, by prefix and by CIDR", () => {
    expect(ids("ip:8.8.8.8")).toEqual([3]);
    expect(ids("ip:11.0.0.9")).toEqual([4]);
    expect(ids("ip:1.0.0.9")).toEqual([]); // not a substring match
    expect(ids("ip:10.0.0.")).toEqual([1, 2, 3, 4]);
    expect(ids("ip:8.8.0.0/16")).toEqual([3]);
    expect(ids("src:10.0.0.2")).toEqual([2]);
    expect(ids("dst:10.0.0.2")).toEqual([1]);
  });

  it("matches ports, protocols, flags and length", () => {
    expect(ids("port:443")).toEqual([1, 2]);
    expect(ids("dport:443")).toEqual([1]);
    expect(ids("sport:443")).toEqual([2]);
    expect(ids("proto:dns")).toEqual([3]);
    expect(ids("proto:tcp")).toEqual([1, 2, 4]);
    expect(ids("flag:syn")).toEqual([1, 2]);
    expect(ids("syn")).toEqual([1, 2]);
    expect(ids("len:>100")).toEqual([4]);
  });

  it("combines terms with AND and supports negation", () => {
    expect(ids("syn !ack")).toEqual([1]);
    expect(ids("syn dst:10.0.0.1")).toEqual([2]);
    expect(ids("tcp !syn")).toEqual([4]);
    expect(ids("-proto:tcp")).toEqual([3]);
  });

  it("searches host names and payload contents", () => {
    expect(ids("host:evil.example")).toEqual([3]);
    expect(ids("host:files.test")).toEqual([4]);
    expect(ids('data:"SECRET-token"')).toEqual([4]);
    expect(ids("data:nothing-here")).toEqual([]);
  });

  it("matches streams and the Info column", () => {
    expect(ids("stream:0")).toEqual([1, 2]);
    expect(ids("GET")).toEqual([4]);
  });

  it("treats unknown keys and IPv6 addresses as plain text", () => {
    expect(ids("fe80::1")).toEqual([]);
    expect(ids("foo:bar")).toEqual([]);
  });

  it("does not match garbage numbers", () => {
    expect(ids("port:abc")).toEqual([]);
    expect(ids("len:abc")).toEqual([]);
  });
});

describe("describePacket", () => {
  it("lists the layers of a TLS packet", async () => {
    const { describePacket } = await import("@/lib/pcap");
    const p = parseCapture(
      pcapFile([{ ts: 1, data: tcp4("10.0.0.1", "10.0.0.2", 52000, 443, PSH | ACK, 1, 1, tlsClientHello("a.example")) }]),
    ).packets[0];
    const names = describePacket(p).map((l) => l.name);
    expect(names).toEqual(["Frame", "Link", "IPv4", "TCP", "TLS"]);
    expect(describePacket(p).find((l) => l.name === "TLS")?.fields).toContainEqual({ name: "Server name (SNI)", value: "a.example" });
  });
});
