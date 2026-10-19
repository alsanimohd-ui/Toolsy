import { pickMgmtIp } from "./common";
import { emptyDevice, newIface, type IfaceKind, type ParsedDevice } from "./types";
import { isIpv4, maskToPrefix, tokenize } from "./util";

interface FgNode {
  kind: "root" | "config" | "edit";
  name: string;
  sets: Record<string, string[]>;
  children: FgNode[];
}

function parseTree(text: string): FgNode {
  const root: FgNode = { kind: "root", name: "", sets: {}, children: [] };
  const stack: FgNode[] = [root];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const t = tokenize(line);
    const cur = stack[stack.length - 1];
    switch (t[0]) {
      case "config": {
        const n: FgNode = { kind: "config", name: t.slice(1).join(" "), sets: {}, children: [] };
        cur.children.push(n);
        stack.push(n);
        break;
      }
      case "edit": {
        const n: FgNode = { kind: "edit", name: t.slice(1).join(" "), sets: {}, children: [] };
        cur.children.push(n);
        stack.push(n);
        break;
      }
      case "next":
      case "end":
        if (stack.length > 1) stack.pop();
        break;
      case "set":
        cur.sets[t[1]] = t.slice(2);
        break;
      case "append":
        cur.sets[t[1]] = [...(cur.sets[t[1]] ?? []), ...t.slice(2)];
        break;
      default:
        break;
    }
  }
  return root;
}

function findConfigs(node: FgNode, name: string, out: FgNode[] = []): FgNode[] {
  for (const c of node.children) {
    if (c.kind === "config" && c.name === name) out.push(c);
    findConfigs(c, name, out);
  }
  return out;
}

const entries = (cfgs: FgNode[]) => cfgs.flatMap((c) => c.children.filter((e) => e.kind === "edit"));

function ifaceKind(name: string, type: string): IfaceKind {
  if (type === "vlan") return "subinterface";
  if (type === "aggregate" || type === "redundant") return "aggregate";
  if (type === "loopback") return "loopback";
  if (type === "tunnel") return "tunnel";
  if (/^(mgmt|management|ha)\d*$/i.test(name)) return "mgmt";
  return "physical";
}

export function parseFortinet(text: string): ParsedDevice {
  const d = emptyDevice("fortinet");
  d.role = "firewall";
  const root = parseTree(text);

  const hdr = /^#config-version=([A-Z0-9]+)-(\d+\.\d+\.\d+)/m.exec(text);
  if (hdr) {
    d.model = hdr[1];
    d.osVersion = hdr[2];
  }

  const global = findConfigs(root, "system global")[0];
  if (global?.sets.hostname) d.hostname = global.sets.hostname[0];

  // zones first so interfaces can be tagged
  for (const z of entries(findConfigs(root, "system zone"))) {
    d.zones.push({ name: z.name, interfaces: z.sets.interface ?? [] });
  }

  const lagOf = new Map<string, string>();
  for (const e of entries(findConfigs(root, "system interface"))) {
    const type = e.sets.type?.[0] ?? "physical";
    const f = newIface(e.name, ifaceKind(e.name, type));
    f.description = (e.sets.description ?? e.sets.alias ?? []).join(" ");
    if (e.sets.alias && e.sets.description) f.description = `${e.sets.alias[0]} · ${e.sets.description.join(" ")}`;
    f.enabled = e.sets.status?.[0] !== "down";
    const ip = e.sets.ip;
    if (ip && isIpv4(ip[0]) && ip[0] !== "0.0.0.0") {
      const prefix = ip[1] ? maskToPrefix(ip[1]) : 32;
      if (prefix >= 0) f.ips.push({ address: ip[0], prefix });
    }
    if (e.sets.vlanid) {
      f.vlan = Number(e.sets.vlanid[0]);
      f.parent = e.sets.interface?.[0];
    }
    if (e.sets.speed && e.sets.speed[0] !== "auto") f.speed = e.sets.speed[0];
    if (e.sets.vdom && e.sets.vdom[0] !== "root") f.vrf = e.sets.vdom[0];
    f.mode = f.ips.length ? "routed" : "unknown";
    const zone = d.zones.find((z) => z.interfaces.includes(e.name));
    if (zone) f.zone = zone.name;

    for (const member of e.sets.member ?? []) lagOf.set(member, e.name);
    d.interfaces.push(f);
  }
  for (const f of d.interfaces) {
    const lag = lagOf.get(f.name);
    if (lag) f.lag = lag;
  }

  for (const r of entries(findConfigs(root, "router static"))) {
    if (r.sets.status?.[0] === "disable") continue;
    let dest = "0.0.0.0/0";
    if (r.sets.dst && isIpv4(r.sets.dst[0])) {
      const p = r.sets.dst[1] ? maskToPrefix(r.sets.dst[1]) : 32;
      if (p >= 0) dest = `${r.sets.dst[0]}/${p}`;
    }
    d.routes.push({
      destination: dest,
      nextHop: r.sets.gateway?.[0],
      iface: r.sets.device?.[0],
      distance: r.sets.distance ? Number(r.sets.distance[0]) : 10,
    });
  }

  if (findConfigs(root, "router ospf").some((c) => c.sets["router-id"] || findConfigs(c, "area").length)) d.protocols.push("OSPF");
  const bgp = findConfigs(root, "router bgp")[0];
  if (bgp && (bgp.sets.as || findConfigs(bgp, "neighbor").length)) {
    d.protocols.push(bgp.sets.as ? `BGP ${bgp.sets.as[0]}` : "BGP");
    for (const n of entries(findConfigs(bgp, "neighbor"))) {
      d.neighbors.push({ protocol: "BGP", address: n.name, remoteAs: n.sets["remote-as"]?.[0] });
    }
  }
  if (findConfigs(root, "router rip").some((c) => Object.keys(c.sets).length || c.children.length)) d.protocols.push("RIP");
  if (findConfigs(root, "router isis").some((c) => Object.keys(c.sets).length || c.children.length)) d.protocols.push("IS-IS");
  const sdwan = findConfigs(root, "system sdwan")[0];
  if (sdwan && (sdwan.sets.status?.[0] === "enable" || findConfigs(sdwan, "members").length)) d.protocols.push("SD-WAN");

  for (const v of entries([...findConfigs(root, "vpn ipsec phase1-interface"), ...findConfigs(root, "vpn ipsec phase1")])) {
    d.vpns.push({ name: v.name, remote: v.sets["remote-gw"]?.[0], iface: v.sets.interface?.[0] });
  }

  for (const p of entries(findConfigs(root, "firewall policy"))) {
    d.policies.push({
      name: p.sets.name?.[0] ?? `Policy ${p.name}`,
      from: p.sets.srcintf ?? [],
      to: p.sets.dstintf ?? [],
      source: p.sets.srcaddr ?? [],
      destination: p.sets.dstaddr ?? [],
      service: p.sets.service ?? [],
      action: p.sets.action?.[0] ?? "deny",
      enabled: p.sets.status?.[0] !== "disable",
    });
  }

  d.mgmtIp = pickMgmtIp(d);
  if (!d.interfaces.length) d.warnings.push("No 'config system interface' section was found.");
  return d;
}
