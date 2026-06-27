"use client";

import { useState, useMemo } from "react";
import {
  ToolContainer,
  ToolHeader,
} from "@/components/tools";
import { 
  Globe, 
  Activity, 
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Server,
  Network,
  Zap,
  Settings2,
  Shield,
  Crosshair,
  Filter,
  Radio,
  Wifi,
  ArrowUpDown,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/ui/GlassCard";
import { PORT_ENCYCLOPEDIA, PortIntelligence } from "@/lib/port-intelligence";
import { parseClientPorts, scanPortLocally } from "@/lib/local-port-scanner";

/* ─────────────────────────────────────────────
   Types & Interfaces
  ───────────────────────────────────────────── */

interface ScanResult {
  host: string;
  port: number;
  protocol: "tcp" | "udp";
  status: "OPEN" | "CLOSED" | "TIMEOUT" | "UNREACHABLE" | "ERROR";
  latency: number;
  message: string;
}

interface BulkScanResponse {
  host: string;
  protocol: "tcp" | "udp";
  results: ScanResult[];
}

interface Preset {
  port: number;
  label: string;
  desc: string;
}

/* ─────────────────────────────────────────────
   Constants
  ───────────────────────────────────────────── */

const PRESETS: Preset[] = [
  { port: 80, label: "HTTP", desc: "Web Server" },
  { port: 443, label: "HTTPS", desc: "Secure Web Server" },
  { port: 21, label: "FTP", desc: "File Transfer Protocol" },
  { port: 22, label: "SSH", desc: "Secure Shell" },
  { port: 25, label: "SMTP", desc: "Mail Transfer Protocol" },
  { port: 53, label: "DNS", desc: "Domain Name System" },
  { port: 3306, label: "MySQL", desc: "Database" },
  { port: 5432, label: "PostgreSQL", desc: "Database" },
  { port: 27017, label: "MongoDB", desc: "Database" },
  { port: 6379, label: "Redis", desc: "In-memory Store" },
  { port: 3389, label: "RDP", desc: "Remote Desktop" },
  { port: 8080, label: "HTTP-ALT", desc: "Alternative Web Server" },
];

const STATUS_FILTERS = ["ALL", "OPEN", "CLOSED", "TIMEOUT", "UNREACHABLE"] as const;

/* ─────────────────────────────────────────────
   Component
  ───────────────────────────────────────────── */

export default function PortCheckerClient() {
  const [host, setHost] = useState<string>("");
  const [portInput, setPortInput] = useState<string>("");
  const [protocol, setProtocol] = useState<"tcp" | "udp">("tcp");
  const [timeoutMs, setTimeoutMs] = useState<number>(3000);
  const [scanMode, setScanMode] = useState<"local" | "remote">("remote");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<BulkScanResponse | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<"port" | "latency" | "status">("port");
  const [sortAsc, setSortAsc] = useState(true);
  const [showResultsTable, setShowResultsTable] = useState(true);

  const handleScan = async () => {
    if (!host || !portInput) return;
    
    setIsScanning(true);
    setScanResult(null);
    setSelectedPort(null);

    try {
      if (scanMode === "remote") {
        const res = await fetch("/api/network/port-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host, port: portInput, protocol, timeout: timeoutMs }),
        });
        const data = await res.json();
        setScanResult(data);
      } else {
        const parsed = parseClientPorts(portInput);
        if (protocol === "udp") {
          const results: ScanResult[] = parsed.map(p => ({
            host,
            port: p,
            protocol: "udp",
            status: "ERROR",
            latency: 0,
            message: "UDP scanning is not supported in browser-local mode."
          }));
          setScanResult({ host, protocol: "udp", results });
        } else {
          const results: ScanResult[] = [];
          for (const p of parsed) {
            const res = await scanPortLocally(host, p, timeoutMs);
            results.push({
              host: res.host,
              port: res.port,
              protocol: res.protocol,
              status: res.status as any,
              latency: res.latency,
              message: res.message
            });
          }
          setScanResult({ host, protocol: "tcp", results });
        }
      }
    } catch {
      // ignore
    } finally {
      setIsScanning(false);
    }
  };

  const handlePresetSelect = (presetPort: number) => {
    const current = portInput.trim();
    if (!current) {
      setPortInput(String(presetPort));
    } else {
      const ports = current.split(",").map(p => p.trim()).filter(Boolean);
      if (!ports.includes(String(presetPort))) {
        ports.push(String(presetPort));
        setPortInput(ports.join(", "));
      }
    }
  };

  const filteredResults = useMemo(() => {
    if (!scanResult) return [];
    let results = scanResult.results;
    if (statusFilter !== "ALL") {
      results = results.filter(r => r.status === statusFilter);
    }
    results = [...results].sort((a, b) => {
      let cmp = 0;
      if (sortField === "port") cmp = a.port - b.port;
      else if (sortField === "latency") cmp = a.latency - b.latency;
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      return sortAsc ? cmp : -cmp;
    });
    return results;
  }, [scanResult, statusFilter, sortField, sortAsc]);

  const toggleSort = (field: "port" | "latency" | "status") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const selectedIntelligence: PortIntelligence | null = useMemo(() => {
    if (selectedPort === null) return null;
    return PORT_ENCYCLOPEDIA[selectedPort] || null;
  }, [selectedPort]);

  const openCount = useMemo(() => scanResult?.results.filter(r => r.status === "OPEN").length || 0, [scanResult]);
  const closedCount = useMemo(() => scanResult?.results.filter(r => r.status === "CLOSED").length || 0, [scanResult]);
  const timeoutCount = useMemo(() => scanResult?.results.filter(r => r.status === "TIMEOUT").length || 0, [scanResult]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "OPEN": return { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2, border: "border-emerald-500/20" };
      case "CLOSED": return { color: "text-red-400", bg: "bg-red-500/10", icon: XCircle, border: "border-red-500/20" };
      case "TIMEOUT": return { color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock, border: "border-amber-500/20" };
      case "UNREACHABLE": return { color: "text-red-400", bg: "bg-red-500/10", icon: AlertTriangle, border: "border-red-500/20" };
      default: return { color: "text-muted", bg: "bg-white/5", icon: AlertTriangle, border: "border-white/10" };
    }
  };

  return (
    <ToolContainer categoryId="network-security">
      <ToolHeader
        title="Port Checker"
        description="Cinematic network utility to instantly query service availability and diagnose firewall configurations."
        categoryId="network-security"
      />

      <div className="flex flex-col gap-6 pb-16">
        
        {/* TARGETING SECTION */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-accent/70">
              <Crosshair className="size-4" /> 01. Targeting
            </div>
            
            <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
              {[
                { id: "local", label: "Local (Browser)", icon: Zap },
                { id: "remote", label: "Remote (Server)", icon: Server }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setScanMode(m.id as "local" | "remote")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                    ${scanMode === m.id 
                      ? "bg-accent text-white shadow-lg shadow-accent/20" 
                      : "text-muted hover:text-foreground hover:bg-white/5"}`}
                >
                  <m.icon className="size-3" /> {m.label}
                </button>
              ))}
            </div>
          </div>

          <GlassCard className="p-8 flex flex-col gap-8 border-l-4 border-l-accent bg-accent/[0.02]">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="md:col-span-2 flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                  <Globe className="size-3" /> Target Host or IP
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. scanme.nmap.org"
                    className="toolsy-input w-full bg-black/40 border-2 border-white/5 font-mono text-sm pl-12 h-14 rounded-2xl focus:border-accent/40 transition-all"
                    onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  />
                  <Server className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted/40" />
                </div>
              </div>

              <div className="md:col-span-2 flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                  <Network className="size-3" /> Ports (comma/range)
                </label>
                <input
                  type="text"
                  value={portInput}
                  onChange={(e) => setPortInput(e.target.value)}
                  placeholder="e.g. 80,443,8080-8090"
                  className="toolsy-input w-full bg-black/40 border-2 border-white/5 font-mono text-sm h-14 rounded-2xl focus:border-accent/40 transition-all px-6"
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                />
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                  <Radio className="size-3" /> Protocol
                </label>
                <div className="flex gap-2 h-14">
                  {[
                    { id: "tcp", label: "TCP", icon: Wifi },
                    { id: "udp", label: "UDP", icon: Radio }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setProtocol(p.id as "tcp" | "udp")}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all
                        ${protocol === p.id
                          ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                          : "bg-black/40 border-white/5 text-muted hover:border-white/20"}`}
                    >
                      <p.icon className="size-3.5" /> {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted/40">Common Services (click to add)</span>
                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted hover:text-accent transition-colors"
                >
                  <Settings2 className="size-3" /> {showAdvanced ? "Hide Advanced" : "Advanced"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.port}
                    onClick={() => handlePresetSelect(p.port)}
                    className={`px-4 py-2 rounded-xl border font-mono text-[10px] uppercase tracking-wider transition-all
                      ${portInput.split(",").map(x => x.trim()).includes(String(p.port))
                        ? "bg-accent text-white border-accent shadow-lg shadow-accent/20" 
                        : "bg-white/[0.02] border-white/5 text-muted hover:bg-white/[0.06] hover:border-white/10"}`}
                  >
                    {p.label} <span className="opacity-40 ml-1">:{p.port}</span>
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-6 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-muted/60">
                        <span>Timeout Threshold</span>
                        <span className="text-accent">{timeoutMs}ms</span>
                      </div>
                      <input type="range" min="500" max="10000" step="500" value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value))} className="accent-accent w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    {scanMode === "local" && (
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                        <p className="text-[10px] text-amber-200/60 uppercase font-bold leading-relaxed">Local mode uses browser fetch and is subject to CORS/mixed-content policies. Best for internal web services.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              onClick={handleScan}
              disabled={isScanning || !host || !portInput}
              className="w-full h-16 bg-accent text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm hover:opacity-90 disabled:opacity-20 transition-all shadow-[0_0_40px_rgba(var(--accent-rgb),0.3)] active:scale-[0.98] flex items-center justify-center gap-3"
            >
              {isScanning ? <Activity className="size-5 animate-pulse" /> : <Network className="size-5" />}
              {isScanning ? "Engaging Radar..." : "Initiate Scan"}
            </button>
          </GlassCard>
        </section>

        {/* RESULTS SECTION */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-muted/40 ml-2">
            <Activity className="size-4" /> 02. Analysis
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Summary + Table */}
            <div className="xl:col-span-7 flex flex-col gap-6">
              {/* Summary Bar */}
              <GlassCard className="p-6">
                {!scanResult ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <Radio className="size-8 text-muted/10" />
                    <span className="text-[9px] font-black text-muted/30 uppercase tracking-[0.2em]">Awaiting Scan Data</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="size-4 text-emerald-400" />
                        <span className="text-xs font-black text-emerald-400">{openCount} Open</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <XCircle className="size-4 text-red-400" />
                        <span className="text-xs font-black text-red-400">{closedCount} Closed</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="size-4 text-amber-400" />
                        <span className="text-xs font-black text-amber-400">{timeoutCount} Timed Out</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-muted/40 font-mono">
                      {scanResult.host} / {scanResult.protocol.toUpperCase()}
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* Filter Bar */}
              {scanResult && scanResult.results.length > 0 && (
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="size-3.5 text-muted/40" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted/40 mr-2">Filter</span>
                      <div className="flex gap-1">
                        {STATUS_FILTERS.map(f => (
                          <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all
                              ${statusFilter === f ? "bg-accent/20 text-accent border border-accent/30" : "text-muted/60 hover:text-foreground hover:bg-white/5"}`}
                          >
                            {f === "ALL" ? `All (${scanResult.results.length})` : f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowResultsTable(!showResultsTable)}
                      className="text-muted/40 hover:text-foreground transition-colors"
                    >
                      {showResultsTable ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                  </div>
                </GlassCard>
              )}

              {/* Results Table */}
              {scanResult && scanResult.results.length > 0 && showResultsTable && (
                <GlassCard className="overflow-hidden">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="p-4 cursor-pointer" onClick={() => toggleSort("port")}>
                            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-muted/40">
                              Port <ArrowUpDown className="size-3" />
                            </div>
                          </th>
                          <th className="p-4 cursor-pointer" onClick={() => toggleSort("status")}>
                            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-muted/40">
                              Status <ArrowUpDown className="size-3" />
                            </div>
                          </th>
                          <th className="p-4 cursor-pointer" onClick={() => toggleSort("latency")}>
                            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-muted/40">
                              Latency <ArrowUpDown className="size-3" />
                            </div>
                          </th>
                          <th className="p-4">
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted/40">Service</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-[9px] font-black uppercase tracking-widest text-muted/20">
                              No matching results
                            </td>
                          </tr>
                        ) : (
                          filteredResults.map((r, i) => {
                            const info = getStatusInfo(r.status);
                            const iconClass = info.color;
                            const Icon = info.icon;
                            const intel = PORT_ENCYCLOPEDIA[r.port];
                            return (
                              <tr
                                key={i}
                                onClick={() => setSelectedPort(r.port)}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedPort(r.port); } }}
                                tabIndex={0}
                                role="button"
                                aria-label={`Port ${r.port}: ${r.status}`}
                                className={`border-b border-white/[0.03] cursor-pointer transition-all hover:bg-white/[0.03] ${selectedPort === r.port ? "bg-accent/5" : ""}`}
                              >
                                <td className="p-4">
                                  <span className="text-sm font-black font-mono text-foreground">:{r.port}</span>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <Icon className={`size-3.5 ${iconClass}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${iconClass}`}>{r.status}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="text-[11px] font-mono font-bold text-muted">{r.latency}ms</span>
                                </td>
                                <td className="p-4">
                                  {intel ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-black text-foreground uppercase">{intel.name}</span>
                                      <span className="text-[8px] font-mono text-muted/40">{intel.protocol}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] font-mono text-muted/40">Unknown</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              )}
            </div>

            {/* Intelligence Panel */}
            <GlassCard className="xl:col-span-5 p-8">
              {!selectedIntelligence ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 gap-6 border-2 border-dashed border-white/5 rounded-[32px]">
                  <Shield className="size-16 text-muted/10" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-muted/30 uppercase tracking-[0.2em]">Select a Port for Intelligence</span>
                    <span className="text-[8px] font-bold text-muted/20 uppercase tracking-widest">Click any row in the results table above</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  <div className="flex items-center justify-between border-b border-white/5 pb-6">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{selectedIntelligence.name}</h3>
                        <span className="px-2 py-1 rounded-lg bg-accent/10 border border-accent/20 text-[9px] font-black text-accent">{selectedIntelligence.protocol}</span>
                      </div>
                      <p className="text-xs text-muted/60">{selectedIntelligence.description}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest shadow-lg shadow-black/20
                      ${selectedIntelligence.riskClassification.includes('CRITICAL') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                      {selectedIntelligence.riskClassification}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted/40">Common Usage</span>
                        <p className="text-[11px] text-foreground/80 leading-relaxed font-medium">{selectedIntelligence.commonUsage}</p>
                      </div>
                      {selectedIntelligence.warning && (
                        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex flex-col gap-2">
                           <span className="text-[9px] font-black uppercase tracking-widest text-red-400 flex items-center gap-2"><AlertTriangle className="size-3" /> Security Warning</span>
                           <p className="text-[11px] text-red-200/60 font-medium">{selectedIntelligence.warning}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2"><Shield className="size-4" /> Hardening</span>
                      <div className="flex flex-col gap-3">
                        {selectedIntelligence.hardening.map((h, i) => (
                          <div key={i} className="flex items-start gap-3 text-[11px] text-muted/80">
                            <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {scanResult && (
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted/40">
                        <Globe className="size-3" /> {scanResult.host}
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted/40">
                        <Radio className="size-3" /> {scanResult.protocol.toUpperCase()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          </div>
        </section>
      </div>
    </ToolContainer>
  );
}
