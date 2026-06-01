"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  ToolContainer,
  ToolHeader,
  ToolButton,
  ToolTextarea,
} from "@/components/tools";
import {
  Terminal,
  Upload,
  Sparkles,
  Trash2,
  FileText,
  FileCode,
  XCircle,
  Activity,
  Server,
  Globe,
  Fingerprint,
  AlertTriangle,
  LayoutGrid,
  Share2,
  Monitor,
  Wifi,
  Radio,
  Zap,
  Layers,
  Map,
  CheckCircle2,
} from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

/* ─────────────────────────────────────────────
   Types & Interfaces
   ───────────────────────────────────────────── */

interface ParsedConfig {
  hostname: string;
  managementIp: string;
  brand: string;
  model: string;
  routingProtocols: string[];
  vlans: { id: number; name: string }[];
  interfaces: InterfaceInfo[];
}

interface InterfaceInfo {
  name: string;
  description: string;
  speed: string;
  duplex: string;
  status: "up" | "down" | "adminDown";
  ip: string;
  vlanAccess: number | null;
  vlanTrunkAllowed: number[];
  mode: "access" | "trunk" | "routed" | "unknown";
  mac: string;
  mtu: number;
  type: string;
}

interface VlanTopologyNode {
  id: string;
  label: string;
  type: "switch" | "vlan" | "router" | "host";
  group: string;
  connections: string[];
  ip?: string;
  subnetMask?: string;
  portIndex?: string;
}

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */

type ActiveTab = "SYSTEM" | "PORT_MAP" | "SCHEMA";

interface TabDef {
  id: ActiveTab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabDef[] = [
  { id: "SYSTEM", label: "System Overview", icon: Server },
  { id: "PORT_MAP", label: "Port Mapping", icon: LayoutGrid },
  { id: "SCHEMA", label: "Visual Schema", icon: Map },
];

/* ─────────────────────────────────────────────
    Multi-Vendor Config Parser (regex-only, offline)
    ───────────────────────────────────────────── */

type VendorType = "Cisco" | "Juniper" | "FortiGate" | "Unknown";

const SAMPLE_CONFIG = `! Device: Cisco Catalyst 9300
! Software: IOS-XE 17.3.1
hostname Core-Switch-01
!
interface Vlan1
 ip address 192.168.1.1 255.255.255.0
 no shutdown
!
interface GigabitEthernet0/1
 description Uplink to Core-Router-01
 speed 1000
 duplex full
 no shutdown
 switchport mode trunk
 switchport trunk allowed vlan 1,10,20,30,100
!
interface GigabitEthernet0/2
 description Access Port - Floor 1 Conference
 speed 100
 duplex auto
 no shutdown
 switchport mode access
 switchport access vlan 10
!
interface GigabitEthernet0/3
 description Access Port - Floor 2 Engineering
 speed 1000
 duplex full
 shutdown
 switchport mode access
 switchport access vlan 20
!
interface GigabitEthernet0/4
 description Server Farm - DMZ Link
 speed 1000
 duplex full
 no shutdown
 switchport mode trunk
 switchport trunk allowed vlan 100,200,300
!
interface FastEthernet0/1
 description Legacy Printer VLAN
 speed 100
 duplex full
 no shutdown
 switchport mode access
 switchport access vlan 30
!
interface TenGigabitEthernet1/1
 description Core Stack Uplink
 speed 10000
 duplex full
 no shutdown
 switchport mode trunk
 switchport trunk allowed vlan all
!
interface Vlan10
 description Engineering Network
 ip address 10.10.10.1 255.255.255.0
 no shutdown
!
interface Vlan20
 description Data Analytics Network
 ip address 10.10.20.1 255.255.255.0
 no shutdown
!
interface Vlan100
 description DMZ Public Services
 ip address 10.10.100.1 255.255.255.0
 no shutdown
!
router ospf 1
 network 10.0.0.0 0.255.255.255 area 0
!
ip route 0.0.0.0 0.0.0.0 192.168.1.254
!
snmp-server community public RO
!
ntp server pool.ntp.org
!
end`;

function detectVendor(raw: string): VendorType {
  const lower = raw.toLowerCase();
  
  // Check for Juniper patterns
  if (lower.includes('set hostname') || 
      lower.includes('set vlans') || 
      lower.includes('set interfaces') ||
      lower.includes('set protocols') ||
      lower.includes('set routing-options') ||
      lower.includes('interfaces {') ||
      lower.includes('protocols {') ||
      lower.includes('vlans {') ||
      lower.includes('system {')) {
    return "Juniper";
  }
  
  // Check for FortiGate patterns
  if (lower.includes('config system global') ||
      lower.includes('config system interface') ||
      lower.includes('config router ospf') ||
      lower.includes('config router static') ||
      lower.includes('config router bgp')) {
    return "FortiGate";
  }
  
  // Default to Cisco for backward compatibility
  if (lower.includes('hostname ') ||
      lower.includes('interface ') ||
      lower.includes('switchport') ||
      lower.includes('router ospf') ||
      lower.includes('ip route')) {
    return "Cisco";
  }
  
  return "Unknown";
}

function parseCiscoConfig(raw: string): ParsedConfig {
  const lines = raw.split("\n");
  const cfg: ParsedConfig = {
    hostname: "",
    managementIp: "",
    brand: "Cisco",
    model: "Catalyst 9300",
    routingProtocols: [],
    vlans: [],
    interfaces: [],
  };

  const ciscoModelMatch = raw.match(/(?:Catalyst|Nexus|ISR|ASR|Cisco\s+Catalyst|Cisco\s+Nexus|Cisco\s+ISR|Cisco\s+ASR)\s*(\d+[a-zA-Z0-9\-]*)/i);
  if (ciscoModelMatch) {
    cfg.model = ciscoModelMatch[0];
  } else {
    const genericMatch = raw.match(/(?:Model|Device|Hardware|Platform|Switch|Router)\s*:\s*([a-zA-Z0-9\-]+)/i);
    if (genericMatch) {
      cfg.model = genericMatch[1];
    }
  }

  let currentInterface: Partial<InterfaceInfo> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "!" || line === "end") {
      if (currentInterface?.name) {
        cfg.interfaces.push(finalizeInterface(currentInterface));
      }
      currentInterface = null;
      continue;
    }

    // Hostname
    const hnMatch = line.match(/^hostname\s+(.+)/i);
    if (hnMatch) { cfg.hostname = hnMatch[1].trim(); continue; }

    // VLAN definition
    const vlanMatch = line.match(/^vlan\s+(\d+)/i);
    if (vlanMatch) {
      const id = parseInt(vlanMatch[1]);
      const nameLine = lines[lines.indexOf(rawLine) + 1]?.trim() || "";
      const nameMatch = nameLine.match(/^name\s+(.+)/i);
      cfg.vlans.push({ id, name: nameMatch ? nameMatch[1].trim() : `VLAN ${id}` });
      continue;
    }

    // Routing protocols
    if (line.match(/^router\s+(ospf|bgp|eigrp|rip)\s+/i)) {
      const proto = line.match(/^router\s+(ospf|bgp|eigrp|rip)/i)?.[1].toUpperCase() || "";
      if (!cfg.routingProtocols.includes(proto)) cfg.routingProtocols.push(proto);
      continue;
    }
    if (line.match(/^ip\s+route\s+/i)) {
      if (!cfg.routingProtocols.includes("STATIC")) cfg.routingProtocols.push("STATIC");
      continue;
    }

    // Interface block start
    const ifMatch = line.match(/^interface\s+(.+)/i);
    if (ifMatch) {
      if (currentInterface?.name) {
        cfg.interfaces.push(finalizeInterface(currentInterface));
      }
      const ifName = ifMatch[1].trim();
      const isVlan = ifName.match(/^Vlan(\d+)/i);
      currentInterface = {
        name: ifName,
        description: "",
        speed: "auto",
        duplex: "auto",
        status: "up",
        ip: "",
        vlanAccess: null,
        vlanTrunkAllowed: [],
        mode: isVlan ? "routed" : "unknown",
        mac: "",
        mtu: 1500,
        type: isVlan ? "SVI" : ifName.match(/^(Gigabit|Fast|TenGigabit|Ethernet)/i)?.[1] || "Other",
      };
      continue;
    }

