import { pickMgmtIp } from "./common";
import { emptyDevice, newIface, type Iface, type IfaceKind, type ParsedDevice } from "./types";
import { expandVlanList, isIpv4, maskToPrefix, parseCidr, unique } from "./util";

interface Block {
  head: string;
  lines: string[];
}

/** Splits an IOS / NX-OS config into top-level blocks (child lines are indented). */
function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || /^\s*!/.test(raw)) {
      if (!/^\s/.test(raw)) cur = null;
      continue;
    }
    if (/^\s/.test(raw) && cur) {
      cur.lines.push(raw.trim());
    } else {
      cur = { head: raw.trim(), lines: [] };
      blocks.push(cur);
    }
  }
  return blocks;
}

function ifaceKind(name: string): IfaceKind {
  const n = name.toLowerCase();
  if (/^vlan\d+/.test(n)) return "vlan";
  if (/^(loopback|lo)\d+/.test(n)) return "loopback";
  if (/^tunnel/.test(n)) return "tunnel";
  if (/^(port-channel|po)\d+/.test(n)) return "aggregate";
  if (/^(mgmt|management)/.test(n)) return "mgmt";
  if (/\.\d+$/.test(n)) return "subinterface";
  return "physical";
}

function parseInterface(name: string, lines: string[]): Iface {
  const kind = ifaceKind(name);
  const f = newIface(name, kind);
  if (kind === "vlan") f.vlan = Number(/(\d+)/.exec(name)![1]);
  if (kind === "subinterface") f.parent = name.replace(/\.\d+$/, "");
  let trunkExplicit: number[] = [];
  let hasTrunkList = false;
  let switchportOff = false;

  for (const l of lines) {
    let m: RegExpExecArray | null;
    if ((m = /^description\s+(.*)$/i.exec(l))) f.description = m[1].trim();
    else if (/^shutdown$/i.test(l)) f.enabled = false;
    else if (/^no shutdown$/i.test(l)) f.enabled = true;
    else if (/^no switchport$/i.test(l)) switchportOff = true;
    else if ((m = /^ip address\s+(\d+(?:\.\d+){3})\s+(\d+(?:\.\d+){3})/i.exec(l))) {
      const prefix = maskToPrefix(m[2]);
      if (prefix >= 0) f.ips.push({ address: m[1], prefix });
    } else if ((m = /^ip address\s+(\d+(?:\.\d+){3}\/\d+)/i.exec(l))) {
      const c = parseCidr(m[1]);
      if (c) f.ips.push(c);
    } else if ((m = /^switchport mode\s+(access|trunk)/i.exec(l))) {
      f.mode = m[1].toLowerCase() as "access" | "trunk";
    } else if ((m = /^switchport access vlan\s+(\d+)/i.exec(l))) {
      f.vlan = Number(m[1]);
      if (f.mode === "unknown") f.mode = "access";
    } else if ((m = /^switchport trunk native vlan\s+(\d+)/i.exec(l))) {
      f.nativeVlan = Number(m[1]);
    } else if ((m = /^switchport trunk allowed vlan\s+(.*)$/i.exec(l))) {
      const rest = m[1].trim();
      hasTrunkList = true;
      if (/^all$/i.test(rest)) f.trunkVlans = "all";
      else if (/^none$/i.test(rest)) trunkExplicit = [];
      else if (/^add\s+/i.test(rest)) trunkExplicit.push(...expandVlanList(rest.replace(/^add\s+/i, "")));
      else if (/^(remove|except)\s+/i.test(rest)) f.trunkVlans = "all";
      else trunkExplicit = expandVlanList(rest);
    } else if ((m = /^channel-group\s+(\d+)/i.exec(l))) {
      f.lag = `Port-channel${m[1]}`;
    } else if ((m = /^encapsulation dot1q\s+(\d+)/i.exec(l))) {
      f.vlan = Number(m[1]);
    } else if ((m = /^speed\s+(\S+)/i.exec(l))) {
      f.speed = m[1];
    } else if ((m = /^(?:ip )?vrf (?:forwarding|member)\s+(\S+)/i.exec(l))) {
      f.vrf = m[1];
    }
  }

  if (f.mode === "trunk" && f.trunkVlans !== "all") f.trunkVlans = hasTrunkList ? unique(trunkExplicit) : "all";
  if (f.vrf && /mgmt|management/i.test(f.vrf) && f.kind === "physical") f.kind = "mgmt";
  if (f.ips.length && f.mode === "unknown") f.mode = "routed";
  if (switchportOff && f.mode === "unknown") f.mode = "routed";
  return f;
}

