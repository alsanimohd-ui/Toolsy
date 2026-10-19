import type { Iface, ParsedDevice } from "./types";
import { fmtIp, ipInPrefix, networkOf } from "./util";

/* ------------------------------ port grouping ------------------------------ */

export interface PortGroup {
  label: string;
  names: string[];
  mode: Iface["mode"];
  vlan?: number;
  trunkVlans?: number[] | "all";
  enabled: boolean;
  description: string;
  lag?: string;
  zone?: string;
  ips: string[];
  kind: Iface["kind"];
}

const vlanSig = (f: Iface) => (f.trunkVlans === "all" ? "all" : (f.trunkVlans ?? []).join(","));

function groupKey(f: Iface): string {
  return [f.kind, f.mode, f.vlan ?? "", vlanSig(f), f.nativeVlan ?? "", f.enabled, f.description, f.lag ?? "", f.zone ?? "", f.speed ?? ""].join("|");
}

/** Collapses runs like Gi1/0/1..24 that share the same configuration into one row. */
export function groupPorts(ifaces: Iface[]): PortGroup[] {
  const out: PortGroup[] = [];
  let cur: { g: PortGroup; key: string; stem: string; last: number } | null = null;
  for (const f of ifaces) {
    const m = /^(.*?)(\d+)$/.exec(f.name);
    const groupable = f.kind === "physical" && f.ips.length === 0 && !!m;
    const key = groupKey(f);
    if (cur && groupable && m && cur.key === key && cur.stem === m[1] && Number(m[2]) === cur.last + 1) {
      cur.g.names.push(f.name);
      cur.last = Number(m[2]);
      const first = cur.g.names[0];
      cur.g.label = `${first}–${m[2]}`;
      continue;
    }
    const g: PortGroup = {
      label: f.name,
      names: [f.name],
      mode: f.mode,
      vlan: f.vlan,
      trunkVlans: f.trunkVlans,
      enabled: f.enabled,
      description: f.description,
      lag: f.lag,
      zone: f.zone,
      ips: f.ips.map(fmtIp),
      kind: f.kind,
    };
    out.push(g);
    cur = groupable && m ? { g, key, stem: m[1], last: Number(m[2]) } : null;
  }
  return out;
}

/* ---------------------------------- map ----------------------------------- */

export interface MapSegment {
  id: string;
  kind: "zone" | "vlan" | "subnet" | "loopback";
  title: string;
  subtitle?: string;
  rows: { text: string; sub?: string }[];
  extra: number;
}

export interface MapPeer {
  id: string;
  kind: "trunk" | "next-hop" | "bgp" | "vpn";
  title: string;
  subtitle?: string;
  rows: string[];
  extra: number;
  via?: string;
}

export interface MapModel {
  title: string;
  subtitle: string;
  segments: MapSegment[];
  peers: MapPeer[];
  hiddenSegments: number;
  hiddenPeers: number;
}

const MAX_SEGMENTS = 24;
const MAX_PEERS = 16;
const MAX_ROWS = 4;

function capRows<T>(rows: T[]): { rows: T[]; extra: number } {
  return { rows: rows.slice(0, MAX_ROWS), extra: Math.max(0, rows.length - MAX_ROWS) };
}

const ifaceRow = (f: Iface) => ({ text: f.name, sub: f.ips.map(fmtIp).join(", ") || undefined });

