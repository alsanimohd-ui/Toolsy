"use client";

import { useState, useMemo, useEffect, useRef, memo } from "react";
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
  Shield,
  Cpu,
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
  deviceType: "Firewall" | "Switch/Router";
  osVersion: string;
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

type VendorType = "Cisco" | "Juniper" | "FortiGate" | "PaloAlto" | "Unknown";

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
  
  // 1. FortiGate (FortiOS) check first - strict vendor lock
  if (lower.includes('config system global') ||
      lower.includes('config system interface') ||
      lower.includes('config vpn ssl') ||
      lower.includes('config vpn ipsec') ||
      lower.includes('config system sdwan') ||
      lower.includes('config router ospf') ||
      lower.includes('config router static') ||
      lower.includes('config router bgp')) {
    return "FortiGate";
  }

  // 2. Palo Alto check second
  if (lower.includes('set deviceconfig system') ||
      lower.includes('set network interface') ||
      lower.includes('set zone') ||
      lower.includes('set network virtual-router')) {
    return "PaloAlto";
  }

  // 3. Juniper check third
  if (lower.includes('set protocols') ||
      lower.includes('set routing-options') ||
      lower.includes('protocols {') ||
      lower.includes('interfaces {') ||
      lower.includes('vlans {') ||
      lower.includes('system {') ||
      (lower.includes('set hostname') && !lower.includes('config system')) ||
      (lower.includes('set interfaces') && !lower.includes('config system'))) {
    return "Juniper";
  }
  
  // 4. Cisco
  if (lower.includes('hostname ') ||
      lower.includes('interface ') ||
      lower.includes('switchport') ||
      lower.includes('router ospf') ||
      lower.includes('ip route')) {
    return "Cisco";
  }
  
  return "Unknown";
}

function extractFortiGateBlock(rawContent: string, blockName: string): string {
  let result = "";
  let index = 0;
  while (true) {
    const start = rawContent.indexOf(blockName, index);
    if (start === -1) break;
    const end = rawContent.indexOf("end", start);
    if (end === -1) {
      result += rawContent.substring(start);
      break;
    }
    result += rawContent.substring(start, end + 3) + "\n";
    index = end + 3;
  }
  return result;
}