    if (!currentInterface) continue;

    // Interface properties
    const descMatch = line.match(/^description\s+(.+)/i);
    if (descMatch) { currentInterface.description = descMatch[1].trim(); continue; }

    const speedMatch = line.match(/^speed\s+([\d]+)/i);
    if (speedMatch) { currentInterface.speed = speedMatch[1]; continue; }

    const duplexMatch = line.match(/^duplex\s+(full|half|auto)/i);
    if (duplexMatch) { currentInterface.duplex = duplexMatch[1].toLowerCase(); continue; }

    if (line.match(/^shutdown/i)) { currentInterface.status = "adminDown"; continue; }
    if (line.match(/^no shutdown/i)) { currentInterface.status = "up"; continue; }

    const ipMatch = line.match(/^ip\s+address\s+([\d.]+)\s+([\d.]+)/i);
    if (ipMatch) {
      currentInterface.ip = `${ipMatch[1]}/${cidrFromMask(ipMatch[2])}`;
      if (currentInterface.name?.match(/^Vlan1/i)) {
        cfg.managementIp = ipMatch[1];
      }
      continue;
    }

    if (line.match(/^switchport\s+mode\s+access/i)) { currentInterface.mode = "access"; continue; }
    if (line.match(/^switchport\s+mode\s+trunk/i)) { currentInterface.mode = "trunk"; continue; }

    const accessVlan = line.match(/^switchport\s+access\s+vlan\s+(\d+)/i);
    if (accessVlan) { currentInterface.vlanAccess = parseInt(accessVlan[1]); continue; }

    const trunkVlan = line.match(/^switchport\s+trunk\s+allowed\s+vlan\s+(.+)/i);
    if (trunkVlan) {
      const vlanStr = trunkVlan[1].trim();
      if (vlanStr.toLowerCase() === "all") {
        currentInterface.vlanTrunkAllowed = [1, 10, 20, 30, 100, 200, 300];
      } else {
        currentInterface.vlanTrunkAllowed = vlanStr.split(",").map(v => parseInt(v.trim())).filter(n => !isNaN(n));
      }
      continue;
    }

    const macMatch = line.match(/^mac-address\s+([\da-fA-F.]+)/i);
    if (macMatch) { currentInterface.mac = macMatch[1]; continue; }

    const mtuMatch = line.match(/^mtu\s+(\d+)/i);
    if (mtuMatch) { currentInterface.mtu = parseInt(mtuMatch[1]); }
  }

  // Flush last interface
  if (currentInterface?.name) {
    cfg.interfaces.push(finalizeInterface(currentInterface));
  }

  return cfg;
}