export function buildMap(d: ParsedDevice): MapModel {
  const segments: MapSegment[] = [];
  const peers: MapPeer[] = [];
  const members = new Set(d.interfaces.filter((i) => i.lag).map((i) => i.name));
  const live = d.interfaces.filter((i) => i.enabled);

  if (d.zones.length) {
    for (const z of d.zones) {
      const rows = z.interfaces.map((n) => d.interfaces.find((i) => i.name === n)).filter((i): i is Iface => !!i).map(ifaceRow);
      const names = z.interfaces.filter((n) => !d.interfaces.some((i) => i.name === n)).map((n) => ({ text: n }));
      const all = [...rows, ...names];
      const c = capRows(all);
      segments.push({ id: `zone:${z.name}`, kind: "zone", title: z.name, subtitle: `Zone · ${z.interfaces.length} interface${z.interfaces.length === 1 ? "" : "s"}`, rows: c.rows, extra: c.extra });
    }
    const unzoned = live.filter((i) => !i.zone && i.ips.length && !members.has(i.name));
    if (unzoned.length) {
      const c = capRows(unzoned.map(ifaceRow));
      segments.push({ id: "zone:none", kind: "zone", title: "No zone", subtitle: `${unzoned.length} interface${unzoned.length === 1 ? "" : "s"}`, rows: c.rows, extra: c.extra });
    }
  } else {
    // routed networks, one card per subnet
    const nets = new Map<string, Iface[]>();
    const loops: Iface[] = [];
    for (const f of live) {
      if (!f.ips.length) continue;
      if (f.kind === "loopback") {
        loops.push(f);
        continue;
      }
      if (f.kind === "vlan") continue; // shown on the VLAN card
      const key = networkOf(f.ips[0].address, f.ips[0].prefix);
      nets.set(key, [...(nets.get(key) ?? []), f]);
    }
    for (const [net, list] of Array.from(nets)) {
      const c = capRows(list.map(ifaceRow));
      segments.push({ id: `net:${net}`, kind: "subnet", title: net, subtitle: "Routed network", rows: c.rows, extra: c.extra });
    }
    if (loops.length) {
      const c = capRows(loops.map(ifaceRow));
      segments.push({ id: "loopbacks", kind: "loopback", title: "Loopbacks", rows: c.rows, extra: c.extra });
    }

    // VLANs
    const ids = new Set<number>(d.vlans.map((v) => v.id));
    for (const f of d.interfaces) if (f.kind === "vlan" && f.vlan) ids.add(f.vlan);
    for (const f of d.interfaces) if (f.mode === "access" && f.vlan && !f.lag) ids.add(f.vlan);
    for (const id of Array.from(ids).sort((a, b) => a - b)) {
      const name = d.vlans.find((v) => v.id === id)?.name;
      const svi = d.interfaces.find((i) => i.kind === "vlan" && i.vlan === id && i.ips.length);
      const access = d.interfaces.filter((i) => i.mode === "access" && i.vlan === id && !i.lag);
      const trunks = d.interfaces.filter((i) => i.mode === "trunk" && !i.lag && (i.trunkVlans === "all" || (i.trunkVlans ?? []).includes(id)));
      const rows: { text: string; sub?: string }[] = [];
      if (svi) rows.push({ text: svi.name, sub: svi.ips.map(fmtIp).join(", ") });
      if (access.length) rows.push({ text: `${access.length} access port${access.length === 1 ? "" : "s"}` });
      if (trunks.length) rows.push({ text: `Trunked on ${trunks.length} port${trunks.length === 1 ? "" : "s"}` });
      if (!rows.length) rows.push({ text: "No ports assigned" });
      segments.push({ id: `vlan:${id}`, kind: "vlan", title: `VLAN ${id}`, subtitle: name && !/^VLAN\d{4}$/.test(name) ? name : undefined, rows, extra: 0 });
    }
  }

  // trunks / uplinks
  const trunks = groupPorts(d.interfaces.filter((i) => i.mode === "trunk" && !i.lag && i.enabled)).concat(
    groupPorts(d.interfaces.filter((i) => i.kind === "aggregate" && i.mode === "trunk" && i.enabled)),
  );
  const seenTrunk = new Set<string>();
  for (const t of trunks) {
    if (seenTrunk.has(t.label)) continue;
    seenTrunk.add(t.label);
    const vl = t.trunkVlans === "all" ? "All VLANs" : t.trunkVlans?.length ? `VLANs ${t.trunkVlans.slice(0, 8).join(", ")}${t.trunkVlans.length > 8 ? "…" : ""}` : "";
    peers.push({ id: `trunk:${t.label}`, kind: "trunk", title: t.label, subtitle: t.description || "Trunk", rows: vl ? [vl] : [], extra: 0, via: t.label });
  }

  // next hops
  const hops = new Map<string, string[]>();
  for (const r of d.routes) if (r.nextHop) hops.set(r.nextHop, [...(hops.get(r.nextHop) ?? []), r.destination]);
  for (const [nh, dests] of Array.from(hops)) {
    const via = d.interfaces.find((i) => i.ips.some((ip) => ipInPrefix(nh, ip)));
    const c = capRows(dests);
    peers.push({ id: `hop:${nh}`, kind: "next-hop", title: `Next hop ${nh}`, subtitle: via ? `via ${via.name}` : undefined, rows: c.rows, extra: c.extra, via: via?.name });
  }
  for (const n of d.neighbors) {
    const via = d.interfaces.find((i) => i.ips.some((ip) => ipInPrefix(n.address, ip)));
    peers.push({ id: `${n.protocol}:${n.address}`, kind: "bgp", title: `${n.protocol} ${n.address}`, subtitle: n.remoteAs ? `AS ${n.remoteAs}` : undefined, rows: [], extra: 0, via: via?.name });
  }
  for (const v of d.vpns) {
    peers.push({ id: `vpn:${v.name}`, kind: "vpn", title: `VPN ${v.name}`, subtitle: v.remote ? `Peer ${v.remote}` : undefined, rows: [], extra: 0, via: v.iface });
  }

  const sub = [d.model, d.osVersion, d.mgmtIp].filter(Boolean).join(" · ");
  return {
    title: d.hostname || "Device",
    subtitle: sub,
    segments: segments.slice(0, MAX_SEGMENTS),
    peers: peers.slice(0, MAX_PEERS),
    hiddenSegments: Math.max(0, segments.length - MAX_SEGMENTS),
    hiddenPeers: Math.max(0, peers.length - MAX_PEERS),
  };
}
