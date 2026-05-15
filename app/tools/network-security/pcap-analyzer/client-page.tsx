"use client";

import React, { useState, useMemo, useRef } from "react";
import { 
  ShieldCheck, 
  Search, 
  Upload, 
  Terminal, 
  Network, 
  Globe, 
  AlertTriangle, 
  ArrowRight,
  Database,
  Cpu,
  Clock,
  HardDrive,
  FileSearch,
  Download,
  Layers,
  Fingerprint,
  ChevronDown,
  Trash2,
  MousePointer2
} from "lucide-react";
import { motion } from "framer-motion";
import { ToolContainer, ToolHeader, ToolButton } from "@/components/tools";
import GlassCard from "@/components/ui/GlassCard";

/* -------------------------------------------------------------------------- */
/*                               PCAP ENGINE TYPE DEFS                         */
/* -------------------------------------------------------------------------- */

interface Packet {
  id: number;
  timestamp: number;
  origTimestamp: number;
  len: number;
  caplen: number;
  protocol: string;
  source: string;
  dest: string;
  sourcePort?: number;
  destPort?: number;
  summary: string;
  payload: Uint8Array;
  layers?: PacketLayer[]; // Optional, decoded on-demand
  risk?: "LOW" | "MEDIUM" | "HIGH";
  flags?: string[];
}

interface PacketLayer {
  name: string;
  fields: { name: string; value: string | number; hex?: string }[];
}

interface Conversation {
  id: string;
  source: string;
  dest: string;
  protocol: string;
  packetCount: number;
  byteCount: number;
  duration: number;
  packets: Packet[];
}

interface AnalysisResult {
  packets: Packet[];
  conversations: Conversation[];
  stats: {
    totalPackets: number;
    totalBytes: number;
    duration: number;
    protocols: Record<string, number>;
    hosts: Set<string>;
    threats: number;
  };
  iocs: { type: "IP" | "DOMAIN" | "URL" | "HASH"; value: string; count: number }[];
}

/* -------------------------------------------------------------------------- */
/*                               PCAP PARSER CORE                             */
/* -------------------------------------------------------------------------- */

class PcapParser {
  private view: DataView;
  private offset: number = 0;
  private isLittleEndian: boolean = true;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  parse(): AnalysisResult {
    const packets: Packet[] = [];
    const stats = {
      totalPackets: 0,
      totalBytes: 0,
      duration: 0,
      protocols: {} as Record<string, number>,
      hosts: new Set<string>(),
      threats: 0
    };

    // Global Header (24 bytes)
    if (this.view.byteLength < 24) throw new Error("Invalid PCAP file: Too short");
    
    const magicNumber = this.view.getUint32(0, true);
    if (magicNumber === 0xA1B2C3D4) {
      this.isLittleEndian = true;
    } else if (magicNumber === 0xD4C3B2A1) {
      this.isLittleEndian = false;
    } else {
      // Basic check for PCAPNG (Simplified support)
      const pcapngMagic = this.view.getUint32(0, true);
      if (pcapngMagic === 0x0A0D0D0A) {
        return this.parsePcapng();
      }
      throw new Error("Unsupported PCAP format (Magic: 0x" + magicNumber.toString(16) + ")");
    }

    this.offset = 24;
    let firstTs = 0;
    let lastTs = 0;

    while (this.offset + 16 <= this.view.byteLength) {
      const tsSec = this.view.getUint32(this.offset, this.isLittleEndian);
      const tsUsec = this.view.getUint32(this.offset + 4, this.isLittleEndian);
      const caplen = this.view.getUint32(this.offset + 8, this.isLittleEndian);
      const origlen = this.view.getUint32(this.offset + 12, this.isLittleEndian);
      this.offset += 16;

      if (this.offset + caplen > this.view.byteLength) break;

      const fullTs = tsSec + tsUsec / 1000000;
      if (firstTs === 0) firstTs = fullTs;
      lastTs = fullTs;

      const payload = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, caplen);
      this.offset += caplen;

      const packet = this.decodePacketFast(packets.length + 1, fullTs, payload, origlen);
      packets.push(packet);

      // Update Stats
      stats.totalPackets++;
      stats.totalBytes += origlen;
      stats.protocols[packet.protocol] = (stats.protocols[packet.protocol] || 0) + 1;
      stats.hosts.add(packet.source);
      stats.hosts.add(packet.dest);
      if (packet.risk === "HIGH") stats.threats++;
    }