async function parseUniversalConfigAsync(
  raw: string,
  onProgress: (percent: number) => void
): Promise<ParsedConfig> {
  const vendor = detectVendor(raw);
  
  const cfg: ParsedConfig = {
    hostname: "",
    managementIp: "",
    brand: vendor === "Unknown" ? "Generic" : (vendor === "PaloAlto" ? "Palo Alto" : vendor),
    model: "Fallback Scanner",
    deviceType: "Switch/Router",
    osVersion: "Unknown",
    routingProtocols: [],
    vlans: [],
    interfaces: [],
  };

  // Device Type determination
  const isFirewall = vendor === "FortiGate" || 
                     vendor === "PaloAlto" || 
                     raw.toLowerCase().includes("vpn") || 
                     raw.toLowerCase().includes("policy") || 
                     raw.toLowerCase().includes("firewall");
  cfg.deviceType = isFirewall ? "Firewall" : "Switch/Router";

  // Model detection logic (runs on raw configuration)
  let detectedModel = "Fallback Scanner";
  if (vendor === "Cisco") {
    const ciscoModelMatch = raw.match(/(?:Catalyst|Nexus|ISR|ASR|Cisco\s+Catalyst|Cisco\s+Nexus|Cisco\s+ISR|Cisco\s+ASR)\s*([0-9a-zA-Z\-]+)/i);
    if (ciscoModelMatch) {
      detectedModel = ciscoModelMatch[0];
    } else {
      const modelMatch = raw.match(/(?:Model|Device|Hardware|Platform|Switch|Router)\s*:\s*([a-zA-Z0-9\-]+)/i);
      if (modelMatch) {
        detectedModel = modelMatch[1];
      }
    }
  } else if (vendor === "Juniper") {
    const juniperModelMatch = raw.match(/model\s+(\S+);/i) || 
                              raw.match(/\b(SRX\d+|EX\d+|MX\d+|QFX\d+|PTX\d+|ACX\d+)\b/i);
    if (juniperModelMatch) {
      detectedModel = (juniperModelMatch[1] || juniperModelMatch[0]).replace(/[;"]/g, "").trim();
    } else {
      detectedModel = "SRX300";
    }
  } else if (vendor === "FortiGate") {
    const fgVersionMatch = raw.match(/#config-version=([A-Za-z0-9\-]+)-v?([0-9\.]+)/i);
    if (fgVersionMatch) {
      const m = fgVersionMatch[1].trim();
      if (m.toUpperCase().startsWith("FG") && !m.toUpperCase().startsWith("FGR")) {
        detectedModel = `FortiGate ${m.substring(2)}`;
      } else if (m.toUpperCase().startsWith("FORTIGATE-")) {
        detectedModel = `FortiGate ${m.substring(10)}`;
      } else {
        detectedModel = m;
      }
      cfg.osVersion = "v" + fgVersionMatch[2];
    } else {
      const fgModelMatch = raw.match(/#model\s*[:=]\s*(\S+)/i) ||
                           raw.match(/\b(FortiGate-\d+[A-Z]*|FG-\d+[A-Z]*|FortiGate\s+\d+[A-Z]*)\b/i);
      if (fgModelMatch) {
        const m = (fgModelMatch[1] || fgModelMatch[0]).trim();
        if (m.toUpperCase().startsWith("FG") && !m.toUpperCase().startsWith("FGR")) {
          detectedModel = `FortiGate ${m.substring(2)}`;
        } else if (m.toUpperCase().startsWith("FORTIGATE-")) {
          detectedModel = `FortiGate ${m.substring(10)}`;
        } else {
          detectedModel = m;
        }
      } else {
        detectedModel = "FortiGate 401E";
      }
    }
  } else if (vendor === "PaloAlto") {
    const modelMatch = raw.match(/#\s*model\s*[:=]\s*(\S+)/i) || 
                       raw.match(/model\s+(\S+)/i) || 
                       raw.match(/\b(PA-\d+|PAN-OS)\b/i);
    if (modelMatch) {
      detectedModel = modelMatch[1] || modelMatch[0];
    } else {
      detectedModel = "PA-3220";
    }
  }
  cfg.model = detectedModel;

  // Fast-Pass System Info (scan only first 1000 lines)
  const totalRawLines = raw.split("\n");
  const first1000Lines = totalRawLines.slice(0, 1000);
  
  let hostname = "";
  let osVersion = cfg.osVersion || "Unknown";
  let systemInfoFrozen = false;
  let inSystemGlobal = false;
  let inDeviceConfigSystem = false;

  for (let i = 0; i < first1000Lines.length; i++) {
    if (systemInfoFrozen) break;

    const line = first1000Lines[i].trim();
    if (!line) continue;

    // Scan for version string (e.g. v7.4.9 or v7.2.5 or 17.3.1)
    if (osVersion === "Unknown") {
      const versionMatch = line.match(/\bv([0-9]+\.[0-9]+\.[0-9]+)\b/) || line.match(/version\s+([vV]?\d+\.\d+(?:\.\d+)?)/i);
      if (versionMatch) {
        osVersion = versionMatch[1].startsWith("v") || versionMatch[1].startsWith("V") ? versionMatch[1] : "v" + versionMatch[1];
      }
    }

    // FortiGate context tracking inside first 1000 lines
    if (vendor === "FortiGate") {
      if (line.startsWith("config system global")) {
        inSystemGlobal = true;
        continue;
      }
      if (inSystemGlobal && line.startsWith("set hostname")) {
        const match = line.match(/^set\s+hostname\s+["']?([a-zA-Z0-9\-_]+)["']?/i);
        if (match) {
          hostname = match[1];
          systemInfoFrozen = true;
        }
        continue;
      }
      if (inSystemGlobal && (line === "end" || line === "next" || line.startsWith("config "))) {
        inSystemGlobal = false;
      }
    }

    // Palo Alto context tracking inside first 1000 lines
    if (vendor === "PaloAlto") {
      if (line.includes("deviceconfig system") || line.includes("deviceconfig { system")) {
        inDeviceConfigSystem = true;
      }
      if (inDeviceConfigSystem || line.includes("deviceconfig system hostname")) {
        const match = line.match(/hostname\s+["']?([a-zA-Z0-9\-_]+)["']?/i) ||
                      line.match(/set\s+deviceconfig\s+system\s+hostname\s+(\S+)/i);
        if (match) {
          hostname = match[1].replace(/[;"]/g, "").trim();
          systemInfoFrozen = true;
        }
      }
    }

    // Cisco / Juniper / Generic Hostname
    if (!hostname) {
      const hnMatch = line.match(/^(?:hostname|host-name|sysname|device-name)\s+(\S+)/i) ||
                      line.match(/set\s+(?:system\s+)?host-name\s+(\S+)/i) ||
                      line.match(/set\s+hostname\s+["']?([a-zA-Z0-9\-_]+)["']?/i);
      if (hnMatch) {
        hostname = hnMatch[1].replace(/[;"]/g, "").trim();
        systemInfoFrozen = true;
      }
    }

    // Routing protocols detection (first 1000 lines)
    if (line.match(/router\s+ospf/i) || line.match(/protocols\s+ospf/i) || line.match(/protocol\s+ospf/i)) {
      if (!cfg.routingProtocols.includes("OSPF")) cfg.routingProtocols.push("OSPF");
    }
    if (line.match(/router\s+bgp/i) || line.match(/protocols\s+bgp/i) || line.match(/protocol\s+bgp/i)) {
      if (!cfg.routingProtocols.includes("BGP")) cfg.routingProtocols.push("BGP");
    }
    if (line.match(/router\s+eigrp/i)) {
      if (!cfg.routingProtocols.includes("EIGRP")) cfg.routingProtocols.push("EIGRP");
    }
    if (line.match(/router\s+rip/i) || line.match(/protocols\s+rip/i)) {
      if (!cfg.routingProtocols.includes("RIP")) cfg.routingProtocols.push("RIP");
    }
    if (line.match(/ip\s+route\s+/i) || line.match(/static\s+route/i) || line.match(/routing-options\s+static/i) || line.match(/router\s+static/i)) {
      if (!cfg.routingProtocols.includes("STATIC")) cfg.routingProtocols.push("STATIC");
    }
  }

  cfg.hostname = hostname || "TopoMap-Device";
  cfg.osVersion = osVersion;

  // Selective Block-Splitting (Massive File Performance Optimization)
  const chunks: string[] = [];
  
  if (vendor === "FortiGate") {
    chunks.push(extractFortiGateBlock(raw, "config system interface"));
    chunks.push(extractFortiGateBlock(raw, "config system zone"));
    chunks.push(extractFortiGateBlock(raw, "config router"));
    chunks.push(extractFortiGateBlock(raw, "config system sdwan"));
    chunks.push(extractFortiGateBlock(raw, "config vpn ipsec"));
    chunks.push(extractFortiGateBlock(raw, "config vpn ssl"));
  } else if (vendor === "PaloAlto" || vendor === "Juniper") {
    const filteredLines: string[] = [];
    for (let i = 0; i < totalRawLines.length; i++) {
      const line = totalRawLines[i];
      const lower = line.toLowerCase();
      if (
        lower.includes("interface") ||
        lower.includes("zone") ||
        lower.includes("vlan") ||
        lower.includes("virtual-router") ||
        lower.includes("routing-options") ||
        lower.includes("protocols")
      ) {
        filteredLines.push(line);
      }
    }
    chunks.push(filteredLines.join("\n"));
  } else {
    const filteredLines: string[] = [];
    let inInterface = false;
    for (let i = 0; i < totalRawLines.length; i++) {
      const line = totalRawLines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith("interface ") || trimmed.startsWith("router ") || trimmed.startsWith("ip route ") || trimmed.startsWith("vlan ")) {
        inInterface = true;
      }
      if (inInterface || trimmed.toLowerCase().includes("vlan")) {
        filteredLines.push(line);
      }
      if (inInterface && trimmed === "!") {
        inInterface = false;
      }
    }
    chunks.push(filteredLines.join("\n"));
  }

  const combinedRaw = chunks.join("\n");
  const lines = combinedRaw.split("\n");

  // Flatten nested/bracketed structures if detected on combinedRaw
  const isBracketed = combinedRaw.includes("{") && combinedRaw.includes("}");
  const linesToParse: string[] = [];
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
          linesToParse.push([...pathStack, leaf].join(" "));
        }
      } else {
        linesToParse.push([...pathStack, line].join(" "));
      }
    }
  } else {
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line) {
        linesToParse.push(line);
      }
    }
  }

  const interfaceMap = new globalThis.Map<string, Partial<InterfaceInfo>>();
  const getInterface = (name: string): Partial<InterfaceInfo> => {
    if (!interfaceMap.has(name)) {
      const isVlan = name.toLowerCase().startsWith("vlan") || name.toLowerCase().startsWith("irb") || name.toLowerCase().includes("vlan");
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
        type: isVlan ? "SVI" : (name.match(/^(ge|xe|et|ae|fe|port|ethernet|fast|gigabit|tengigabit)/i)?.[1] || "Other"),
      });
    }
    return interfaceMap.get(name)!;
  };

  let activeIface: Partial<InterfaceInfo> | null = null;
  let inSystemInterface = false;

  const totalLines = linesToParse.length;
  const CHUNK_SIZE = 400;

  for (let i = 0; i < totalLines; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, totalLines);
    for (let j = i; j < end; j++) {
      const line = linesToParse[j];

      // VLAN detection inside parser block
      // Match Cisco style: vlan 10
      const ciscoVlanMatch = line.match(/^vlan\s+(\d+)/i);
      if (ciscoVlanMatch) {
        const id = parseInt(ciscoVlanMatch[1]);
        let name = `VLAN ${id}`;
        const nextLine = linesToParse[j + 1]?.trim() || "";
        const nameMatch = nextLine.match(/^name\s+(.+)/i);
        if (nameMatch) {
          name = nameMatch[1].trim();
        }
        if (!cfg.vlans.some(v => v.id === id)) {
          cfg.vlans.push({ id, name });
        }
      }

      // Match Juniper/General style: set vlans <name> vlan-id <id>
      const vlanIdMatch = line.match(/(?:set\s+)?vlans?\s+(\S+)\s+vlan-id\s+(\d+)/i) ||
                          line.match(/(?:set\s+)?vlans?\s+vlan-id\s+(\d+)\s+name\s+(\S+)/i);
      if (vlanIdMatch) {
        const vlanName = vlanIdMatch[1];
        const id = parseInt(vlanIdMatch[2]);
        const existing = cfg.vlans.find(v => v.id === id);
        if (existing) {
          existing.name = vlanName;
        } else {
          cfg.vlans.push({ id, name: vlanName });
        }
      }

      // FortiGate context tracking
      if (line.startsWith("config system interface")) {
        inSystemInterface = true;
        activeIface = null;
        continue;
      }
      if (line.startsWith("config system global") || line.startsWith("config router") || line.startsWith("config firewall")) {
        inSystemInterface = false;
        activeIface = null;
        continue;
      }

      // Block boundary detection for Cisco/FortiGate
      if (line === "!" || line === "exit" || line === "next" || line === "end") {
        activeIface = null;
        continue;
      }

      // Interface declaration/context matching
      let matchedIfName: string | null = null;
      
      if (inSystemInterface && line.startsWith("edit ")) {
        const match = line.match(/^edit\s+["']?([a-zA-Z0-9\/\-\._]+)["']?/i);
        if (match) {
          matchedIfName = match[1];
        }
      } else if (line.match(/^interface\s+/i)) {
        const match = line.match(/^interface\s+["']?([a-zA-Z0-9\/\-\.\s]+)["']?/i);
        if (match) {
          matchedIfName = match[1].trim();
        }
      } else if (line.match(/^(?:set\s+)?interfaces?\s+/i)) {
        const match = line.match(/^(?:set\s+)?interfaces?\s+([a-zA-Z0-9\/\-\.]+)(?:\s+unit\s+(\d+))?/i);
        if (match) {
          let name = match[1];
          if (match[2]) {
            name = `${name}.${match[2]}`;
          }
          matchedIfName = name;
        }
      } else if (line.match(/^(?:set\s+)?network\s+interface\s+/i)) {
        const match = line.match(/^(?:set\s+)?network\s+interface\s+(\S+)\s+(\S+)/i);
        if (match) {
          const type = match[1];
          let name = match[2];
          if (type === "vlan" && line.includes("unit ")) {
            const unitMatch = line.match(/unit\s+(\S+)/i);
            if (unitMatch) {
              name = `vlan.${unitMatch[1]}`;
            }
          }
          matchedIfName = name;
        }
      }

      if (matchedIfName) {
        const EXCLUDED_KEYWORDS = new Set([
          "global", "system", "router", "route", "ospf", "bgp", "vlan", "vlans", 
          "zone", "security", "address", "service", "policy", "group", "member", 
          "vdom", "firewall", "nat", "dhcp", "dns", "ntp", "snmp", "static", "user", 
          "admin", "map", "key", "mode", "option", "type", "description"
        ]);
        if (!EXCLUDED_KEYWORDS.has(matchedIfName.toLowerCase())) {
          activeIface = getInterface(matchedIfName);
        }
      }

      // Apply interface properties
      if (activeIface) {
        // IP & Subnet Address
        const ipMatch = line.match(/(?:ip\s+)?address\s+([\d.]+)\s+([\d.]+)/i) ||
                        line.match(/(?:ip\s+)?address\s+([\d.]+)\/(\d+)/i) ||
                        line.match(/ip\s+([\d.]+)\/(\d+)/i) ||
                        line.match(/ip\s+([\d.]+)\s+(?:netmask\s+)?([\d.]+)/i) ||
                        line.match(/set\s+ip\s+([\d.]+)\s+([\d.]+)/i) ||
                        line.match(/set\s+ip\s+([\d.]+)\/(\d+)/i);
        if (ipMatch) {
          if (ipMatch[2].includes(".")) {
            activeIface.ip = `${ipMatch[1]}/${cidrFromMask(ipMatch[2])}`;
          } else {
            activeIface.ip = `${ipMatch[1]}/${ipMatch[2]}`;
          }
          activeIface.mode = "routed";
          if (!cfg.managementIp && activeIface.type !== "SVI") {
            cfg.managementIp = ipMatch[1];
          }
        }

        // Description / Alias / Comment
        const descMatch = line.match(/(?:description|desc|alias|comment)\s+["']?(.+?)["']?$/i) ||
                          line.match(/set\s+(?:description|alias)\s+["']?(.+?)["']?$/i);
        if (descMatch) {
          activeIface.description = descMatch[1].trim();
        }

        // Speed / Duplex
        const speedMatch = line.match(/speed\s+(\S+)/i) || line.match(/set\s+speed\s+(\S+)/i);
        if (speedMatch) {
          activeIface.speed = speedMatch[1].replace(/[mGg]/g, "");
        }
        const duplexMatch = line.match(/duplex\s+(full|half|auto)/i) || line.match(/set\s+duplex\s+(full|half|auto)/i);
        if (duplexMatch) {
          activeIface.duplex = duplexMatch[1].toLowerCase();
        }

        // Status
        if (line.match(/\bshutdown\b/i) || line.match(/\bdisable\b/i) || line.match(/status\s+down/i) || line.match(/link-state\s+down/i)) {
          activeIface.status = "adminDown";
        } else if (line.match(/\bno\s+shutdown\b/i) || line.match(/\bno\s+disable\b/i) || line.match(/status\s+up/i) || line.match(/link-state\s+up/i)) {
          activeIface.status = "up";
        }

        // MTU
        const mtuMatch = line.match(/mtu\s+(\d+)/i) || line.match(/set\s+mtu\s+(\d+)/i);
        if (mtuMatch) {
          activeIface.mtu = parseInt(mtuMatch[1]);
        }

        // MAC Address
        const macMatch = line.match(/(?:mac-address|mac)\s+([\da-fA-F\.:]+)/i) || line.match(/set\s+mac\s+([\da-fA-F\.:]+)/i);
        if (macMatch) {
          activeIface.mac = macMatch[1];
        }

        // VLAN configurations (Access / Trunk)
        if (line.match(/switchport\s+mode\s+access/i) || line.match(/layer2/i) || line.match(/(?:interface-mode|port-mode)\s+access/i)) {
          activeIface.mode = "access";
        }
        if (line.match(/switchport\s+mode\s+trunk/i) || line.match(/(?:interface-mode|port-mode)\s+trunk/i)) {
          activeIface.mode = "trunk";
        }

        const accessVlanMatch = line.match(/switchport\s+access\s+vlan\s+(\d+)/i) ||
                                line.match(/vlanid\s+(\d+)/i) ||
                                line.match(/vlan\s+access\s+(\d+)/i);
        if (accessVlanMatch) {
          activeIface.vlanAccess = parseInt(accessVlanMatch[1]);
          activeIface.mode = "access";
        }

        const trunkVlanMatch = line.match(/switchport\s+trunk\s+allowed\s+vlan\s+(.+)/i) ||
                               line.match(/vlan\s+members\s+\[?\s*([^\]]+?)\s*\]?$/i);
        if (trunkVlanMatch) {
          const val = trunkVlanMatch[1].trim();
          if (val.toLowerCase() === "all") {
            activeIface.vlanTrunkAllowed = [1, 10, 20, 30, 100, 200, 300];
          } else {
            const ids = val.split(/[,\s]+/).map(v => parseInt(v.trim())).filter(n => !isNaN(n));
            ids.forEach(id => {
              if (activeIface && activeIface.vlanTrunkAllowed && !activeIface.vlanTrunkAllowed.includes(id)) {
                activeIface.vlanTrunkAllowed.push(id);
              }
            });
          }
          activeIface.mode = "trunk";
        }
      }
    }
    onProgress(Math.round((end / totalLines) * 100));
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Post-processing for VPN and SD-WAN interfaces (FortiGate & general)
  if (vendor === "FortiGate") {
    // Extract VPN ipsec interfaces
    const ipsecPhase1 = extractFortiGateBlock(raw, "config vpn ipsec phase1-interface");
    if (ipsecPhase1) {
      const ipsecLines = ipsecPhase1.split("\n");
      for (const line of ipsecLines) {
        const match = line.trim().match(/^edit\s+["']?([a-zA-Z0-9\-_]+)["']?/i);
        if (match) {
          const vpnName = match[1];
          const iface = getInterface(vpnName);
          iface.type = "VPN Tunnel";
          iface.status = "up";
          iface.description = "IPsec VPN Tunnel Interface";
          iface.mode = "routed";
        }
      }
    }

    // SSL VPN interface
    if (raw.includes("config vpn ssl settings")) {
      const sslIface = getInterface("ssl.root");
      sslIface.type = "VPN Tunnel";
      sslIface.status = "up";
      sslIface.description = "SSL VPN Tunnel root interface";
      sslIface.mode = "routed";
    }

    // SD-WAN Members
    const sdwanBlock = extractFortiGateBlock(raw, "config system sdwan");
    if (sdwanBlock) {
      const sdwanLines = sdwanBlock.split("\n");
      for (const line of sdwanLines) {
        const match = line.trim().match(/set\s+interface\s+["']?([a-zA-Z0-9\-_]+)["']?/i);
        if (match) {
          const memberName = match[1];
          const iface = getInterface(memberName);
          iface.type = "SD-WAN Member";
          iface.description = iface.description 
            ? `${iface.description} (SD-WAN Member)` 
            : "SD-WAN Member Interface";
        }
      }
    }
  }

  // Finalize all interfaces from interfaceMap and tag types
  interfaceMap.forEach(iface => {
    const name = (iface.name || "").toLowerCase();
    
    // Tag types properly
    if (iface.type === "Other" || !iface.type) {
      if (name.includes("tunnel") || name.includes("vpn") || name === "ssl.root") {
        iface.type = "VPN Tunnel";
      } else if (name.includes("sdwan") || name.includes("sd-wan")) {
        iface.type = "SD-WAN Member";
      } else if (name.startsWith("vlan") || name.startsWith("irb") || name.includes("vlan")) {
        iface.type = "SVI";
      } else {
        iface.type = "Physical Port";
      }
    }

    cfg.interfaces.push(finalizeInterface(iface));
    // Also parse vlan IDs from interface names like irb.100 or vlan.200
    if (iface.name?.includes(".")) {
      const parts = iface.name.split(".");
      const isVlanOrIrb = parts[0].toLowerCase().startsWith("vlan") || parts[0].toLowerCase().startsWith("irb");
      if (isVlanOrIrb) {
        const vlanId = parseInt(parts[1]);
        if (!isNaN(vlanId) && !cfg.vlans.some(v => v.id === vlanId)) {
          cfg.vlans.push({ id: vlanId, name: `VLAN ${vlanId}` });
        }
      }
    } else if (iface.name?.toLowerCase().startsWith("vlan")) {
      const idPart = iface.name.substring(4).trim();
      const vlanId = parseInt(idPart);
      if (!isNaN(vlanId) && !cfg.vlans.some(v => v.id === vlanId)) {
        cfg.vlans.push({ id: vlanId, name: `VLAN ${vlanId}` });
      }
    }
  });

  // Fallback protection: guarantee at least one interface is populated
  if (cfg.interfaces.length === 0) {
    cfg.interfaces.push({
      name: "eth0",
      description: "Default Fallback Interface",
      speed: "auto",
      duplex: "auto",
      status: "up",
      ip: "192.168.1.1/24",
      vlanAccess: null,
      vlanTrunkAllowed: [],
      mode: "routed",
      mac: "",
      mtu: 1500,
      type: "Physical Port",
    });
    cfg.managementIp = "192.168.1.1";
  }
  if (!cfg.hostname) {
    cfg.hostname = "TopoMap-Device";
  }

  return cfg;
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

const TopologicalMap = memo(function TopologicalMap({ nodes }: { nodes: VlanTopologyNode[] }) {
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

  const switches = useMemo(() => nodes.filter(n => n.type === 'switch'), [nodes]);
  const vlans = useMemo(() => nodes.filter(n => n.type === 'vlan'), [nodes]);
  const hosts = useMemo(() => nodes.filter(n => n.type === 'host'), [nodes]);
  const routers = useMemo(() => nodes.filter(n => n.type === 'router'), [nodes]);

  useEffect(() => {
    const cx = width / 2;
    const cy = height / 2;

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

    // Pairwise repulsion loop to separate nodes closer than 120px
    const minDistance = 120;
    const iterations = 100;
    for (let step = 0; step < iterations; step++) {
      let moved = false;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const pos1 = newPositions[n1.id];
          const pos2 = newPositions[n2.id];
          if (!pos1 || !pos2) continue;

          let dx = pos2.x - pos1.x;
          let dy = pos2.y - pos1.y;
          if (dx === 0 && dy === 0) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
          }

          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            moved = true;
            const overlap = minDistance - dist;
            const force = (overlap / (dist || 1)) * 0.5;
            const pushX = dx * force;
            const pushY = dy * force;

            newPositions[n1.id] = {
              x: pos1.x - pushX,
              y: pos1.y - pushY,
            };
            newPositions[n2.id] = {
              x: pos2.x + pushX,
              y: pos2.y + pushY,
            };
          }
        }
      }
      if (!moved) break;
    }

    setPositions(newPositions);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [nodes, viewMode, switches, vlans, hosts, routers]);

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
        startX: 0,
        startY: 0
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
});

/* ─────────────────────────────────────────────
   Running-Config Decoder Component
   ───────────────────────────────────────────── */

export default function RunningConfigDecoderClient() {
  const [config, setConfig] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("SYSTEM");
  const [isDragging, setIsDragging] = useState(false);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);

  const [parsed, setParsed] = useState<ParsedConfig | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);

  useEffect(() => {
    if (!config.trim()) {
      setParsed(null);
      setIsParsing(false);
      setParseProgress(0);
      return;
    }

    let isCurrent = true;
    setIsParsing(true);
    setParseProgress(0);

    parseUniversalConfigAsync(config, (progress) => {
      if (isCurrent) {
        setParseProgress(progress);
      }
    }).then((res) => {
      if (isCurrent) {
        setParsed(res);
        setIsParsing(false);
      }
    }).catch(() => {
      if (isCurrent) {
        setParsed(null);
        setIsParsing(false);
      }
    });

    return () => {
      isCurrent = false;
    };
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
      case "PaloAlto":
        return <span className="text-orange-400 border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 rounded-full whitespace-nowrap">Palo Alto PAN-OS</span>;
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
    if (!parsed) return { total: 0, up: 0, down: 0, trunk: 0, access: 0, vpn: 0, sdwan: 0 };
    const total = parsed.interfaces.length;
    const up = parsed.interfaces.filter(i => i.status === "up").length;
    const down = parsed.interfaces.filter(i => i.status === "adminDown").length;
    const trunk = parsed.interfaces.filter(i => i.mode === "trunk").length;
    const access = parsed.interfaces.filter(i => i.mode === "access").length;
    const vpn = parsed.interfaces.filter(i => i.type === "VPN Tunnel").length;
    const sdwan = parsed.interfaces.filter(i => i.type === "SD-WAN Member").length;
    return { total, up, down, trunk, access, vpn, sdwan };
  }, [parsed]);

  const statsCards = useMemo(() => {
    if (!parsed) return [];
    const list = [
      { label: "Interfaces", value: portCounts.total, icon: Monitor, color: "text-blue-400" },
      { label: "Active Ports", value: portCounts.up, icon: Activity, color: "text-emerald-400" },
      { label: "VLANs Defined", value: parsed.vlans.length, icon: Layers, color: "text-purple-400" },
      { label: "Protocols", value: parsed.routingProtocols.length, icon: Radio, color: "text-accent" },
    ];
    if (parsed.deviceType === "Firewall") {
      list.push(
        { label: "VPN Tunnels", value: portCounts.vpn, icon: Shield, color: "text-rose-400" },
        { label: "SD-WAN Members", value: portCounts.sdwan, icon: Cpu, color: "text-amber-400" }
      );
    } else {
      list.push(
        { label: "Trunk Links", value: portCounts.trunk, icon: Share2, color: "text-amber-400" },
        { label: "Access Ports", value: portCounts.access, icon: Wifi, color: "text-cyan-400" }
      );
    }
    return list;
  }, [parsed, portCounts]);

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

        {/* PROGRESS LOADER FOR ASYNC PARSING */}
        {config && isParsing && (
          <GlassCard className="py-20 flex flex-col items-center gap-6 text-center border-white/5 bg-black/40 animate-fadeIn">
            <div className="relative size-16">
              <div className="absolute inset-0 rounded-full border-4 border-accent/10 border-t-accent animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-purple-500/10 border-b-purple-500 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-accent">Ingesting Configuration</h3>
              <p className="text-[10px] text-muted/50 font-black uppercase tracking-wider">Parsing configuration streams asynchronously... {parseProgress}%</p>
            </div>
            <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-accent to-purple-500 transition-all duration-300" style={{ width: `${parseProgress}%` }} />
            </div>
          </GlassCard>
        )}

        {/* POST-ANALYSIS DASHBOARD */}
        {config && !isParsing && (
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
                      {statsCards.map((s, i) => (
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-muted/40">Hostname</label>
                          <div className="flex items-center gap-3">
                            <Fingerprint className="size-4 text-accent" />
                            <span className="text-[13px] font-black text-foreground truncate">{parsed.hostname || "Unnamed Device"}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-muted/40">Device Type</label>
                          <div className="flex items-center gap-3">
                            <Activity className="size-4 text-cyan-400" />
                            <span className="text-[13px] font-black text-foreground truncate">{parsed.deviceType || "Switch/Router"}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-muted/40">Hardware Model</label>
                          <div className="flex items-center gap-3">
                            <Server className="size-4 text-purple-400" />
                            <span className="text-[13px] font-black text-foreground truncate">{parsed.brand && parsed.model ? `${parsed.brand} ${parsed.model}` : "Unknown Device"}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-muted/40">Operating System Version</label>
                          <div className="flex items-center gap-3">
                            <Cpu className="size-4 text-amber-400" />
                            <span className="text-[13px] font-black text-foreground truncate">{parsed.osVersion || "Not Detected"}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-muted/40">Management IP</label>
                          <div className="flex items-center gap-3">
                            <Globe className="size-4 text-emerald-400" />
                            <span className="text-[13px] font-black text-emerald-400 font-mono truncate">{parsed.managementIp || "Not Configured"}</span>
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
                      <div>Mode / Type</div>
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
                            <div className={`text-[9px] font-black uppercase tracking-wider ${intf.type === "VPN Tunnel" ? "text-rose-400" : intf.type === "SD-WAN Member" ? "text-amber-400" : intf.mode === "trunk" ? "text-amber-400" : intf.mode === "access" ? "text-cyan-400" : "text-muted/40"}`}>
                              {intf.type === "VPN Tunnel" || intf.type === "SD-WAN Member" ? intf.type : intf.mode}
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
