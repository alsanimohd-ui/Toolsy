"use client";

import { useState, useMemo } from "react";
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
  Router,
  Layers,
  Map,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

/* ─────────────────────────────────────────────
   Types & Interfaces
   ───────────────────────────────────────────── */

interface ParsedConfig {
  hostname: string;
  managementIp: string;
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
   Cisco Config Parser (regex-only, offline)
   ───────────────────────────────────────────── */

const SAMPLE_CONFIG = `hostname Core-Switch-01
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

function parseRunningConfig(raw: string): ParsedConfig {
  const lines = raw.split("\n");
  const cfg: ParsedConfig = {
    hostname: "",
    managementIp: "",
    routingProtocols: [],
    vlans: [],
    interfaces: [],
  };

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

function buildTopology(cfg: ParsedConfig): VlanTopologyNode[] {
  const nodes: VlanTopologyNode[] = [];
  const nodeMap = new Set<string>();

  // Root switch node
  const switchId = "sw-core";
  nodes.push({ id: switchId, label: cfg.hostname || "Core-Switch", type: "switch", group: "infra", connections: [] });
  nodeMap.add(switchId);

  // VLAN nodes
  for (const vlan of cfg.vlans) {
    const vlanId = `vlan-${vlan.id}`;
    if (!nodeMap.has(vlanId)) {
      nodes.push({ id: vlanId, label: `${vlan.name} (VLAN ${vlan.id})`, type: "vlan", group: "vlan", connections: [switchId] });
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
      if (!nodeMap.has(vlanId)) {
        nodes.push({ id: vlanId, label: `Inferred VLAN ${intf.vlanAccess}`, type: "vlan", group: "vlan", connections: [switchId] });
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
    if (!nodeMap.has(routerId)) {
      nodes.push({ id: routerId, label: "Core Router", type: "router", group: "infra", connections: [switchId] });
      nodeMap.add(routerId);
      const swNode = nodes.find(n => n.id === switchId);
      if (swNode && !swNode.connections.includes(routerId)) swNode.connections.push(routerId);
    }
  }

  // Host nodes from access ports
  for (const intf of cfg.interfaces) {
    if (intf.mode === "access" && intf.status === "up") {
      const hostId = `host-${intf.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
      if (!nodeMap.has(hostId)) {
        const vlanTag = intf.vlanAccess ? ` (VLAN ${intf.vlanAccess})` : "";
        nodes.push({
          id: hostId,
          label: `${intf.name}${vlanTag}`,
          type: "host",
          group: intf.vlanAccess ? `vlan-${intf.vlanAccess}` : "default",
          connections: [switchId],
        });
        nodeMap.add(hostId);
      }
    }
  }

  return nodes;
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
        title="Running-Config Decoder & Topology Workspace"
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
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-muted/40">Hostname</label>
                          <div className="flex items-center gap-3">
                            <Fingerprint className="size-4 text-accent" />
                            <span className="text-lg font-black text-foreground tracking-tight">{parsed.hostname || "Unnamed Device"}</span>
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
                    <div className="relative min-h-[500px] p-8 rounded-2xl bg-black/40 border border-white/5 overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--accent-rgb),0.03),transparent_70%)] pointer-events-none" />

                      {/* Core Switch (center) */}
                      {topologyNodes.filter(n => n.type === "switch").map(node => (
                        <div key={node.id} className="relative flex justify-center mb-16">
                          <div className="relative z-10 flex flex-col items-center gap-3 p-6 rounded-2xl bg-accent/10 border-2 border-accent/30 shadow-[0_0_30px_rgba(var(--accent-rgb),0.15)]">
                            <div className="size-12 rounded-xl bg-accent/20 flex items-center justify-center border border-accent/30">
                              <Router className="size-6 text-accent" />
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-black text-accent uppercase tracking-widest">{node.label || "Core Switch"}</span>
                              <span className="text-[8px] font-bold text-accent/60 uppercase tracking-widest">L3 Switch / Router</span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* VLAN & Host Clusters */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
                        {topologyNodes.filter(n => n.type === "vlan").map(node => (
                          <div key={node.id} className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all cursor-pointer">
                            <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                              <Layers className="size-5 text-purple-400" />
                            </div>
                            <span className="text-[10px] font-black text-purple-300 text-center uppercase tracking-tight leading-tight">{node.label}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ArrowRight className="size-3 text-muted/40" />
                              <span className="text-[7px] font-bold text-muted/40 uppercase tracking-widest">Connected to Core</span>
                            </div>
                          </div>
                        ))}

                        {/* Host access ports */}
                        {topologyNodes.filter(n => n.type === "host").map(node => (
                          <div key={node.id} className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all cursor-pointer">
                            <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                              <Monitor className="size-5 text-emerald-400" />
                            </div>
                            <span className="text-[10px] font-black text-emerald-300 text-center uppercase tracking-tight leading-tight">{node.label}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ArrowRight className="size-3 text-muted/40" />
                              <span className="text-[7px] font-bold text-muted/40 uppercase tracking-widest">Access Port</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Router node */}
                      {topologyNodes.filter(n => n.type === "router").map(node => (
                        <div key={node.id} className="flex justify-center mt-8">
                          <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 transition-all">
                            <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                              <Radio className="size-5 text-amber-400" />
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider">{node.label}</span>
                              <span className="text-[7px] font-bold text-amber-400/60 uppercase tracking-widest">
                                {parsed?.routingProtocols.join(" / ") || "Routing"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

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