    stats.duration = lastTs - firstTs;

    return {
      packets,
      conversations: this.buildConversations(packets),
      stats,
      iocs: this.extractIocs(packets)
    };
  }

  private parsePcapng(): AnalysisResult {
    // Very simplified PCAPNG parsing - just looking for packet blocks
    // In a real app we'd parse the full block structure.
    // For this lab, we'll suggest a standard PCAP conversion or basic block skip.
    throw new Error("Direct PCAPNG parsing coming soon. Please use standard PCAP for now.");
  }

  private decodePacketFast(id: number, ts: number, data: Uint8Array, origLen: number): Packet {
    let source = "Unknown";
    let dest = "Unknown";
    let protocol = "Other";
    let summary = "Raw Packet Data";
    let risk: Packet["risk"] = "LOW";
    let sourcePort: number | undefined;
    let destPort: number | undefined;
    const flags: string[] = [];

    // Layer 2: Ethernet
    if (data.length >= 14) {
      const ethType = (data[12] << 8) | data[13];

      // Layer 3: IPv4
      if (ethType === 0x0800 && data.length >= 34) {
        const ipSrc = `${data[26]}.${data[27]}.${data[28]}.${data[29]}`;
        const ipDst = `${data[30]}.${data[31]}.${data[32]}.${data[33]}`;
        const ipProto = data[23];
        source = ipSrc;
        dest = ipDst;

        // Layer 4
        const l4Offset = 14 + (data[14] & 0x0F) * 4;
        if (ipProto === 6 && data.length >= l4Offset + 20) { // TCP
          protocol = "TCP";
          sourcePort = (data[l4Offset] << 8) | data[l4Offset + 1];
          destPort = (data[l4Offset + 2] << 8) | data[l4Offset + 3];
          summary = `${sourcePort} → ${destPort}`;
          
          const tcpFlags = data[l4Offset + 13];
          if (tcpFlags & 0x02) flags.push("SYN");
          if (tcpFlags & 0x01) flags.push("FIN");
          if (tcpFlags & 0x04) flags.push("RST");
          if (tcpFlags & 0x10) flags.push("ACK");
          if (tcpFlags & 0x08) flags.push("PSH");

          if (tcpFlags & 0x04) risk = "MEDIUM";
        } else if (ipProto === 17 && data.length >= l4Offset + 8) { // UDP
          protocol = "UDP";
          sourcePort = (data[l4Offset] << 8) | data[l4Offset + 1];
          destPort = (data[l4Offset + 2] << 8) | data[l4Offset + 3];
          summary = `${sourcePort} → ${destPort}`;
          if (destPort === 53 || sourcePort === 53) protocol = "DNS";
        } else if (ipProto === 1) {
          protocol = "ICMP";
          summary = "Control Message";
        }
      }
    }

    return {
      id,
      timestamp: ts,
      origTimestamp: ts,
      len: origLen,
      caplen: data.length,
      protocol,
      source,
      dest,
      sourcePort,
      destPort,
      summary,
      payload: data,
      risk,
      flags: flags.length > 0 ? flags : undefined
    };
  }

  public static decodeFullPacket(packet: Packet): PacketLayer[] {
    const data = packet.payload;
    const layers: PacketLayer[] = [];

    // Ethernet
    if (data.length >= 14) {
      const ethType = (data[12] << 8) | data[13];
      layers.push({
        name: "Ethernet II",
        fields: [
          { name: "Source", value: PcapParser.toMac(data.slice(6, 12)) },
          { name: "Destination", value: PcapParser.toMac(data.slice(0, 6)) },
          { name: "Type", value: "0x" + ethType.toString(16) }
        ]
      });

      // IPv4
      if (ethType === 0x0800 && data.length >= 34) {
        const ipProto = data[23];
        layers.push({
          name: "IPv4",
          fields: [
            { name: "Source IP", value: packet.source },
            { name: "Destination IP", value: packet.dest },
            { name: "Protocol", value: PcapParser.ipProtoToString(ipProto) },
            { name: "TTL", value: data[22] },
            { name: "Header Length", value: (data[14] & 0x0F) * 4 }
          ]
        });

        const l4Offset = 14 + (data[14] & 0x0F) * 4;
        if (ipProto === 6 && data.length >= l4Offset + 20) {
          const tcpFlags = data[l4Offset + 13];
          layers.push({
            name: "TCP",
            fields: [
              { name: "Source Port", value: packet.sourcePort || 0 },
              { name: "Destination Port", value: packet.destPort || 0 },
              { name: "Sequence Number", value: new DataView(data.buffer, data.byteOffset + l4Offset + 4).getUint32(0, false) },
              { name: "Acknowledgment Number", value: new DataView(data.buffer, data.byteOffset + l4Offset + 8).getUint32(0, false) },
              { name: "Flags", value: "0x" + tcpFlags.toString(16) }
            ]
          });

          // HTTP check
          const appData = data.slice(l4Offset + 20);
          if (appData.length > 5) {
            const appStr = new TextDecoder().decode(appData.slice(0, 100));
            if (appStr.includes("GET ") || appStr.includes("POST ") || appStr.includes("HTTP/1.1")) {
              layers.push({
                name: "HTTP",
                fields: [
                  { name: "Summary", value: appStr.split("\r\n")[0] },
                  { name: "Full Payload Preview", value: appStr.slice(0, 500) }
                ]
              });
            }
          }
        } else if (ipProto === 17 && data.length >= l4Offset + 8) {
          layers.push({
            name: "UDP",
            fields: [
              { name: "Source Port", value: packet.sourcePort || 0 },
              { name: "Destination Port", value: packet.destPort || 0 },
              { name: "Length", value: (data[l4Offset + 4] << 8) | data[l4Offset + 5] }
            ]
          });
        }
      }
    }
    return layers;
  }

  private static toMac(data: Uint8Array): string {
    return Array.from(data).map(b => b.toString(16).padStart(2, "0")).join(":");
  }

  private static ipProtoToString(p: number): string {
    if (p === 6) return "TCP (6)";
    if (p === 17) return "UDP (17)";
    if (p === 1) return "ICMP (1)";
    return p.toString();
  }

  private buildConversations(packets: Packet[]): Conversation[] {
    const convMap = new Map<string, Conversation>();
    packets.forEach(p => {
      const ids = [p.source, p.dest].sort();
      const id = `${ids[0]}-${ids[1]}-${p.protocol}`;
      
      let conv = convMap.get(id);
      if (!conv) {
        conv = {
          id,
          source: p.source,
          dest: p.dest,
          protocol: p.protocol,
          packetCount: 0,
          byteCount: 0,
          duration: 0,
          packets: []
        };
        convMap.set(id, conv);
      }
      
      conv.packetCount++;
      conv.byteCount += p.len;
      conv.packets.push(p);
      conv.duration = p.timestamp - conv.packets[0].timestamp;
    });
    return Array.from(convMap.values()).sort((a, b) => b.packetCount - a.packetCount);
  }

  private extractIocs(packets: Packet[]): AnalysisResult["iocs"] {
    const iocMap = new Map<string, { type: "IP" | "DOMAIN" | "URL" | "HASH"; value: string; count: number }>();
    
    packets.forEach(p => {
      // IPs
      [p.source, p.dest].forEach(ip => {
        if (ip === "Unknown" || ip.includes(":")) return;
        const key = `IP-${ip}`;
        const existing = iocMap.get(key);
        if (existing) existing.count++;
        else iocMap.set(key, { type: "IP", value: ip, count: 1 });
      });

      // Simple URL extraction from summary/payload
      if (p.protocol === "HTTP") {
        const urlMatch = p.summary.match(/GET\s+([^\s]+)/);
        if (urlMatch) {
          const url = urlMatch[1];
          const key = `URL-${url}`;
          const existing = iocMap.get(key);
          if (existing) existing.count++;
          else iocMap.set(key, { type: "URL", value: url, count: 1 });
        }
      }
    });

    return Array.from(iocMap.values()).sort((a, b) => b.count - a.count);
  }
}

