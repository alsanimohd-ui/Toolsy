import { commentModel, pickMgmtIp } from "./common";
import type { Path } from "./flatten";
import { emptyDevice, newIface, type Iface, type IfaceKind, type ParsedDevice, type Policy } from "./types";
import { parseCidr } from "./util";

/** Drops the "config devices <name> [vsys <name>]" prefix so set / curly / XML all look alike. */
function normalize(p: Path): Path {
  let i = 0;
  if (p[i] === "config") i++;
  if (p[i] === "devices") i += 2;
  if (p[i] === "vsys" && p[i + 1]) i += 2;
  return p.slice(i);
}

const FLAT_TYPES: Record<string, IfaceKind> = { loopback: "loopback", tunnel: "tunnel", vlan: "vlan" };

export function parsePaloAlto(paths: Path[], text: string, rootAttrs: Record<string, string> = {}): ParsedDevice {
  const d = emptyDevice("paloalto");
  d.role = "firewall";
  d.model = commentModel(text);
  const sw = /^\s*(?:#|!|\/\*)+\s*(?:Software|PAN-OS|Version)\s*:\s*(.+?)\s*(?:\*\/)?\s*$/im.exec(text);
  d.osVersion = rootAttrs["detail-version"] || rootAttrs.version || (sw ? sw[1] : "");

  const ifaces = new Map<string, Iface>();
  const get = (name: string, kind: IfaceKind): Iface => {
    let f = ifaces.get(name);
    if (!f) {
      f = newIface(name, kind);
      ifaces.set(name, f);
    }
    return f;
  };
  const zones = new Map<string, string[]>();
  const rules = new Map<string, Policy>();
  const routes = new Map<string, { destination?: string; nextHop?: string; iface?: string; distance?: number }>();
  const ike = new Map<string, { remote?: string; iface?: string }>();
  const protocols = new Set<string>();
  const bgpPeers = new Map<string, { address?: string; as?: string }>();
  let mgmtIp = "";

  for (const raw of paths) {
    const q = normalize(raw);
    if (q[0] === "deviceconfig" && q[1] === "system") {
      if (q[2] === "hostname") d.hostname = q[3] ?? "";
      else if (q[2] === "ip-address" && q[3]) mgmtIp = q[3];
    } else if (q[0] === "network" && q[1] === "interface" && q[2]) {
      const type = q[2];
      const flat = FLAT_TYPES[type];
      const baseName = flat ? type : q[3];
      if (!baseName) continue;
      const rest = flat ? q.slice(3) : q.slice(4);
      const baseKind: IfaceKind = type === "aggregate-ethernet" ? "aggregate" : flat ?? "physical";
      // the bare "loopback"/"tunnel"/"vlan" container only becomes an interface when it carries an IP
      const base = flat ? null : get(baseName, baseKind);
      let r = rest;
      if (r[0] === "layer3" || r[0] === "layer2") r = r.slice(1);
      if (r[0] === "comment" && base) base.description = r.slice(1).join(" ");
      else if (r[0] === "aggregate-group" && r[1] && base) base.lag = r[1];
      else if (r[0] === "link-speed" && r[1] && base) base.speed = r[1];
      else if (r[0] === "ip" && r[1]) {
        const c = parseCidr(r[1]);
        const t = base ?? get(baseName, baseKind);
        if (c) {
          t.ips.push(c);
          t.mode = "routed";
        }
      } else if (r[0] === "dhcp-client" && base) {
        base.description ||= "DHCP client";
        base.mode = "routed";
      } else if (r[0] === "units" && r[1]) {
        const unit = r[1];
        const kind: IfaceKind = flat ?? "subinterface";
        const u = get(unit, kind);
        if (kind === "subinterface") u.parent = baseName;
        if (kind === "vlan") {
          const m = /\.(\d+)$/.exec(unit);
          if (m) u.vlan = Number(m[1]);
        }
        if (r[2] === "ip" && r[3]) {
          const c = parseCidr(r[3]);
          if (c) {
            u.ips.push(c);
            u.mode = "routed";
          }
        } else if ((r[2] === "tag" || r[2] === "vlan-tag") && r[3]) u.vlan = Number(r[3]);
        else if (r[2] === "comment") u.description = r.slice(3).join(" ");
      }
    } else if (q[0] === "zone" && q[1]) {
      const members = zones.get(q[1]) ?? [];
      if (q[2] === "network" && q[4]) members.push(q[4]);
      zones.set(q[1], members);
    } else if (q[0] === "network" && q[1] === "virtual-router" && q[2]) {
      const vr = q[2];
      if (q[3] === "interface" && q[4]) {
        const f = ifaces.get(q[4]);
        if (f && vr !== "default") f.vrf = vr;
      } else if (q[3] === "routing-table" && q[4] === "ip" && q[5] === "static-route" && q[6]) {
        const key = `${vr}/${q[6]}`;
        const r = routes.get(key) ?? {};
        if (q[7] === "destination") r.destination = q[8];
        else if (q[7] === "nexthop" && q[8] === "ip-address") r.nextHop = q[9];
        else if (q[7] === "interface") r.iface = q[8];
        else if (q[7] === "admin-dist") r.distance = Number(q[8]);
        routes.set(key, r);
      } else if (q[3] === "protocol" && q[4]) {
        if (q[5] === "enable" && q[6] === "yes") protocols.add(q[4].toUpperCase());
        if (q[4] === "bgp" && q[5] === "peer-group" && q[7] === "peer" && q[8]) {
          const key = `${q[6]}/${q[8]}`;
          const peer = bgpPeers.get(key) ?? {};
          if (q[9] === "peer-address" && q[10] === "ip" && q[11]) peer.address = q[11];
          else if (q[9] === "peer-as" && q[10]) peer.as = q[10];
          bgpPeers.set(key, peer);
        }
      }
    } else if (q[0] === "rulebase" && q[1] === "security" && q[2] === "rules" && q[3]) {
      let pol = rules.get(q[3]);
      if (!pol) {
        pol = { name: q[3], from: [], to: [], source: [], destination: [], service: [], action: "deny", enabled: true };
        rules.set(q[3], pol);
      }
      const v = q[5];
      if (!v) continue;
      switch (q[4]) {
        case "from": pol.from.push(v); break;
        case "to": pol.to.push(v); break;
        case "source": pol.source.push(v); break;
        case "destination": pol.destination.push(v); break;
        case "application": pol.service.push(v); break;
        case "service": pol.service.push(v); break;
        case "action": pol.action = v; break;
        case "disabled": pol.enabled = v !== "yes"; break;
        default: break;
      }
    } else if (q[0] === "network" && q[1] === "ike" && q[2] === "gateway" && q[3]) {
      const g = ike.get(q[3]) ?? {};
      if (q[4] === "peer-address" && q[5] === "ip" && q[6]) g.remote = q[6];
      if (q[4] === "local-address" && q[5] === "interface" && q[6]) g.iface = q[6];
      ike.set(q[3], g);
    }
  }

  d.interfaces = Array.from(ifaces.values());
  for (const [name, members] of Array.from(zones)) {
    d.zones.push({ name, interfaces: members });
    for (const m of members) {
      const f = ifaces.get(m);
      if (f) f.zone = name;
    }
  }
  for (const r of Array.from(routes.values())) {
    if (!r.destination) continue;
    d.routes.push({ destination: r.destination, nextHop: r.nextHop, iface: r.iface, distance: r.distance ?? 10 });
  }
  d.policies = Array.from(rules.values());
  d.protocols = Array.from(protocols);
  for (const p of Array.from(bgpPeers.values())) if (p.address) d.neighbors.push({ protocol: "BGP", address: p.address, remoteAs: p.as });
  for (const [name, g] of Array.from(ike)) d.vpns.push({ name, remote: g.remote, iface: g.iface });

  d.mgmtIp = mgmtIp || pickMgmtIp(d);
  if (!d.interfaces.length && !d.zones.length) d.warnings.push("No interfaces or zones were found. Check that this is a PAN-OS config (XML, set or curly format).");
  return d;
}