export function parseCisco(text: string): ParsedDevice {
  const d = emptyDevice("cisco");
  const blocks = toBlocks(text);

  const soft = /^!\s*Software:\s*(.+)$/im.exec(text);
  const ver =
    /^version\s+(\S+)/im.exec(text) ??
    /Cisco IOS(?:-XE)? Software.*?Version\s+([^\s,]+)/i.exec(text) ??
    /system:\s+version\s+(\S+)/i.exec(text);
  d.osVersion = soft ? soft[1].trim() : ver ? ver[1] : "";

  const dev = /^!\s*Device:\s*(.+)$/im.exec(text);
  if (dev) d.model = dev[1].replace(/^Cisco\s+/i, "").trim();
  else {
    const mm = /\b(Catalyst\s*\d+\w*|WS-C[\w-]+|N\d+K[\w-]*|ISR\d+\w*|ASR\d+\w*)\b/i.exec(text);
    if (mm) d.model = mm[1];
  }

  for (const b of blocks) {
    let m: RegExpExecArray | null;
    if ((m = /^(?:hostname|switchname)\s+(\S+)/i.exec(b.head))) {
      d.hostname = m[1];
    } else if ((m = /^interface\s+(\S+)/i.exec(b.head))) {
      d.interfaces.push(parseInterface(m[1], b.lines));
    } else if ((m = /^vlan\s+(\d[\d,\-\s]*)$/i.exec(b.head))) {
      const ids = expandVlanList(m[1]);
      const nm = b.lines.map((l) => /^name\s+(.+)$/i.exec(l)).find(Boolean);
      for (const id of ids) {
        if (!d.vlans.some((v) => v.id === id)) {
          d.vlans.push({ id, name: ids.length === 1 && nm ? nm[1].trim() : `VLAN${String(id).padStart(4, "0")}` });
        }
      }
    } else if ((m = /^ip route\s+(?:vrf\s+(\S+)\s+)?(.+)$/i.exec(b.head))) {
      const t = m[2].split(/\s+/);
      let dest: string | null = null;
      let rest: string[] = [];
      if (isIpv4(t[0]) && isIpv4(t[1] ?? "")) {
        const p = maskToPrefix(t[1]);
        if (p >= 0) {
          dest = `${t[0]}/${p}`;
          rest = t.slice(2);
        }
      } else if (parseCidr(t[0])) {
        dest = t[0];
        rest = t.slice(1);
      }
      if (dest) {
        const nh = rest.find((x) => isIpv4(x));
        const iface = rest.find((x) => !isIpv4(x) && !/^\d+$/.test(x) && !/^(name|tag|permanent|track)$/i.test(x));
        const dist = rest.find((x, i) => /^\d+$/.test(x) && (i > 0 || !nh));
        d.routes.push({ destination: dest, nextHop: nh, iface, distance: dist ? Number(dist) : undefined, vrf: m[1] });
      }
    } else if ((m = /^ip default-gateway\s+(\S+)/i.exec(b.head)) && isIpv4(m[1])) {
      d.routes.push({ destination: "0.0.0.0/0", nextHop: m[1], distance: 1 });
    } else if ((m = /^router\s+(ospf|eigrp|bgp|rip|isis)\b\s*(\S*)/i.exec(b.head))) {
      const proto = m[1].toUpperCase();
      d.protocols.push(m[2] && proto !== "RIP" ? `${proto} ${m[2]}` : proto);
      if (proto === "BGP") {
        for (const l of b.lines) {
          const n = /^neighbor\s+(\S+)\s+remote-as\s+(\S+)/i.exec(l);
          if (n) d.neighbors.push({ protocol: "BGP", address: n[1], remoteAs: n[2] });
        }
      }
    }
  }

  for (const b of blocks) {
    const m = /^interface\s+(Tunnel\S+)/i.exec(b.head);
    if (!m) continue;
    const dst = b.lines.map((l) => /^tunnel destination\s+(\S+)/i.exec(l)).find(Boolean);
    d.vpns.push({ name: m[1], iface: m[1], remote: dst ? dst[1] : undefined });
  }

  const hasL2 = d.interfaces.some((i) => i.mode === "access" || i.mode === "trunk") || d.vlans.length > 0;
  d.role = hasL2 ? "switch" : d.interfaces.length ? "router" : "unknown";
  if (/^nameif\s/m.test(text) || /\bASA Version\b/.test(text)) d.role = "firewall";

  d.mgmtIp = pickMgmtIp(d);
  if (!d.interfaces.length) d.warnings.push("No interfaces were found. Check that this is an IOS / NX-OS running-config.");
  return d;
}