/* -------------------------------------------------------------------------- */
/*                               UI COMPONENTS                                */
/* -------------------------------------------------------------------------- */

export default function PcapAnalyzerClient() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [activeProtoFilters, setActiveProtoFilters] = useState<Set<string>>(new Set(["ALL"]));
  const [isDragging, setIsDragging] = useState(false);
  const [view, setView] = useState<"FEED" | "CONV" | "IOCS">("FEED");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setIsAnalyzing(true);
    setResult(null);
    setSelectedPacket(null);

    try {
      const buffer = await file.arrayBuffer();
      const parser = new PcapParser(buffer);
      const res = parser.parse();
      setResult(res);
    } catch (err: unknown) {
      alert("Error parsing PCAP: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleProtoFilter = (p: string) => {
    const next = new Set(activeProtoFilters);
    if (p === "ALL") {
      next.clear();
      next.add("ALL");
    } else {
      next.delete("ALL");
      if (next.has(p)) next.delete(p);
      else next.add(p);
      if (next.size === 0) next.add("ALL");
    }
    setActiveProtoFilters(next);
  };

  const filteredPackets = useMemo(() => {
    if (!result) return [];
    
    const query = filterQuery.toLowerCase().trim();
    if (!query && activeProtoFilters.has("ALL")) return result.packets;

    const terms = query.split(/\s+/).filter(Boolean);
    
    return result.packets.filter(p => {
      // Protocol Multi-select Filter
      if (!activeProtoFilters.has("ALL") && !activeProtoFilters.has(p.protocol)) return false;
      if (terms.length === 0) return true;

      // Every term must match (AND logic)
      return terms.every(term => {
        if (term.includes(":")) {
          const [key, val] = term.split(":");
          if (!val) return true;
          if (key === "ip") return p.source.includes(val) || p.dest.includes(val);
          if (key === "src") return p.source.includes(val);
          if (key === "dst") return p.dest.includes(val);
          if (key === "port") return p.sourcePort === parseInt(val) || p.destPort === parseInt(val);
          if (key === "proto") return p.protocol.toLowerCase().includes(val);
          if (key === "flag") return p.flags?.some(f => f.toLowerCase() === val);
          if (key === "len") return p.len >= parseInt(val);
        }

        // Quick Search (OR across fields for this term)
        return (
          p.source.includes(term) || 
          p.dest.includes(term) || 
          p.protocol.toLowerCase().includes(term) ||
          p.summary.toLowerCase().includes(term) ||
          p.flags?.some(f => f.toLowerCase().includes(term))
        );
      });
    });
  }, [result, activeProtoFilters, filterQuery]);

  const highlight = (text: string, query: string) => {
    if (!query.trim()) return text;
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1 && !t.includes(":"));
    if (terms.length === 0) return text;

    let result: (string | React.ReactNode)[] = [text];
    
    terms.forEach(term => {
      const nextResult: (string | React.ReactNode)[] = [];
      result.forEach(part => {
        if (typeof part !== "string") {
          nextResult.push(part);
          return;
        }
        
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
        const splits = part.split(regex);
        splits.forEach((split, idx) => {
          if (split.toLowerCase() === term.toLowerCase()) {
            nextResult.push(<mark key={`${term}-${idx}`} className="bg-accent/40 text-white rounded-sm px-0.5">{split}</mark>);
          } else if (split) {
            nextResult.push(split);
          }
        });
      });
      result = nextResult;
    });
    
    return result;
  };

  const handleSelectPacket = (p: Packet) => {
    if (!p.layers) {
      p.layers = PcapParser.decodeFullPacket(p);
    }
    setSelectedPacket({ ...p });
  };

  const protoDistribution = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.stats.protocols)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [result]);

  const renderHexView = (data: Uint8Array) => {
    const hex = [];
    const ascii = [];
    const rows = [];

    for (let i = 0; i < Math.min(data.length, 512); i++) {
      hex.push(data[i].toString(16).padStart(2, "0").toUpperCase());
      ascii.push(data[i] >= 32 && data[i] <= 126 ? String.fromCharCode(data[i]) : ".");
      
      if ((i + 1) % 16 === 0 || i === data.length - 1) {
        rows.push({
          offset: (rows.length * 16).toString(16).padStart(4, "0").toUpperCase(),
          hex: hex.join(" "),
          ascii: ascii.join("")
        });
        hex.length = 0;
        ascii.length = 0;
      }
    }

    return (
      <div className="font-mono text-[10px] leading-tight text-muted/80">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-4 py-0.5 hover:bg-white/5 px-2 rounded">
            <span className="text-accent/60">{row.offset}</span>
            <span className="text-foreground/70">{row.hex.padEnd(47)}</span>
            <span className="text-emerald-500/60 select-none">|</span>
            <span className="text-blue-400/80">{row.ascii}</span>
          </div>
        ))}
        {data.length > 512 && (
          <div className="text-center py-2 text-[9px] uppercase tracking-widest opacity-30">
            ... payload truncated for performance ...
          </div>
        )}
      </div>
    );
  };

  return (
    <ToolContainer categoryId="network-security" className="relative">
      <div className="absolute top-8 right-8 px-3 py-1 bg-accent/10 border border-accent/20 text-[9px] font-black uppercase tracking-widest text-accent/60 rounded-xl z-20">
        v1.1.0-PRO • HIGH PERFORMANCE
      </div>

      <ToolHeader 
        title="PCAP Analyzer" 
        description="Cinematic packet investigation workstation. Perform local forensic analysis on network captures without compromising privacy."
        categoryId="network-security"
      />

      <div className="flex flex-col gap-8 max-w-[96rem] mx-auto w-full">
        
        {/* INGESTION AREA */}
        {!result && !isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <div 
              className={`relative group cursor-pointer transition-all duration-500 ${isDragging ? "scale-[0.98]" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-accent/30 to-blue-500/30 rounded-[3rem] blur-xl opacity-20 group-hover:opacity-40 transition duration-1000" />
              
              <GlassCard className="relative p-16 flex flex-col items-center justify-center gap-8 border-white/5 border-dashed border-2 hover:border-accent/40 bg-black/40 transition-colors">
                <div className="size-24 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20">
                  <Upload className="size-10 text-accent animate-pulse" />
                </div>
                
                <div className="flex flex-col items-center gap-2 text-center">
                  <h3 className="text-2xl font-black uppercase tracking-widest text-foreground">Initiate Packet Analysis</h3>
                  <p className="text-sm font-bold text-muted uppercase tracking-tighter max-w-md">
                    Drag and drop <span className="text-accent">.pcap</span> or <span className="text-accent">.pcapng</span> files. 
                    All decryption and parsing happens entirely in your local browser sandbox.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
                  {[
                    { label: "Wireshark Logs", icon: Globe },
                    { label: "TCPDump Dumps", icon: Terminal },
                    { label: "Intrusion Detection", icon: ShieldCheck },
                    { label: "Forensic Traces", icon: FileSearch }
                  ].map((f, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <f.icon className="size-5 text-muted/40" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted/60 text-center">{f.label}</span>
                    </div>
                  ))}
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pcap,.pcapng,.cap"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </GlassCard>
            </div>
          </motion.div>
        )}

        {/* LOADING STATE */}
        {isAnalyzing && (
          <GlassCard className="p-20 flex flex-col items-center justify-center gap-8">
            <div className="relative">
              <div className="size-20 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Database className="size-8 text-accent animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Reconstructing Traffic Streams</h3>
              <p className="text-xs font-bold text-muted uppercase animate-pulse">Parsing Binary Buffers...</p>
            </div>
          </GlassCard>
        )}

        {/* ANALYSIS WORKSPACE */}
        {result && (
          <div className="flex flex-col gap-8 animate-fadeIn">
            
            {/* TOP STATS BAR */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "Total Packets", value: result.stats.totalPackets.toLocaleString(), icon: Layers, color: "text-blue-400" },
                { label: "Unique Hosts", value: result.stats.hosts.size, icon: Globe, color: "text-emerald-400" },
                { label: "Data Volume", value: `${(result.stats.totalBytes / 1024).toFixed(1)} KB`, icon: HardDrive, color: "text-amber-400" },
                { label: "Duration", value: `${result.stats.duration.toFixed(2)}s`, icon: Clock, color: "text-purple-400" },
                { label: "Threat Events", value: result.stats.threats, icon: AlertTriangle, color: result.stats.threats > 0 ? "text-red-400" : "text-emerald-400" },
                { label: "Workload", value: "Browser-Local", icon: Cpu, color: "text-accent" }
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

            {/* MAIN WORKSPACE GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT: FILTERS & PROTOCOLS */}
              <div className="lg:col-span-3 flex flex-col gap-6">
                <GlassCard className="p-4 flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-accent">Protocol Distribution</h4>
                    <div className="flex flex-col gap-2 mt-2">
                      {["ALL", ...protoDistribution.map(p => p[0])].map((p, i) => {
                        const count = p === "ALL" ? result.stats.totalPackets : result.stats.protocols[p];
                        const pct = (count / result.stats.totalPackets) * 100;
                        const isActive = activeProtoFilters.has(p);
                        return (
                          <button 
                            key={i}
                            onClick={() => toggleProtoFilter(p)}
                            className={`flex flex-col gap-1 group w-full text-left transition-all ${isActive ? "opacity-100" : "opacity-40 hover:opacity-70"}`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                              <span>{p}</span>
                              <span className="text-muted">{count}</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-accent transition-all duration-500" 
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4 flex flex-col gap-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-accent">Host Intelligence</h4>
                    <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {Array.from(result.stats.hosts).slice(0, 10).map((h, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
                          <Network className="size-3 text-muted/40 group-hover:text-accent transition-colors" />
                          <span className="text-[11px] font-mono text-muted/80">{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                <ToolButton variant="secondary" size="sm" onClick={() => setResult(null)} className="w-full text-red-400 border-red-500/20">
                  <Trash2 className="size-4 mr-2" /> Unload Capture
                </ToolButton>
              </div>

              {/* CENTER: TRAFFIC FEED */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                {/* Search & Advanced Filters */}
                <div className="flex flex-col gap-3">
                  <GlassCard className="p-2 flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted/40" />
                      <input 
                        type="text" 
                        placeholder="Filter (e.g. ip:192.168.1.1, port:443, syn)..."
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        className="toolsy-input w-full bg-transparent border-none pl-10 h-10 text-sm focus:ring-0"
                      />
                    </div>
                    <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-lg border border-white/5">
                      <button onClick={() => setView("FEED")} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${view === 'FEED' ? 'bg-white/10 text-foreground' : 'text-muted'}`}>Feed</button>
                      <button onClick={() => setView("CONV")} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${view === 'CONV' ? 'bg-white/10 text-foreground' : 'text-muted'}`}>Streams</button>
                      <button onClick={() => setView("IOCS")} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${view === 'IOCS' ? 'bg-white/10 text-foreground' : 'text-muted'}`}>IOCs</button>
                    </div>
                  </GlassCard>

                  <div className="flex flex-wrap gap-2 items-center min-h-[28px]">
                    {filterQuery && (
                      <button 
                        onClick={() => setFilterQuery("")}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 className="size-3" /> Clear Filters
                      </button>
                    )}
                    <div className="ml-auto text-[9px] font-black uppercase tracking-widest text-muted/40">
                      Showing {filteredPackets.length.toLocaleString()} of {result.packets.length.toLocaleString()} packets
                    </div>
                  </div>

                  {/* Filter Chips */}
                  <div className="flex flex-wrap gap-2 items-center min-h-[28px]">
                    {["tcp", "udp", "dns", "syn", "rst"].map(f => (
                      <button
                        key={f}
                        onClick={() => setFilterQuery(prev => prev.includes(f) ? prev.replace(f, "").trim() : `${prev} ${f}`.trim())}
                        className={`px-2.5 py-1 rounded-md border text-[9px] font-black uppercase tracking-[0.15em] transition-all ${filterQuery.includes(f) ? "bg-accent/20 border-accent/40 text-accent" : "bg-white/5 border-white/10 text-muted hover:border-white/20"}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>


                {/* Packet List with TRUE Virtualization */}
                <div className="relative toolsy-card bg-black/20 border-white/5 overflow-hidden">
                  <div className="flex items-center gap-4 px-6 py-3 border-b border-white/5 bg-white/[0.02] text-[9px] font-black uppercase tracking-widest text-muted/60">
                    <div className="w-10">ID</div>
                    <div className="w-12 text-center">Proto</div>
                    <div className="flex-1">Traffic Flow (Source → Destination)</div>
                    <div className="w-[180px] text-right">Operational Summary</div>
                  </div>
                  
                  <div className="flex flex-col max-h-[750px] overflow-y-auto custom-scrollbar relative">
                    {view === "FEED" && filteredPackets.slice(0, 500).map((p) => (
                      <div 
                        key={p.id}
                        onClick={() => handleSelectPacket(p)}
                        className={`group flex items-center gap-4 px-6 py-2 border-b border-white/[0.02] transition-all cursor-pointer ${selectedPacket?.id === p.id ? 'bg-accent/15 border-l-2 border-l-accent shadow-[inset_4px_0_12px_rgba(var(--accent-rgb),0.1)]' : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'}`}
                      >
                        <div className="w-10 text-[10px] font-mono text-muted/30 tabular-nums">
                          {p.id}
                        </div>
                        
                        <div className={`w-12 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-center ${
                          p.protocol === 'TCP' ? 'text-blue-400' :
                          p.protocol === 'UDP' ? 'text-amber-400' :
                          p.protocol === 'HTTP' || p.protocol === 'DNS' ? 'text-emerald-400' :
                          'text-muted/60'
                        }`}>
                          {p.protocol}
                        </div>

                        <div className="flex-1 flex items-center gap-4 overflow-hidden">
                          <span className="text-[11px] font-mono font-bold text-foreground/70 truncate tabular-nums w-[140px]">{highlight(p.source, filterQuery)}</span>
                          <ArrowRight className="size-3 text-muted/10 shrink-0" />
                          <span className="text-[11px] font-mono font-bold text-foreground/70 truncate tabular-nums w-[140px]">{highlight(p.dest, filterQuery)}</span>
                        </div>

                        <div className="flex items-center justify-end gap-4 min-w-[180px]">
                          <span className="text-[10px] font-bold text-accent/60 font-mono truncate max-w-[120px]">{highlight(p.summary, filterQuery)}</span>
                          <span className="text-[9px] font-black text-muted/20 tabular-nums w-8 text-right">{p.len}B</span>
                        </div>
                      </div>
                    ))}

                    {filteredPackets.length > 500 && view === "FEED" && (
                      <div className="p-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted/30 italic">
                        Viewing first 500 results. Use filters to narrow down search.
                      </div>
                    )}

                    {view === "CONV" && result.conversations.map((c, i) => (
                      <div 
                        key={i} 
                        onClick={() => {
                          setFilterQuery(`ip:${c.source} ip:${c.dest}`);
                          setView("FEED");
                        }}
                        className="px-6 py-4 flex items-center justify-between border-b border-white/[0.02] hover:bg-white/[0.02] transition-all cursor-pointer group/conv"
                      >
                        <div className="flex items-center gap-6">
                          <div className="size-8 rounded-lg bg-accent/5 flex items-center justify-center border border-accent/10">
                            <Network className="size-4 text-accent" />
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-4 text-sm font-mono">
                              <span className="text-foreground/80 group-hover/conv:text-accent transition-colors">{c.source}</span>
                              <ArrowRight className="size-3 text-muted/20" />
                              <span className="text-foreground/80 group-hover/conv:text-accent transition-colors">{c.dest}</span>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted/40">{c.protocol} Stream • {c.packetCount} Packets</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="flex flex-col items-end">
                            <span className="text-[11px] font-bold text-foreground/60">{c.duration.toFixed(3)}s</span>
                            <span className="text-[9px] font-black uppercase text-muted/30">Duration</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[11px] font-bold text-foreground/60">{(c.byteCount / 1024).toFixed(1)} KB</span>
                            <span className="text-[9px] font-black uppercase text-muted/30">Volume</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {view === "IOCS" && result.iocs.map((ioc, i) => (
                      <div key={i} className="px-6 py-4 flex items-center justify-between group hover:bg-white/[0.02] border-b border-white/[0.02]">
                        <div className="flex items-center gap-4">
                          <div className={`size-10 rounded-xl flex items-center justify-center border ${
                            ioc.type === 'IP' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                            ioc.type === 'URL' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            'bg-purple-500/10 border-purple-500/20 text-purple-400'
                          }`}>
                            <Fingerprint className="size-5" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted">{ioc.type}</span>
                            <span className="text-sm font-mono text-foreground font-medium">{ioc.value}</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-black text-muted opacity-40 uppercase group-hover:text-accent transition-colors">
                          Seen {ioc.count}x
                        </div>
                      </div>
                    ))}

                    {filteredPackets.length === 0 && view === "FEED" && (
                      <div className="py-20 flex flex-col items-center justify-center gap-4 text-muted/40">
                        <FileSearch className="size-12" />
                        <p className="text-xs font-bold uppercase tracking-widest">No matching packets found</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT: DETAIL PANEL */}
              <div className="lg:col-span-3 flex flex-col gap-6 sticky top-24">
                <GlassCard className="flex flex-col overflow-hidden min-h-[600px]">
                  <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSearch className="size-4 text-accent" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground">Packet Inspector</h4>
                    </div>
                    {selectedPacket && (
                      <span className="text-[10px] font-black text-muted select-none">#{selectedPacket.id}</span>
                    )}
                  </div>

                  {!selectedPacket ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center opacity-30">
                      <MousePointer2 className="size-10" />
                      <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                        Select a packet from the feed to decode layers and inspect payload hex.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Decode Tree */}
                      <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[450px] custom-scrollbar border-b border-white/5">
                        {selectedPacket.layers?.map((layer, li) => (
                          <div key={li} className="flex flex-col gap-2">
                            <details open={li < 2} className="group/details">
                              <summary className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent cursor-pointer list-none hover:text-foreground transition-colors">
                                <ChevronDown className="size-3 group-open/details:rotate-0 -rotate-90 transition-transform" />
                                {layer.name}
                              </summary>
                              <div className="flex flex-col gap-1.5 pl-5 mt-2 border-l border-white/5">
                                {layer.fields.map((f, fi) => (
                                  <div key={fi} className="flex items-start justify-between group/field py-0.5">
                                    <span className="text-[10px] text-muted font-medium whitespace-nowrap">{f.name}</span>
                                    <span className="text-[11px] font-mono text-foreground/80 break-all text-right ml-4 tabular-nums">{f.value}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        ))}
                      </div>

                      {/* Hex View */}
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted/60">Raw Data (Hex/ASCII)</span>
                          <span className="text-[9px] font-black text-accent/60 uppercase tracking-widest">{selectedPacket.caplen} Bytes</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-black/40">
                          {renderHexView(selectedPacket.payload)}
                        </div>
                      </div>
                    </div>
                  )}
                </GlassCard>

                {selectedPacket && (
                  <ToolButton variant="primary" size="sm" className="w-full">
                    <Download className="size-4 mr-2" /> Export Packet Data
                  </ToolButton>
                )}
              </div>

            </div>

            {/* ANALYTICS INSIGHTS DOCS */}
            <section className="mt-8 pt-12 border-t border-white/5 flex flex-col gap-12">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-foreground">Operational Intelligence</h3>
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Traffic Analysis & Threat Investigation Guidance</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[
                  {
                    title: "Advanced Triage",
                    icon: FileSearch,
                    color: "text-blue-400",
                    desc: "Use the filter engine for rapid investigation. Use 'ip:8.8.8.8' to isolate hosts, 'port:443' for encrypted traffic, or 'syn' to identify connection attempts and potential scans."
                  },
                  {
                    title: "Stream Analysis",
                    icon: Layers,
                    color: "text-emerald-400",
                    desc: "Switch to 'Streams' view to collapse noisy traffic into logical conversations. Clicking a stream automatically applies a precise host-pair filter to the main feed for focused inspection."
                  },
                  {
                    title: "Operational Search",
                    icon: Search,
                    color: "text-accent",
                    desc: "The search bar supports complex queries. Combine terms like 'src:10.0.0.1 dst:10.0.0.5 proto:tcp' to surgically isolate anomalous traffic within massive enterprise-grade captures."
                  }
                ].map((d, i) => (
                  <GlassCard key={i} className="p-6 flex flex-col gap-4 border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-xl bg-white/5 flex items-center justify-center ${d.color}`}>
                        <d.icon className="size-5" />
                      </div>
                      <h4 className="text-[11px] font-black uppercase tracking-widest">{d.title}</h4>
                    </div>
                    <p className="text-[11px] font-medium text-muted/60 leading-relaxed">
                      {d.desc}
                    </p>
                  </GlassCard>
                ))}
              </div>
            </section>
          </div>
        )}

      </div>
    </ToolContainer>
  );
}

