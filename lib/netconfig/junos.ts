import { commentModel, pickMgmtIp } from "./common";
import type { Path } from "./flatten";
import { emptyDevice, newIface, type Iface, type IfaceKind, type ParsedDevice, type Policy } from "./types";
import { expandVlanList, isIpv4, parseCidr, unique } from "./util";

function expandRange(a: string, b: string): string[] {
  const ma = /^(.*?)(\d+)$/.exec(a);
  const mb = /^(.*?)(\d+)$/.exec(b);
  if (!ma || !mb || ma[1] !== mb[1]) return [a, b];
  const lo = Number(ma[2]);
  const hi = Number(mb[2]);
  if (hi < lo || hi - lo > 1000) return [a, b];
  const out: string[] = [];
  for (let i = lo; i <= hi; i++) out.push(`${ma[1]}${i}`);
  return out;
}

/** Applies interface-range bodies to each member so the rest of the parser sees plain interfaces. */
function expandInterfaceRanges(paths: Path[]): Path[] {
  const members = new Map<string, string[]>();
  const body = new Map<string, Path[]>();
  const rest: Path[] = [];
  for (const p of paths) {
    if (p[0] === "interfaces" && p[1] === "interface-range" && p[2]) {
      const list = members.get(p[2]) ?? [];
      if (p[3] === "member" && p[4]) list.push(p[4]);
      else if (p[3] === "member-range" && p[4] && p[5] === "to" && p[6]) list.push(...expandRange(p[4], p[6]));
      else body.set(p[2], [...(body.get(p[2]) ?? []), p.slice(3)]);
      members.set(p[2], list);
    } else rest.push(p);
  }
  for (const [name, list] of Array.from(members)) {
    for (const m of list) for (const b of body.get(name) ?? []) rest.push(["interfaces", m, ...b]);
  }
  return rest;
}

function physicalKind(name: string): IfaceKind | null {
  if (/^ae\d+$/.test(name)) return "aggregate";
  if (/^(ge|xe|et|fe|mge)-\d/.test(name)) return "physical";
  return null;
}