function parseJuniperConfig(raw: string): ParsedConfig {
  const cfg: ParsedConfig = {
    hostname: "",
    managementIp: "",
    brand: "Juniper",
    model: "SRX300",
    routingProtocols: [],
    vlans: [],
    interfaces: [],
  };

  const juniperModelMatch = raw.match(/model\s+(\S+);/i) || 
                            raw.match(/\b(SRX\d+|EX\d+|MX\d+|QFX\d+|PTX\d+|ACX\d+)\b/i) ||
                            raw.match(/(?:SRX|EX|MX|QFX|PTX|ACX)-\d+[a-zA-Z0-9\-]*/i);
  if (juniperModelMatch) {
    cfg.model = (juniperModelMatch[1] || juniperModelMatch[0]).replace(/[;"]/g, "").trim();
  }

  const flatLines: string[] = [];
  const lines = raw.split("\n");
  const isBracketed = raw.includes("{") && raw.includes("}");

  if (isBracketed) {
    const pathStack: string[] = [];
    for (const rawLine of lines) {
      let line = rawLine.replace(/#.*/g, "").trim();
      line = line.replace(/\/\*.*?\*\//g, "").trim();
      if (!line) continue;

      if (line.startsWith("}")) {
        pathStack.pop();
        const rest = line.substring(1).trim();
        if (rest && rest !== ";") {
          line = rest;
        } else {
          continue;
        }
      }

      if (line.includes("{")) {
        const parts = line.split("{");
        const pathPart = parts[0].trim();
        if (pathPart) {
          pathStack.push(pathPart);
        }
        const inner = parts.slice(1).join("{").trim();
        if (inner && inner !== "}") {
          line = inner;
        } else {
          continue;
        }
      }

      if (line.endsWith(";")) {
        const leaf = line.substring(0, line.length - 1).trim();
        if (leaf) {
          const fullPath = [...pathStack, leaf].join(" ");
          flatLines.push(fullPath);
        }
      } else {
        flatLines.push([...pathStack, line].join(" "));
      }
    }
  } else {
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("set ")) {
        flatLines.push(line.substring(4).trim());
      } else {
        flatLines.push(line);
      }
    }
  }

  const interfaceMap = new globalThis.Map<string, Partial<InterfaceInfo>>();
  const getInterface = (name: string): Partial<InterfaceInfo> => {
    if (!interfaceMap.has(name)) {
      const isVlan = name.match(/^(vlan|irb)/i);
      interfaceMap.set(name, {
        name: name,
        description: "",
        speed: "auto",
        duplex: "auto",
        status: "up",
        ip: "",
        vlanAccess: null,
        vlanTrunkAllowed: [],
        mode: isVlan ? "routed" : "unknown",
        mac: "",
        mtu: 1500,
        type: isVlan ? "SVI" : name.match(/^(ge|xe|et|ae|fe|port)/i)?.[1] || "Other",
      });
    }
    return interfaceMap.get(name)!;
  };

  for (const line of flatLines) {
    const hnMatch = line.match(/(?:system\s+)?host-name\s+(\S+)/i);
    if (hnMatch) {
      cfg.hostname = hnMatch[1].replace(/["';]/g, "").trim();
      continue;
    }

    const vlanIdMatch = line.match(/^vlans\s+(\S+)\s+vlan-id\s+(\d+)/i);
    if (vlanIdMatch) {
      const name = vlanIdMatch[1];
      const id = parseInt(vlanIdMatch[2]);
      const existing = cfg.vlans.find(v => v.id === id);
      if (existing) {
        existing.name = name;
      } else {
        cfg.vlans.push({ id, name });
      }
      continue;
    }

    const vlanDescMatch = line.match(/^vlans\s+(\S+)\s+description\s+["']?(.+?)["']?$/i);
    if (vlanDescMatch) {
      const name = vlanDescMatch[1];
      const desc = vlanDescMatch[2];
      const existing = cfg.vlans.find(v => v.name === name || v.id.toString() === name);
      if (existing) {
        existing.name = `${desc} (VLAN ${existing.id})`;
      }
      continue;
    }

    if (line.match(/^protocols\s+ospf/i)) {
      if (!cfg.routingProtocols.includes("OSPF")) cfg.routingProtocols.push("OSPF");
    }
    if (line.match(/^protocols\s+bgp/i)) {
      if (!cfg.routingProtocols.includes("BGP")) cfg.routingProtocols.push("BGP");
    }
    if (line.match(/^routing-options\s+static/i) || line.match(/^static\s+route/i)) {
      if (!cfg.routingProtocols.includes("STATIC")) cfg.routingProtocols.push("STATIC");
    }

    const ifMatch = line.match(/^interfaces\s+(\S+)/i);
    if (ifMatch) {
      const ifName = ifMatch[1];
      const iface = getInterface(ifName);

      const descM = line.match(/description\s+["']?(.+?)["']?$/i);
      if (descM) {
        iface.description = descM[1].trim();
      }

      if (line.match(/\bdisable\b/i)) {
        iface.status = "adminDown";
      }

      const speedM = line.match(/speed\s+(\S+)/i);
      if (speedM) {
        iface.speed = speedM[1].replace(/[mGg]/g, "");
      }

      const modeM = line.match(/(?:interface-mode|port-mode)\s+(access|trunk)/i);
      if (modeM) {
        iface.mode = modeM[1].toLowerCase() as "access" | "trunk";
      }

      const membersM = line.match(/vlan\s+members\s+\[?\s*([^\]]+?)\s*\]?$/i);
      if (membersM) {
        const val = membersM[1].trim();
        const vlanNames = val.split(/\s+/);
        vlanNames.forEach(vName => {
          const id = parseInt(vName);
          if (!isNaN(id)) {
            if (iface.mode === "access") {
              iface.vlanAccess = id;
            } else {
              if (iface.vlanTrunkAllowed && !iface.vlanTrunkAllowed.includes(id)) {
                iface.vlanTrunkAllowed.push(id);
              }
            }
          } else {
            const matchingVlan = cfg.vlans.find(v => v.name === vName);
            if (matchingVlan) {
              if (iface.mode === "access") {
                iface.vlanAccess = matchingVlan.id;
              } else {
                if (iface.vlanTrunkAllowed && !iface.vlanTrunkAllowed.includes(matchingVlan.id)) {
                  iface.vlanTrunkAllowed.push(matchingVlan.id);
                }
              }
            } else {
              const numMatch = vName.match(/\d+/);
              if (numMatch) {
                const parsedId = parseInt(numMatch[0]);
                if (iface.mode === "access") {
                  iface.vlanAccess = parsedId;
                } else {
                  if (iface.vlanTrunkAllowed && !iface.vlanTrunkAllowed.includes(parsedId)) {
                    iface.vlanTrunkAllowed.push(parsedId);
                  }
                }
              }
            }
          }
        });
      }

      const ipM = line.match(/address\s+([\d.]+)\/(\d+)/i);
      if (ipM) {
        iface.ip = `${ipM[1]}/${ipM[2]}`;
        iface.mode = "routed";
        if (!cfg.managementIp) {
          cfg.managementIp = ipM[1];
        }
      }
    }
  }

  interfaceMap.forEach(iface => {
    cfg.interfaces.push(finalizeInterface(iface));
  });

  return cfg;
}

function parseFortiGateConfig(raw: string): ParsedConfig {
  const lines = raw.split("\n");
  const cfg: ParsedConfig = {
    hostname: "",
    managementIp: "",
    brand: "FortiGate",
    model: "FortiGate 401E",
    routingProtocols: [],
    vlans: [],
    interfaces: [],
  };

  const fgModelMatch = raw.match(/#config-version=([A-Za-z0-9\-]+)/i) ||
                       raw.match(/#model\s*[:=]\s*(\S+)/i) ||
                       raw.match(/\b(FortiGate-\d+[A-Z]*|FG-\d+[A-Z]*|FortiGate\s+\d+[A-Z]*)\b/i);
  if (fgModelMatch) {
    const m = (fgModelMatch[1] || fgModelMatch[0]).trim();
    if (m.toUpperCase().startsWith("FG") && !m.toUpperCase().startsWith("FGR")) {
      cfg.model = `FortiGate ${m.substring(2)}`;
    } else if (m.toUpperCase().startsWith("FORTIGATE-")) {
      cfg.model = `FortiGate ${m.substring(10)}`;
    } else {
      cfg.model = m;
    }
  }

  let inSystemGlobal = false;
  let inSystemInterface = false;
  let currentInterface: Partial<InterfaceInfo> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('config system global')) {
      inSystemGlobal = true;
      inSystemInterface = false;
      continue;
    }
    if (line.startsWith('config system interface')) {
      inSystemGlobal = false;
      inSystemInterface = true;
      continue;
    }
    if (line.startsWith('config router ospf')) {
      inSystemGlobal = false;
      inSystemInterface = false;
      if (!cfg.routingProtocols.includes("OSPF")) cfg.routingProtocols.push("OSPF");
      continue;
    }
    if (line.startsWith('config router static')) {
      inSystemGlobal = false;
      inSystemInterface = false;
      if (!cfg.routingProtocols.includes("STATIC")) cfg.routingProtocols.push("STATIC");
      continue;
    }
    if (line.startsWith('config router bgp')) {
      inSystemGlobal = false;
      inSystemInterface = false;
      if (!cfg.routingProtocols.includes("BGP")) cfg.routingProtocols.push("BGP");
      continue;
    }
    if (line === 'end') {
      inSystemGlobal = false;
      inSystemInterface = false;
      if (currentInterface?.name) {
        cfg.interfaces.push(finalizeInterface(currentInterface));
        currentInterface = null;
      }
      continue;
    }

    if (inSystemGlobal && line.startsWith('set hostname')) {
      const match = line.match(/^set\s+hostname\s+["']?(.+?)["']?$/);
      if (match) {
        cfg.hostname = match[1].trim();
      }
      continue;
    }

    if (inSystemInterface) {
      if (line.startsWith('edit')) {
        if (currentInterface?.name) {
          cfg.interfaces.push(finalizeInterface(currentInterface));
        }
        const match = line.match(/^edit\s+["']?(.+?)["']?$/);
        const name = match ? match[1] : "Unknown";
        currentInterface = {
          name: name,
          description: "",
          speed: "auto",
          duplex: "auto",
          status: "up",
          ip: "",
          vlanAccess: null,
          vlanTrunkAllowed: [],
          mode: "unknown",
          mac: "",
          mtu: 1500,
          type: name.match(/^(port|wan|lan|dmz|ssl|ssl-vlan|vlan)/i)?.[1] || "Other",
        };
        continue;
      }

      if (currentInterface) {
        if (line.startsWith('set alias')) {
          const match = line.match(/^set\s+alias\s+["']?(.+?)["']?$/);
          if (match) currentInterface.description = match[1].trim();
        }
        else if (line.startsWith('set ip')) {
          const match = line.match(/^set\s+ip\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)/);
          if (match) {
            const ip = match[1];
            const netmask = match[2];
            currentInterface.ip = `${ip}/${cidrFromMask(netmask)}`;
            currentInterface.mode = "routed";
            if (!cfg.managementIp) {
              cfg.managementIp = ip;
            }
          }
        }
        else if (line.startsWith('set status')) {
          const match = line.match(/^set\s+status\s+(up|down)/i);
          if (match) currentInterface.status = match[1].toLowerCase() as "up" | "down";
        }
        else if (line.startsWith('set vlanid')) {
          const match = line.match(/^set\s+vlanid\s+(\d+)/);
          if (match) {
            const vlanId = parseInt(match[1]);
            currentInterface.vlanAccess = vlanId;
            currentInterface.mode = "access";
            if (!cfg.vlans.some(v => v.id === vlanId)) {
              cfg.vlans.push({ id: vlanId, name: currentInterface.name || `VLAN ${vlanId}` });
            }
          }
        }
        else if (line === 'next') {
          cfg.interfaces.push(finalizeInterface(currentInterface));
          currentInterface = null;
        }
      }
    }
  }

  if (currentInterface?.name) {
    cfg.interfaces.push(finalizeInterface(currentInterface));
  }

  return cfg;
}

function parseRunningConfig(raw: string): ParsedConfig {
  const vendor = detectVendor(raw);
  
  switch (vendor) {
    case "Cisco":
      return parseCiscoConfig(raw);
    case "Juniper":
      return parseJuniperConfig(raw);
    case "FortiGate":
      return parseFortiGateConfig(raw);
    default:
      return parseCiscoConfig(raw);
  }
}

function finalizeInterface(iface: Partial<InterfaceInfo>): InterfaceInfo {
  return {
    name: iface.name || "Unknown",
    description: iface.description || "",
    speed: iface.speed || "auto",
    duplex: iface.duplex || "auto",
    status: iface.status || "down",
    ip: iface.ip || "",
    vlanAccess: iface.vlanAccess ?? null,
    vlanTrunkAllowed: iface.vlanTrunkAllowed || [],
    mode: iface.mode || "unknown",
    mac: iface.mac || "",
    mtu: iface.mtu || 1500,
    type: iface.type || "Other",
  };
}

function cidrFromMask(mask: string): number {
  const octets = mask.split(".").map(Number);
  let bits = 0;
  for (const octet of octets) {
    bits += (octet.toString(2).match(/1/g) || []).length;
  }
  return bits;
}

/* ─────────────────────────────────────────────
   Topology Builder (pure function)
   ───────────────────────────────────────────── */

function maskFromCidr(cidr: number): string {
  const bits = Math.min(Math.max(cidr, 0), 32);
  const octets = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const shift = 24 - i * 8;
    if (bits > shift) {
      const localBits = Math.min(bits - shift, 8);
      octets[i] = 256 - Math.pow(2, 8 - localBits);
    }
  }
  return octets.join(".");
}

function buildTopology(cfg: ParsedConfig): VlanTopologyNode[] {
  const nodes: VlanTopologyNode[] = [];
  const nodeMap = new Set<string>();

  // Root switch node
  const switchId = "sw-core";
  let swIp = "";
  let swMask = "";
  if (cfg.managementIp) {
    swIp = cfg.managementIp;
    const mgmtIface = cfg.interfaces.find(i => i.ip && i.ip.startsWith(cfg.managementIp));
    if (mgmtIface) {
      const [, cidrPart] = mgmtIface.ip.split("/");
      swMask = maskFromCidr(parseInt(cidrPart || "24"));
    } else {
      swMask = "255.255.255.0";
    }
  }

  nodes.push({
    id: switchId,
    label: cfg.hostname || "Core-Switch",
    type: "switch",
    group: "infra",
    connections: [],
    ip: swIp || undefined,
    subnetMask: swMask || undefined,
    portIndex: "Mgmt"
  });
  nodeMap.add(switchId);

  // VLAN nodes
  for (const vlan of cfg.vlans) {
    const vlanId = `vlan-${vlan.id}`;
    
    // Find matching SVI interface to assign IP / Mask
    const svi = cfg.interfaces.find(i => i.type === "SVI" && (i.name.toLowerCase() === `vlan${vlan.id}` || i.name.toLowerCase() === `vlan ${vlan.id}` || i.name.toLowerCase() === `irb.${vlan.id}`));
    let ip = "";
    let mask = "";
    if (svi && svi.ip) {
      const [ipPart, cidrPart] = svi.ip.split("/");
      ip = ipPart;
      mask = maskFromCidr(parseInt(cidrPart || "24"));
    }

    if (!nodeMap.has(vlanId)) {
      nodes.push({
        id: vlanId,
        label: `${vlan.name} (VLAN ${vlan.id})`,
        type: "vlan",
        group: "vlan",
        connections: [switchId],
        ip: ip || undefined,
        subnetMask: mask || undefined,
        portIndex: svi ? svi.name : undefined
      });
      nodeMap.add(vlanId);
      const swNode = nodes.find(n => n.id === switchId);
      if (swNode && !swNode.connections.includes(vlanId)) swNode.connections.push(vlanId);
    }
  }

  // Infer VLANs from interfaces not explicitly defined
  const seenVlans = new Set(cfg.vlans.map(v => v.id));
  for (const intf of cfg.interfaces) {
    if (intf.vlanAccess !== null && !seenVlans.has(intf.vlanAccess)) {
      const vlanId = `vlan-${intf.vlanAccess}`;
      
      const svi = cfg.interfaces.find(i => i.type === "SVI" && (i.name.toLowerCase() === `vlan${intf.vlanAccess}` || i.name.toLowerCase() === `vlan ${intf.vlanAccess}` || i.name.toLowerCase() === `irb.${intf.vlanAccess}`));
      let ip = "";
      let mask = "";
      if (svi && svi.ip) {
        const [ipPart, cidrPart] = svi.ip.split("/");
        ip = ipPart;
        mask = maskFromCidr(parseInt(cidrPart || "24"));
      }

      if (!nodeMap.has(vlanId)) {
        nodes.push({
          id: vlanId,
          label: `Inferred VLAN ${intf.vlanAccess}`,
          type: "vlan",
          group: "vlan",
          connections: [switchId],
          ip: ip || undefined,
          subnetMask: mask || undefined,
          portIndex: svi ? svi.name : undefined
        });
        nodeMap.add(vlanId);
        const swNode = nodes.find(n => n.id === switchId);
        if (swNode && !swNode.connections.includes(vlanId)) swNode.connections.push(vlanId);
      }
      seenVlans.add(intf.vlanAccess);
    }
    for (const vlanId of intf.vlanTrunkAllowed) {
      if (!seenVlans.has(vlanId)) {
        const vId = `vlan-${vlanId}`;
        if (!nodeMap.has(vId)) {
          nodes.push({ id: vId, label: `VLAN ${vlanId}`, type: "vlan", group: "vlan", connections: [switchId] });
          nodeMap.add(vId);
          const swNode = nodes.find(n => n.id === switchId);
          if (swNode && !swNode.connections.includes(vId)) swNode.connections.push(vId);
        }
      }
    }
  }

  // Router node if routing enabled or static routes
  if (cfg.routingProtocols.length > 0) {
    const routerId = "router-core";
    let rIp = "";
    let rMask = "";
    let rPort = "";

    // Try to find router-id or routed interface
    const routed = cfg.interfaces.find(i => i.mode === "routed" && i.ip && i.type !== "SVI");
    if (routed) {
      const [ipPart, cidrPart] = routed.ip.split("/");
      rIp = ipPart;
      rMask = maskFromCidr(parseInt(cidrPart || "24"));
      rPort = routed.name;
    } else if (cfg.managementIp) {
      // Default router gateway is often .254 or similar on the management subnet
      const octets = cfg.managementIp.split(".");
      if (octets.length === 4) {
        octets[3] = "254";
        rIp = octets.join(".");
        rMask = "255.255.255.0";
        rPort = "Core-Link";
      }
    }

    if (!nodeMap.has(routerId)) {
      nodes.push({
        id: routerId,
        label: "Core Router",
        type: "router",
        group: "infra",
        connections: [switchId],
        ip: rIp || undefined,
        subnetMask: rMask || undefined,
        portIndex: rPort || undefined
      });
      nodeMap.add(routerId);
      const swNode = nodes.find(n => n.id === switchId);
      if (swNode && !swNode.connections.includes(routerId)) swNode.connections.push(routerId);
    }
  }

  // Host nodes from access ports
  let hostCount = 0;
  for (const intf of cfg.interfaces) {
    if ((intf.mode === "access" || intf.mode === "unknown" || intf.mode === "routed") && intf.status === "up" && intf.type !== "SVI") {
      const hostId = `host-${intf.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
      if (!nodeMap.has(hostId)) {
        const vlanTag = intf.vlanAccess ? ` (VLAN ${intf.vlanAccess})` : "";
        
        let hostIp = "";
        let hostMask = "";
        
        if (intf.ip) {
          const [ipPart, cidrPart] = intf.ip.split("/");
          hostIp = ipPart;
          hostMask = maskFromCidr(parseInt(cidrPart || "24"));
        } else if (intf.vlanAccess !== null) {
          // Try to find SVI for this VLAN to base the host IP on
          const parentSvi = cfg.interfaces.find(i => i.type === "SVI" && (i.name.toLowerCase() === `vlan${intf.vlanAccess}` || i.name.toLowerCase() === `vlan ${intf.vlanAccess}` || i.name.toLowerCase() === `irb.${intf.vlanAccess}`));
          if (parentSvi && parentSvi.ip) {
            const [sviIp, sviCidr] = parentSvi.ip.split("/");
            const octets = sviIp.split(".");
            if (octets.length === 4) {
              hostCount++;
              octets[3] = (50 + hostCount).toString();
              hostIp = octets.join(".");
              hostMask = maskFromCidr(parseInt(sviCidr || "24"));
            }
          }
        }

        nodes.push({
          id: hostId,
          label: `${intf.name}${vlanTag}`,
          type: "host",
          group: intf.vlanAccess ? `vlan-${intf.vlanAccess}` : "default",
          connections: [switchId],
          ip: hostIp || undefined,
          subnetMask: hostMask || undefined,
          portIndex: intf.name
        });
        nodeMap.add(hostId);
      }
    }
  }

  return nodes;
}

/* ─────────────────────────────────────────────
   Topology Map Component (Absolute + SVG connectors)
   ───────────────────────────────────────────── */

function TopologicalMap({ nodes }: { nodes: VlanTopologyNode[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<"RADIAL" | "TREE">("RADIAL");

  const dragInfo = useRef<{
    isPanning: boolean;
    draggedNodeId: string | null;
    startX: number;
    startY: number;
  }>({
    isPanning: false,
    draggedNodeId: null,
    startX: 0,
    startY: 0,
  });

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const width = 800;
  const height = 600;

  useEffect(() => {
    const cx = width / 2;
    const cy = height / 2;

    const switches = nodes.filter(n => n.type === 'switch');
    const vlans = nodes.filter(n => n.type === 'vlan');
    const hosts = nodes.filter(n => n.type === 'host');
    const routers = nodes.filter(n => n.type === 'router');

    const newPositions: Record<string, { x: number; y: number }> = {};

    if (viewMode === "TREE") {
      // 1. Routers at the top
      routers.forEach((r, i) => {
        newPositions[r.id] = {
          x: cx + (i - (routers.length - 1) / 2) * 180,
          y: 80
        };
      });

      // 2. Core switch in the middle-top
      if (switches.length > 0) {
        newPositions[switches[0].id] = { x: cx, y: 180 };
      }

      // 3. VLANs spaced out horizontally below switch
      const vlanY = 320;
      vlans.forEach((v, i) => {
        const xPos = cx + (i - (vlans.length - 1) / 2) * (width / Math.max(vlans.length, 1) - 40);
        newPositions[v.id] = {
          x: xPos,
          y: vlanY
        };
      });

      // 4. Hosts spaced out below their parent VLANs
      const hostY = 480;
      vlans.forEach((vlanNode) => {
        const vlanHosts = hosts.filter(h => h.group === vlanNode.id);
        const parentPos = newPositions[vlanNode.id] || { x: cx, y: vlanY };
        
        vlanHosts.forEach((hostNode, idx) => {
          const offset = (idx - (vlanHosts.length - 1) / 2) * 80;
          newPositions[hostNode.id] = {
            x: parentPos.x + offset,
            y: hostY
          };
        });
      });

      // Unassociated hosts (directly connected to switch)
      const orphanHosts = hosts.filter(h => h.group !== "vlan-" && !vlans.some(v => v.id === h.group));
      orphanHosts.forEach((h, idx) => {
        const offset = (idx - (orphanHosts.length - 1) / 2) * 80;
        newPositions[h.id] = {
          x: cx + offset,
          y: hostY
        };
      });
    } else {
      // RADIAL VIEW
      if (switches.length > 0) {
        newPositions[switches[0].id] = { x: cx, y: cy };
      }

      routers.forEach((r, i) => {
        newPositions[r.id] = {
          x: cx + (i - (routers.length - 1) / 2) * 150,
          y: cy - 180
        };
      });

      const vRadius = 160;
      vlans.forEach((v, i) => {
        const angle = (i / (vlans.length || 1)) * 2 * Math.PI - Math.PI / 2;
        newPositions[v.id] = {
          x: cx + vRadius * Math.cos(angle),
          y: cy + vRadius * Math.sin(angle)
        };
      });

      hosts.forEach((h) => {
        const parentId = h.group;
        const parentPos = newPositions[parentId] || newPositions[switches[0]?.id] || { x: cx, y: cy };

        const siblings = hosts.filter(host => host.group === h.group);
        const index = siblings.findIndex(s => s.id === h.id);
        const hRadius = 95;

        const angleOffset = Math.atan2(parentPos.y - cy, parentPos.x - cx);
        const spread = Math.PI / 1.5;
        const startAngle = angleOffset - spread / 2;
        const step = siblings.length > 1 ? spread / (siblings.length - 1) : 0;
        const angle = startAngle + index * step;

        newPositions[h.id] = {
          x: parentPos.x + hRadius * Math.cos(angle),
          y: parentPos.y + hRadius * Math.sin(angle)
        };
      });
    }

    nodes.forEach(n => {
      if (!newPositions[n.id]) {
        newPositions[n.id] = { x: cx + (Math.random() - 0.5) * 200, y: cy + (Math.random() - 0.5) * 200 };
      }
    });

    setPositions(newPositions);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [nodes, viewMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(zoom, zoom);

      drawGrid(ctx);

      nodes.forEach(node => {
        const start = positions[node.id];
        if (!start) return;

        node.connections.forEach(targetId => {
          const end = positions[targetId];
          if (!end) return;

          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          const midX = (start.x + end.x) / 2;
          ctx.bezierCurveTo(midX, start.y, midX, end.y, end.x, end.y);
          ctx.strokeStyle = node.id === hoveredNodeId || targetId === hoveredNodeId
            ? "rgba(239, 68, 68, 0.7)"
            : "rgba(255, 255, 255, 0.15)";
          ctx.lineWidth = node.id === hoveredNodeId || targetId === hoveredNodeId ? 2.5 : 1.5;
          
          if (node.id === hoveredNodeId || targetId === hoveredNodeId) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = "rgba(239, 68, 68, 0.5)";
          } else {
            ctx.shadowBlur = 0;
          }
          
          ctx.stroke();
          ctx.shadowBlur = 0;
        });
      });

      nodes.forEach(node => {
        const pos = positions[node.id];
        if (!pos) return;

        const isHovered = node.id === hoveredNodeId;
        drawNode(ctx, node, pos.x, pos.y, isHovered);
      });

      ctx.restore();
    };

    render();
  }, [nodes, positions, zoom, panOffset, hoveredNodeId]);

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const gridSize = 40;
    const buffer = 1000;
    const startX = -buffer;
    const endX = width + buffer;
    const startY = -buffer;
    const endY = height + buffer;

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;

    for (let x = startX; x < endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y < endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(width/2, height/2, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fill();
  };

  const drawNode = (ctx: CanvasRenderingContext2D, node: VlanTopologyNode, x: number, y: number, isHovered: boolean) => {
    let color = "#ef4444";
    let border = "rgba(239, 68, 68, 0.4)";

    if (node.type === "vlan") {
      color = "#c084fc";
      border = "rgba(192, 132, 252, 0.4)";
    } else if (node.type === "router") {
      color = "#fbbf24";
      border = "rgba(251, 191, 36, 0.4)";
    } else if (node.type === "host") {
      color = "#34d399";
      border = "rgba(52, 211, 153, 0.3)";
    }

    ctx.save();
    ctx.translate(x, y);

    if (isHovered) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
    }

    const radius = node.type === "switch" ? 28 : node.type === "vlan" || node.type === "router" ? 24 : 20;
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = isHovered ? "rgba(0, 0, 0, 0.95)" : "rgba(10, 10, 15, 0.95)";
    ctx.fill();

    ctx.strokeStyle = isHovered ? color : border;
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;

    if (node.type === "switch") {
      ctx.beginPath();
      ctx.moveTo(-12, -4);
      ctx.lineTo(12, -4);
      ctx.moveTo(12, -4);
      ctx.lineTo(8, -7);
      ctx.moveTo(12, -4);
      ctx.lineTo(8, -1);
      ctx.moveTo(12, 4);
      ctx.lineTo(-12, 4);
      ctx.moveTo(-12, 4);
      ctx.lineTo(-8, 1);
      ctx.moveTo(-12, 4);
      ctx.lineTo(-8, 7);
      ctx.stroke();
    } else if (node.type === "router") {
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(0, -13);
      ctx.moveTo(0, -13); ctx.lineTo(-3, -10);
      ctx.moveTo(0, -13); ctx.lineTo(3, -10);
      ctx.moveTo(0, 6); ctx.lineTo(0, 13);
      ctx.moveTo(0, 13); ctx.lineTo(-3, 10);
      ctx.moveTo(0, 13); ctx.lineTo(3, 10);
      ctx.moveTo(6, 0); ctx.lineTo(13, 0);
      ctx.moveTo(13, 0); ctx.lineTo(10, -3);
      ctx.moveTo(13, 0); ctx.lineTo(10, 3);
      ctx.moveTo(-6, 0); ctx.lineTo(-13, 0);
      ctx.moveTo(-13, 0); ctx.lineTo(-10, -3);
      ctx.moveTo(-13, 0); ctx.lineTo(-10, 3);
      ctx.stroke();
    } else if (node.type === "vlan") {
      for (let i = -1; i <= 1; i++) {
        const offset = i * 5;
        ctx.beginPath();
        ctx.moveTo(0, -3 + offset);
        ctx.lineTo(10, 1 + offset);
        ctx.lineTo(0, 5 + offset);
        ctx.lineTo(-10, 1 + offset);
        ctx.closePath();
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.rect(-10, -8, 20, 13);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3, 5);
      ctx.lineTo(-5, 9);
      ctx.lineTo(5, 9);
      ctx.lineTo(3, 5);
      ctx.closePath();
      ctx.fill();
    }

    const label = node.label;
    const linesToDraw: string[] = [label];
    if (node.portIndex && node.type !== "switch") {
      linesToDraw.push(`Port: ${node.portIndex}`);
    }
    if (node.ip) {
      if (node.subnetMask) {
        linesToDraw.push(`${node.ip} / ${node.subnetMask}`);
      } else {
        linesToDraw.push(node.ip);
      }
    }

    ctx.font = "bold 9px monospace";
    let maxWidth = 0;
    linesToDraw.forEach(ln => {
      const w = ctx.measureText(ln).width;
      if (w > maxWidth) maxWidth = w;
    });

    ctx.fillStyle = "rgba(10, 10, 15, 0.95)";
    ctx.strokeStyle = isHovered ? color : "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;

    const px = 8;
    const py = 6;
    const lineSpacing = 12;
    const startY = radius + 12;

    const rw = maxWidth + px * 2;
    const rh = linesToDraw.length * lineSpacing + py * 2 - 4;
    const rx = -maxWidth / 2 - px;
    const ry = startY - py;
    const rr = 6;

    ctx.beginPath();
    ctx.moveTo(rx + rr, ry);
    ctx.lineTo(rx + rw - rr, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rr, rr);
    ctx.lineTo(rx + rw, ry + rh - rr);
    ctx.arcTo(rx + rw, ry + rh, rx + rw - rr, ry + rh, rr);
    ctx.lineTo(rx + rr, ry + rh);
    ctx.arcTo(rx, ry + rh, rx, ry + rh - rr, rr);
    ctx.lineTo(rx, ry + rr);
    ctx.arcTo(rx, ry, rx + rr, ry, rr);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    linesToDraw.forEach((ln, idx) => {
      const ly = startY + idx * lineSpacing;
      if (idx === 0) {
        ctx.fillStyle = color;
        ctx.font = "bold 9px monospace";
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "8px monospace";
      }
      ctx.fillText(ln, 0, ly);
    });

    ctx.restore();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const localX = (clientX - rect.left - panOffset.x) / zoom;
    const localY = (clientY - rect.top - panOffset.y) / zoom;

    let clickedNodeId: string | null = null;
    
    for (const node of nodes) {
      const pos = positions[node.id];
      if (!pos) continue;
      
      const radius = node.type === "switch" ? 28 : node.type === "vlan" || node.type === "router" ? 24 : 20;
      const dx = localX - pos.x;
      const dy = localY - pos.y;
      
      if (dx * dx + dy * dy < radius * radius + 100) {
        clickedNodeId = node.id;
        break;
      }
    }

    if (clickedNodeId) {
      dragInfo.current = {
        isPanning: false,
        draggedNodeId: clickedNodeId,
        startX: localX - positions[clickedNodeId].x,
        startY: localY - positions[clickedNodeId].y
      };
    } else {
      dragInfo.current = {
        isPanning: true,
        draggedNodeId: null,
        startX: clientX - panOffset.x,
        startY: clientY - panOffset.y
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const localX = (clientX - rect.left - panOffset.x) / zoom;
    const localY = (clientY - rect.top - panOffset.y) / zoom;

    const info = dragInfo.current;

    if (info.draggedNodeId) {
      const nodeId = info.draggedNodeId;
      setPositions(prev => ({
        ...prev,
        [nodeId]: {
          x: localX - info.startX,
          y: localY - info.startY
        }
      }));
    } else if (info.isPanning) {
      setPanOffset({
        x: clientX - info.startX,
        y: clientY - info.startY
      });
    } else {
      let foundHover: string | null = null;
      for (const node of nodes) {
        const pos = positions[node.id];
        if (!pos) continue;
        
        const radius = node.type === "switch" ? 28 : node.type === "vlan" || node.type === "router" ? 24 : 20;
        const dx = localX - pos.x;
        const dy = localY - pos.y;
        
        if (dx * dx + dy * dy < radius * radius + 100) {
          foundHover = node.id;
          break;
        }
      }
      setHoveredNodeId(foundHover);
    }
  };

  const handleMouseUp = () => {
    dragInfo.current.isPanning = false;
    dragInfo.current.draggedNodeId = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    const zoomIntensity = 0.08;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = e.deltaY < 0 ? 1 : -1;
    const newZoom = Math.min(Math.max(zoom * (1 + delta * zoomIntensity), 0.3), 3);
    
    const xs = (mouseX - panOffset.x) / zoom;
    const ys = (mouseY - panOffset.y) / zoom;
    
    setZoom(newZoom);
    setPanOffset({
      x: mouseX - xs * newZoom,
      y: mouseY - ys * newZoom
    });
  };

  const exportPng = () => {
    const tempCanvas = document.createElement("canvas");
    const exportWidth = 1920;
    const exportHeight = 1080;
    tempCanvas.width = exportWidth;
    tempCanvas.height = exportHeight;

    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    Object.values(positions).forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const padding = 150;
    const graphWidth = maxX - minX || 1;
    const graphHeight = maxY - minY || 1;

    const scaleX = (exportWidth - padding * 2) / graphWidth;
    const scaleY = (exportHeight - padding * 2) / graphHeight;
    const exportScale = Math.min(scaleX, scaleY, 1.5);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const exportTransX = exportWidth / 2 - centerX * exportScale;
    const exportTransY = exportHeight / 2 - centerY * exportScale;

    ctx.save();
    ctx.translate(exportTransX, exportTransY);
    ctx.scale(exportScale, exportScale);

    nodes.forEach(node => {
      const start = positions[node.id];
      if (!start) return;

      node.connections.forEach(targetId => {
        const end = positions[targetId];
        if (!end) return;

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        const midX = (start.x + end.x) / 2;
        ctx.bezierCurveTo(midX, start.y, midX, end.y, end.x, end.y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });
    });

    nodes.forEach(node => {
      const pos = positions[node.id];
      if (!pos) return;
      drawNode(ctx, node, pos.x, pos.y, false);
    });

    ctx.restore();

    const dataUrl = tempCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "TopoMap_Topology.png";
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative w-full overflow-hidden bg-black/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center p-0 min-h-[600px] select-none">
      <div className="absolute top-4 left-4 z-10 flex gap-1 bg-black/60 p-1 border border-white/10 rounded-lg">
        <button
          onClick={() => setViewMode("RADIAL")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === "RADIAL" ? "bg-accent text-accent-foreground shadow-sm" : "text-muted hover:text-foreground hover:bg-white/5"}`}
        >
          Radial
        </button>
        <button
          onClick={() => setViewMode("TREE")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === "TREE" ? "bg-accent text-accent-foreground shadow-sm" : "text-muted hover:text-foreground hover:bg-white/5"}`}
        >
          Tree
        </button>
      </div>

      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[9px] font-black text-foreground uppercase tracking-widest transition-all"
        >
          Reset View
        </button>
        <button
          onClick={exportPng}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/80 border border-accent/20 text-[9px] font-black text-accent-foreground uppercase tracking-widest transition-all shadow-lg"
        >
          Export Topology as PNG
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-[600px] cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Running-Config Decoder Component
   ───────────────────────────────────────────── */

export default function RunningConfigDecoderClient() {
  const [config, setConfig] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("SYSTEM");
  const [isDragging, setIsDragging] = useState(false);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);

    const parsed = useMemo(() => {
      if (!config.trim()) return null;
      try {
        return parseRunningConfig(config);
      } catch {
        return null;
      }
    }, [config]);

    const vendor = useMemo(() => {
      if (!config.trim()) return "Unknown";
      return detectVendor(config);
    }, [config]);

    const vendorBadge = useMemo(() => {
      switch (vendor) {
        case "Cisco":
          return <span className="text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 rounded-full whitespace-nowrap">Cisco IOS</span>;
        case "Juniper":
          return <span className="text-purple-400 border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 rounded-full whitespace-nowrap">Juniper JunOS</span>;
        case "FortiGate":
          return <span className="text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 rounded-full whitespace-nowrap">FortiOS</span>;
        default:
          return <span className="text-muted/50 border border-white/10 bg-white/5 px-2 py-0.5 rounded-full whitespace-nowrap">Unknown Vendor</span>;
      }
    }, [vendor]);

    const topologyNodes = useMemo(() => {
      if (!parsed) return [];
      return buildTopology(parsed);
    }, [parsed]);

  const loadSample = () => {
    setConfig(SAMPLE_CONFIG);
    setFileMeta(null);
  };

  const handleClear = () => {
    setConfig("");
    setFileMeta(null);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setConfig(content);
      setFileMeta({ name: file.name, size: file.size });
    };
    reader.readAsText(file);
  };

  const portCounts = useMemo(() => {
    if (!parsed) return { total: 0, up: 0, down: 0, trunk: 0, access: 0 };
    const total = parsed.interfaces.length;
    const up = parsed.interfaces.filter(i => i.status === "up").length;
    const down = parsed.interfaces.filter(i => i.status === "adminDown").length;
    const trunk = parsed.interfaces.filter(i => i.mode === "trunk").length;
    const access = parsed.interfaces.filter(i => i.mode === "access").length;
    return { total, up, down, trunk, access };
  }, [parsed]);

  return (
    <ToolContainer categoryId="network-security">
      <ToolHeader
        title="TopoMap"
        description="Enterprise-grade local configuration parser. Ingest switch or router configs, map interface VLANs, detect routing schemas, and build interactive network topologies completely offline."
        categoryId="network-security"
      />

      <div className="flex flex-col gap-6">

        {/* INGESTION STREAM */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 px-1">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
                <Terminal className="size-4 text-accent" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">Ingestion Stream</h2>
                <p className="text-[9px] font-bold text-muted/50 uppercase tracking-wider">Tactical config analysis & forensics</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 mr-2 px-3 py-1.5 rounded-md bg-white/[0.02] border border-white/5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted/70">CFG // NETWORK & SECURITY</span>
              </div>

              <ToolButton variant="secondary" size="sm" onClick={loadSample}>
                <Sparkles className="size-3 mr-2" />
                Load Cisco Sample
              </ToolButton>
              <ToolButton
                variant="secondary"
                size="sm"
                onClick={handleClear}
                disabled={!config}
                className="text-red-400/70 hover:text-red-400"
              >
                <Trash2 className="size-3 mr-2" />
                Clear Session
              </ToolButton>
            </div>
          </div>

          <div
            className={`relative group transition-all duration-500 ${isDragging ? "scale-[0.99] brightness-110" : ""}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) processFile(file); }}
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-accent/20 to-purple-500/20 rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition duration-1000" />

            <GlassCard className="relative flex flex-col gap-0 p-0 overflow-hidden border-white/5 bg-black/40">
              <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-6">
                  <label className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 hover:bg-accent/20 transition-colors cursor-pointer group/upload">
                    <Upload className="size-3.5 text-accent" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-accent">Upload Config</span>
                    <input type="file" className="hidden" accept=".txt,.cfg,.log" onChange={e => { const f = e.target.files?.[0]; if(f) processFile(f); }} />
                  </label>

                  <div className="hidden md:flex items-center gap-4 text-muted/40">
                    <div className="flex items-center gap-1.5"><FileText className="size-3" /><span className="text-[9px] font-bold uppercase">.cfg</span></div>
                    <div className="flex items-center gap-1.5"><FileCode className="size-3" /><span className="text-[9px] font-bold uppercase">.txt</span></div>
                    <div className="flex items-center gap-1.5"><Terminal className="size-3" /><span className="text-[9px] font-bold uppercase">.log</span></div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {fileMeta && (
                    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 animate-fadeIn">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">{fileMeta.name}</span>
                        <span className="text-[8px] font-bold text-emerald-400/40 uppercase">{(fileMeta.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <button onClick={() => { setFileMeta(null); setConfig(""); }} className="hover:text-red-400 transition-colors">
                        <XCircle className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <ToolTextarea
                  placeholder="Paste raw 'show running-config' output stream here..."
                  value={config}
                  onChange={(e) => setConfig(e.target.value)}
                  className="min-h-[250px] font-mono text-[13px] leading-relaxed bg-transparent border-none focus:ring-0 px-6 py-6"
                />
              </div>
            </GlassCard>
          </div>
        </div>

        {/* POST-ANALYSIS DASHBOARD */}
        {config && (
          <div className="flex flex-col gap-6 animate-fadeIn">

            {/* WORKSPACE TABS */}
            <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/5 rounded-xl self-start">
              {TABS.map(t => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? "bg-accent text-accent-foreground shadow-[0_0_15px_rgba(var(--accent),0.3)]" : "text-muted hover:text-foreground hover:bg-white/5"}`}
                  >
                    <Icon className="size-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* TAB: SYSTEM OVERVIEW */}
            {activeTab === "SYSTEM" && (
              <div className="flex flex-col gap-5">
                {!parsed ? (
                  <GlassCard className="py-20 flex flex-col items-center gap-4 text-center border-dashed border-white/10">
                    <AlertTriangle className="size-12 text-amber-400/30" />
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-black uppercase tracking-widest text-amber-400/80">Unable to Parse Config</h3>
                      <p className="text-xs text-muted/50 font-medium">Ensure the input follows standard Cisco IOS running-config syntax.</p>
                    </div>
                  </GlassCard>
                ) : (
                  <>
                    {/* Stats Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: "Interfaces", value: portCounts.total, icon: Monitor, color: "text-blue-400" },
                        { label: "Active Ports", value: portCounts.up, icon: Activity, color: "text-emerald-400" },
                        { label: "VLANs Defined", value: parsed.vlans.length, icon: Layers, color: "text-purple-400" },
                        { label: "Trunk Links", value: portCounts.trunk, icon: Share2, color: "text-amber-400" },
                        { label: "Access Ports", value: portCounts.access, icon: Wifi, color: "text-cyan-400" },
                        { label: "Protocols", value: parsed.routingProtocols.length, icon: Radio, color: "text-accent" },
                      ].map((s, i) => (
                        <GlassCard key={i} className="p-4 flex flex-col gap-1 border-white/5">
                          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted/60">
                            <s.icon className="size-3.5" />
                            {s.label}
                          </div>
                          <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                        </GlassCard>
                      ))}
                    </div>

                    {/* Device Identity */}
                    <GlassCard className="flex flex-col gap-5">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
                          <Server className="size-3.5" /> Device Identity
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold">
                            {vendorBadge}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-muted/40">Hostname</label>
                          <div className="flex items-center gap-3">
                            <Fingerprint className="size-4 text-accent" />
                            <span className="text-lg font-black text-foreground tracking-tight">{parsed.hostname || "Unnamed Device"}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-muted/40">Device Model</label>
                          <div className="flex items-center gap-3">
                            <Server className="size-4 text-purple-400" />
                            <span className="text-lg font-black text-foreground tracking-tight">{parsed.brand && parsed.model ? `${parsed.brand} ${parsed.model}` : "Unknown Device"}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-muted/40">Management IP</label>
                          <div className="flex items-center gap-3">
                            <Globe className="size-4 text-emerald-400" />
                            <span className="text-lg font-black text-emerald-400 font-mono tracking-tight">{parsed.managementIp || "Not Configured"}</span>
                          </div>
                        </div>
                      </div>
                    </GlassCard>

                    {/* Routing Protocols */}
                    <GlassCard className="flex flex-col gap-5">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
                          <Radio className="size-3.5" /> Active Routing Protocols
                        </div>
                      </div>
                      {parsed.routingProtocols.length === 0 ? (
                        <div className="py-8 flex flex-col items-center gap-3 border-2 border-dashed border-white/5 rounded-[32px]">
                          <Radio className="size-8 text-muted/10" />
                          <span className="text-[9px] font-black text-muted/30 uppercase tracking-[0.2em]">No Routing Protocols Detected</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {parsed.routingProtocols.map(proto => (
                            <div key={proto} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-[10px] font-black uppercase tracking-widest text-accent">
                              <Zap className="size-3.5" />
                              {proto}
                            </div>
                          ))}
                        </div>
                      )}
                    </GlassCard>

                    {/* VLAN Registry */}
                    <GlassCard className="flex flex-col gap-5">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
                          <Layers className="size-3.5" /> VLAN Registry
                        </div>
                        <span className="text-[9px] font-bold text-muted/40 uppercase tracking-widest">{parsed.vlans.length} Defined</span>
                      </div>
                      {parsed.vlans.length === 0 ? (
                        <div className="py-8 flex flex-col items-center gap-3 border-2 border-dashed border-white/5 rounded-[32px]">
                          <Layers className="size-8 text-muted/10" />
                          <span className="text-[9px] font-black text-muted/30 uppercase tracking-[0.2em]">No VLANs Defined</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {parsed.vlans.map(vlan => (
                            <div key={vlan.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors">
                              <div className="size-8 rounded-lg bg-accent/10 flex items-center justify-center text-[10px] font-black text-accent">{vlan.id}</div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-bold text-foreground truncate">{vlan.name}</span>
                                <span className="text-[8px] font-black text-muted/40 uppercase tracking-widest">VLAN {vlan.id}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </GlassCard>
                  </>
                )}
              </div>
            )}

            {/* TAB: PORT MAPPING */}
            {activeTab === "PORT_MAP" && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3 mb-2">
                  <LayoutGrid className="size-5 text-accent" />
                  <div className="flex flex-col">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em]">Interface Port Mapping</h2>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Discovered interfaces with speed, description, and VLAN config</p>
                  </div>
                </div>

                {!parsed || parsed.interfaces.length === 0 ? (
                  <GlassCard className="py-20 flex flex-col items-center gap-4 text-center border-dashed border-white/10">
                    <Monitor className="size-12 text-muted/20" />
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-black uppercase tracking-widest text-muted/80">No Interfaces Discovered</h3>
                      <p className="text-xs text-muted/50 font-medium">Paste a valid running-config to enumerate interfaces and port mappings.</p>
                    </div>
                  </GlassCard>
                ) : (
                  <GlassCard className="flex flex-col gap-0 p-0 overflow-hidden">
                    <div className="grid grid-cols-[160px_1fr_80px_100px_100px_120px] p-4 bg-white/[0.02] border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-muted/60">
                      <div>Interface</div>
                      <div>Description</div>
                      <div>Speed</div>
                      <div>Status</div>
                      <div>Mode</div>
                      <div>VLAN</div>
                    </div>
                    <div className="flex flex-col max-h-[600px] overflow-y-auto custom-scrollbar">
                      {parsed.interfaces.map((intf, idx) => {
                        const statusColor = intf.status === "up" ? "text-emerald-400" : intf.status === "adminDown" ? "text-red-400" : "text-amber-400";
                        const statusIcon = intf.status === "up" ? CheckCircle2 : intf.status === "adminDown" ? XCircle : AlertTriangle;
                        const StatusIcon = statusIcon;
                        return (
                          <div key={idx} className="grid grid-cols-[160px_1fr_80px_100px_100px_120px] p-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors items-center">
                            <div className="flex items-center gap-2">
                              <Monitor className="size-3.5 text-accent/60" />
                              <span className="text-[11px] font-mono font-bold text-foreground">{intf.name}</span>
                            </div>
                            <div className="text-[10px] font-medium text-muted/80 truncate max-w-[300px]">
                              {intf.description || <span className="text-muted/20 italic">No description</span>}
                            </div>
                            <div className="text-[10px] font-mono text-muted">{intf.speed === "auto" ? "Auto" : `${intf.speed}`}</div>
                            <div className="flex items-center gap-1.5">
                              <StatusIcon className={`size-3 ${statusColor}`} />
                              <span className={`text-[9px] font-black uppercase tracking-wider ${statusColor}`}>
                                {intf.status === "adminDown" ? "DOWN" : intf.status.toUpperCase()}
                              </span>
                            </div>
                            <div className={`text-[9px] font-black uppercase tracking-wider ${intf.mode === "trunk" ? "text-amber-400" : intf.mode === "access" ? "text-cyan-400" : "text-muted/40"}`}>
                              {intf.mode}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {intf.vlanAccess !== null ? (
                                <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-black text-cyan-400">A:{intf.vlanAccess}</span>
                              ) : intf.vlanTrunkAllowed.length > 0 ? (
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-black text-amber-400">T:{intf.vlanTrunkAllowed.join(",")}</span>
                              ) : intf.ip ? (
                                <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-[9px] font-mono text-accent">{intf.ip}</span>
                              ) : (
                                <span className="text-[8px] text-muted/20">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>
                )}
              </div>
            )}

            {/* TAB: VISUAL SCHEMA */}
            {activeTab === "SCHEMA" && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3 mb-2">
                  <Map className="size-5 text-accent" />
                  <div className="flex flex-col">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em]">Network Topology Schema</h2>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Interactive layout of discovered switch ports, VLAN families, and routing links</p>
                  </div>
                </div>

                {topologyNodes.length === 0 ? (
                  <GlassCard className="py-20 flex flex-col items-center gap-4 text-center border-dashed border-white/10">
                    <Map className="size-12 text-muted/20" />
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-black uppercase tracking-widest text-muted/80">No Topology Available</h3>
                      <p className="text-xs text-muted/50 font-medium">Parse a config with interfaces and VLANs to generate a visual network schema.</p>
                    </div>
                  </GlassCard>
                ) : (
                  <GlassCard className="flex flex-col gap-6 p-6">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
                      <Map className="size-3.5" /> Topology Graph
                      <span className="text-muted/40 font-normal normal-case tracking-normal ml-2">
                        ({topologyNodes.length} nodes)
                      </span>
                    </div>

                    {/* Topology Canvas */}
                    <TopologicalMap nodes={topologyNodes} />

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted/60">Legend</span>
                      <div className="flex items-center gap-2"><div className="size-3 rounded bg-accent/30 border border-accent/50" /><span className="text-[9px] font-bold text-muted">Core Switch</span></div>
                      <div className="flex items-center gap-2"><div className="size-3 rounded bg-purple-500/30 border border-purple-500/50" /><span className="text-[9px] font-bold text-muted">VLAN Segment</span></div>
                      <div className="flex items-center gap-2"><div className="size-3 rounded bg-emerald-500/30 border border-emerald-500/50" /><span className="text-[9px] font-bold text-muted">Access Port</span></div>
                      <div className="flex items-center gap-2"><div className="size-3 rounded bg-amber-500/30 border border-amber-500/50" /><span className="text-[9px] font-bold text-muted">Router</span></div>
                    </div>
                  </GlassCard>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </ToolContainer>
  );
}