export function parseJunos(paths: Path[], text: string): ParsedDevice {
  const d = emptyDevice("juniper");
  d.model = commentModel(text);
  const all = expandInterfaceRanges(paths);

  const ifaces = new Map<string, Iface>();
  const get = (name: string, kind: IfaceKind): Iface => {
    let f = ifaces.get(name);
    if (!f) {
      f = newIface(name, kind);
      ifaces.set(name, f);
    }
    return f;
  };
  const vlanByName = new Map<string, number>();
  const switching: { iface: Iface; members: string[] }[] = [];
  const l3Vlan = new Map<string, string>(); // irb.N -> vlan name
  const bgpGroupAs = new Map<string, string>();
  const bgpNeighbors: { group: string; address: string; as?: string }[] = [];
  const zoneIfaces = new Map<string, string[]>();
  const policies = new Map<string, Policy>();
  const ike = new Map<string, { remote?: string; iface?: string }>();
  const protocols = new Set<string>();
  let asn = "";

  for (const p of all) {
    switch (p[0]) {
      case "version":
        if (p[1]) d.osVersion = p[1];
        break;
      case "system":
        if (p[1] === "host-name") d.hostname = p[2] ?? "";
        break;
      case "vlans": {
        const name = p[1];
        if (p[2] === "vlan-id" && p[3]) {
          const id = Number(p[3]);
          if (!Number.isNaN(id)) {
            vlanByName.set(name, id);
            if (!d.vlans.some((v) => v.id === id)) d.vlans.push({ id, name });
          }
        } else if (p[2] === "l3-interface" && p[3]) l3Vlan.set(p[3], name);
        break;
      }
      case "routing-options": {
        if (p[1] === "autonomous-system" && p[2]) asn = p[2];
        const si = p.indexOf("static");
        if (si !== -1 && p[si + 1] === "route" && p[si + 2]) {
          const dest = p[si + 2];
          const idx = p.indexOf("next-hop");
          const pref = p.indexOf("preference");
          if (idx !== -1 || p[si + 3] === "discard") {
            d.routes.push({
              destination: dest,
              nextHop: idx !== -1 ? p[idx + 1] : undefined,
              iface: p[si + 3] === "discard" ? "discard" : undefined,
              distance: pref !== -1 ? Number(p[pref + 1]) : 5,
            });
          }
        }
        break;
      }
      case "protocols": {
        const proto = p[1];
        if (["ospf", "ospf3", "isis", "rip", "ripng", "evpn"].includes(proto)) protocols.add(proto.toUpperCase());
        if (proto === "bgp") {
          protocols.add("BGP");
          const gi = p.indexOf("group");
          if (gi !== -1 && p[gi + 1]) {
            const g = p[gi + 1];
            const ni = p.indexOf("neighbor");
            const pa = p.indexOf("peer-as");
            if (ni !== -1 && p[ni + 1]) {
              let n = bgpNeighbors.find((x) => x.group === g && x.address === p[ni + 1]);
              if (!n) bgpNeighbors.push((n = { group: g, address: p[ni + 1] }));
              if (pa !== -1) n.as = p[pa + 1];
            } else if (pa !== -1) bgpGroupAs.set(g, p[pa + 1]);
          }
        }
        break;
      }
      case "security": {
        if (p[1] === "zones" && p[2] === "security-zone" && p[3] && p[4] === "interfaces" && p[5]) {
          zoneIfaces.set(p[3], [...(zoneIfaces.get(p[3]) ?? []), p[5]]);
        } else if (p[1] === "zones" && p[2] === "security-zone" && p[3] && !zoneIfaces.has(p[3])) {
          zoneIfaces.set(p[3], []);
        } else if (p[1] === "policies") {
          let from = "global";
          let to = "global";
          let i = 2;
          if (p[2] === "from-zone" && p[4] === "to-zone") {
            from = p[3];
            to = p[5];
            i = 6;
          } else if (p[2] === "global") i = 3;
          if (p[i] === "policy" && p[i + 1]) {
            const key = `${from}>${to}>${p[i + 1]}`;
            let pol = policies.get(key);
            if (!pol) {
              pol = { name: p[i + 1], from: [from], to: [to], source: [], destination: [], service: [], action: "deny", enabled: true };
              policies.set(key, pol);
            }
            const rest = p.slice(i + 2);
            if (rest[0] === "match" && rest[1] && rest[2]) {
              if (rest[1] === "source-address") pol.source.push(rest[2]);
              else if (rest[1] === "destination-address") pol.destination.push(rest[2]);
              else if (rest[1] === "application") pol.service.push(rest[2]);
            } else if (rest[0] === "then" && rest[1]) {
              if (["permit", "deny", "reject"].includes(rest[1])) pol.action = rest[1];
            } else if (rest[0] === "inactive") pol.enabled = false;
          }
        } else if (p[1] === "ike" && p[2] === "gateway" && p[3]) {
          const g = ike.get(p[3]) ?? {};
          if (p[4] === "address" && p[5]) g.remote = p[5];
          if (p[4] === "external-interface" && p[5]) g.iface = p[5];
          ike.set(p[3], g);
        }
        break;
      }
      case "interfaces": {
        const name = p[1];
        if (!name || name === "interface-range" || name === "apply-groups") break;
        const phys = physicalKind(name);
        let base: Iface | undefined;
        if (phys) base = get(name, phys);

        if (p[2] === "description" && base) base.description = p.slice(3).join(" ");
        else if (p[2] === "disable" && base) base.enabled = false;
        else if ((p[2] === "gigether-options" || p[2] === "ether-options") && p[3] === "802.3ad" && p[4] && base) base.lag = p[4];
        else if (p[2] === "speed" && p[3] && base) base.speed = p[3];
        else if (p[2] === "unit" && p[3] !== undefined) {
          const unit = p[3];
          const unitName = `${name}.${unit}`;
          const rest = p.slice(4);
          const target = (): Iface => {
            if (name === "irb") return get(unitName, "vlan");
            if (name === "lo0") return get(unitName, "loopback");
            if (/^(fxp0|em0|me0)$/.test(name)) return get(unitName, "mgmt");
            if (/^st0$/.test(name)) return get(unitName, "tunnel");
            if (unit === "0" && base) return base;
            return get(unitName, "subinterface");
          };
          if (rest[0] === "description") {
            const t = target();
            t.description = rest.slice(1).join(" ");
          } else if (rest[0] === "vlan-id" && rest[1]) {
            const t = get(unitName, "subinterface");
            t.vlan = Number(rest[1]);
            t.parent = name;
          } else if (rest[0] === "family" && rest[1] === "inet" && rest[2] === "address" && rest[3]) {
            const c = parseCidr(rest[3]);
            if (c) {
              const t = target();
              t.ips.push(c);
              if (t.mode === "unknown") t.mode = "routed";
              if (t.kind === "subinterface" && !t.parent) t.parent = name;
            }
          } else if (rest[0] === "family" && rest[1] === "ethernet-switching" && base) {
            if (rest[2] === "interface-mode" && (rest[3] === "access" || rest[3] === "trunk")) base.mode = rest[3];
            else if (rest[2] === "native-vlan-id" && rest[3]) base.nativeVlan = Number(rest[3]);
            else if (rest[2] === "vlan" && rest[3] === "members" && rest[4]) {
              let e = switching.find((s) => s.iface === base);
              if (!e) switching.push((e = { iface: base, members: [] }));
              e.members.push(rest[4]);
            }
          } else if (rest[0] === "disable") target().enabled = false;
        } else if (p[2] === "native-vlan-id" && p[3] && base) base.nativeVlan = Number(p[3]);
        break;
      }
      default:
        break;
    }
  }

  // switching: resolve vlan members
  for (const { iface, members } of switching) {
    const ids: number[] = [];
    let all_ = false;
    for (const m of members) {
      if (m === "all") all_ = true;
      else if (vlanByName.has(m)) ids.push(vlanByName.get(m)!);
      else ids.push(...expandVlanList(m));
    }
    if (iface.mode === "access") iface.vlan = ids[0];
    else if (iface.mode === "trunk") iface.trunkVlans = all_ ? "all" : unique(ids);
    else if (iface.mode === "unknown") {
      iface.mode = ids.length > 1 || all_ ? "trunk" : "access";
      if (iface.mode === "access") iface.vlan = ids[0];
      else iface.trunkVlans = all_ ? "all" : unique(ids);
    }
  }
  for (const f of Array.from(ifaces.values())) {
    if (f.mode === "trunk" && !f.trunkVlans) f.trunkVlans = "all";
    if (f.kind === "vlan") {
      const vn = l3Vlan.get(f.name);
      if (vn && vlanByName.has(vn)) f.vlan = vlanByName.get(vn);
      else {
        const m = /\.(\d+)$/.exec(f.name);
        if (m) f.vlan = Number(m[1]);
      }
    }
  }

  d.interfaces = Array.from(ifaces.values());

  for (const [zone, members] of Array.from(zoneIfaces)) {
    d.zones.push({ name: zone, interfaces: members });
    for (const m of members) {
      const f = ifaces.get(m) ?? ifaces.get(m.replace(/\.0$/, ""));
      if (f) f.zone = zone;
    }
  }

  d.policies = Array.from(policies.values());
  d.protocols = Array.from(protocols);
  if (asn && protocols.has("BGP")) d.protocols = d.protocols.map((x) => (x === "BGP" ? `BGP ${asn}` : x));
  for (const n of bgpNeighbors) d.neighbors.push({ protocol: "BGP", address: n.address, remoteAs: n.as ?? bgpGroupAs.get(n.group) });
  for (const [name, g] of Array.from(ike)) d.vpns.push({ name, remote: g.remote, iface: g.iface });

  d.role = d.zones.length || d.policies.length ? "firewall" : d.vlans.length || d.interfaces.some((i) => i.mode === "access" || i.mode === "trunk") ? "switch" : d.interfaces.length ? "router" : "unknown";
  d.routes = d.routes.filter((r) => isIpv4(r.destination.split("/")[0]) || r.destination.includes(":"));
  d.mgmtIp = pickMgmtIp(d);
  if (!d.interfaces.length) d.warnings.push("No interfaces were found. Check that this is a Junos configuration (set or curly-brace format).");
  return d;
}
