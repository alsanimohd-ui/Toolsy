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
  Crosshair
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/ui/GlassCard";
import { PORT_ENCYCLOPEDIA, PortIntelligence } from "@/lib/port-intelligence";

/* ─────────────────────────────────────────────
   Types & Interfaces
  ───────────────────────────────────────────── */

interface ScanResult {
  host: string;
  port: number;
  status: "OPEN" | "CLOSED" | "TIMEOUT" | "UNREACHABLE" | "ERROR";
  latency: number;
  message: string;
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

/* ─────────────────────────────────────────────
   Component
  ───────────────────────────────────────────── */

export default function PortCheckerClient() {
  const [host, setHost] = useState<string>("");
  const [port, setPort] = useState<string>("");
  const [timeoutMs, setTimeoutMs] = useState<number>(3000);
  const [scanMode, setScanMode] = useState<"local" | "remote">("remote");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleScan = async () => {
    if (!host || !port) return;
    
    setIsScanning(true);
    setResult(null);

    try {
      if (scanMode === "remote") {
        const res = await fetch("/api/network/port-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host, port, timeout: timeoutMs }),
        });
        const data = await res.json();
        setResult(data);
      } else {
        // Local Browser Check (Limited to HTTP/S ports)
        const startTime = performance.now();
        try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), timeoutMs);
          
          await fetch(`https://${host}:${port}`, { mode: 'no-cors', signal: controller.signal });
          clearTimeout(id);
          
          setResult({
            host,
            port: parseInt(port, 10),
            status: "OPEN",
            latency: Math.round(performance.now() - startTime),
            message: "Port responded (Note: Local mode is limited to HTTP/S reachable ports)."
          });
        } catch (err: unknown) {
          const isAbort = err instanceof Error && err.name === "AbortError";
          const status: ScanResult["status"] = isAbort ? "TIMEOUT" : "CLOSED";
          setResult({
            host,
            port: parseInt(port, 10),
            status,
            latency: Math.round(performance.now() - startTime),
            message: isAbort ? "Connection timed out." : "Connection refused or blocked by browser security."
          });
        }
      }
    } catch {
      setResult({
        host,
        port: parseInt(port, 10),
        status: "ERROR",
        latency: 0,
        message: "Scanning engine encountered an internal error.",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handlePresetSelect = (presetPort: number) => {
    setPort(presetPort.toString());
  };

  const statusInfo = useMemo(() => {
    if (!result) return null;
    switch (result.status) {
      case "OPEN":
        return { label: "PORT OPEN", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2, border: "border-emerald-500/20" };
      case "CLOSED":
        return { label: "REFUSED", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle, border: "border-red-500/20" };
      case "TIMEOUT":
        return { label: "TIMEOUT", color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock, border: "border-amber-500/20" };
      case "UNREACHABLE":
        return { label: "UNREACHABLE", color: "text-red-400", bg: "bg-red-500/10", icon: AlertTriangle, border: "border-red-500/20" };
      default:
        return { label: "ERROR", color: "text-muted", bg: "bg-white/5", icon: AlertTriangle, border: "border-white/10" };
    }
  }, [result]);

  const intelligence: PortIntelligence | null = useMemo(() => {
    if (!result) return null;
    return PORT_ENCYCLOPEDIA[result.port] || null;
  }, [result]);

  return (
    <ToolContainer categoryId="network-security">
      <ToolHeader
        title="Port Checker"
        description="Cinematic network utility to instantly query service availability and diagnose firewall configurations."
        categoryId="network-security"
      />

      <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full pb-32">
        
        {/* TARGETING SECTION (Full Width) */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-accent/70">
              <Crosshair className="size-4" /> 01. Targeting
            </div>
            
            {/* Scan Mode Toggle */}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-3 flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                  <Globe className="size-3" /> Target Host or IP
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. scanme.nmap.org or 8.8.8.8"
                    className="toolsy-input w-full bg-black/40 border-2 border-white/5 font-mono text-sm pl-12 h-14 rounded-2xl focus:border-accent/40 transition-all"
                    onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  />
                  <Server className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted/40" />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                  <Activity className="size-3" /> Port
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="e.g. 443"
                  className="toolsy-input w-full bg-black/40 border-2 border-white/5 font-mono text-sm h-14 rounded-2xl focus:border-accent/40 transition-all px-6"
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                />
              </div>
            </div>

            {/* Presets Grid */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted/40">Common Services</span>
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
                      ${port === p.port.toString() 
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
              disabled={isScanning || !host || !port}
              className="w-full h-16 bg-accent text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm hover:opacity-90 disabled:opacity-20 transition-all shadow-[0_0_40px_rgba(var(--accent-rgb),0.3)] active:scale-[0.98] flex items-center justify-center gap-3"
            >
              {isScanning ? <Activity className="size-5 animate-pulse" /> : <Network className="size-5" />}
              {isScanning ? "Engaging Radar..." : "Initiate Scan"}
            </button>
          </GlassCard>
        </section>

        {/* RESULTS SECTION (Full Width) */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-muted/40 ml-2">
            <Activity className="size-4" /> 02. Analysis
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Status Visualizer */}
            <GlassCard className="xl:col-span-5 relative overflow-hidden flex flex-col items-center justify-center p-12 min-h-[400px]">
              <AnimatePresence mode="wait">
                {!result ? (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} className="flex flex-col items-center gap-6">
                    <Globe className="size-24" />
                    <span className="text-[10px] font-black uppercase tracking-[0.5em]">Radio Silence</span>
                  </motion.div>
                ) : (
                  <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center w-full gap-8">
                    <div className={`size-32 rounded-full ${statusInfo?.bg} flex items-center justify-center border ${statusInfo?.border} shadow-2xl`}>
                      {statusInfo && <statusInfo.icon className={`size-16 ${statusInfo.color}`} />}
                    </div>
                    <div className="text-center flex flex-col gap-2">
                      <h3 className={`text-3xl font-black tracking-tighter ${statusInfo?.color}`}>{statusInfo?.label}</h3>
                      <p className="text-xs font-mono text-muted uppercase max-w-xs mx-auto">{result.message}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full">
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center gap-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted/40">Latency</span>
                        <span className="text-xl font-mono text-amber-400">{result.latency}ms</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center gap-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted/40">Port</span>
                        <span className="text-xl font-mono text-blue-400">:{result.port}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>

            {/* Intelligence Panel */}
            <GlassCard className="xl:col-span-7 p-8">
              {!result || !intelligence ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-10 p-12 gap-6">
                  <Shield className="size-20" />
                  <span className="text-[11px] font-black uppercase tracking-[0.4em]">Service Intel Unavailable</span>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  <div className="flex items-center justify-between border-b border-white/5 pb-6">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{intelligence.name}</h3>
                        <span className="px-2 py-1 rounded-lg bg-accent/10 border border-accent/20 text-[9px] font-black text-accent">{intelligence.protocol}</span>
                      </div>
                      <p className="text-xs text-muted/60">{intelligence.description}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest shadow-lg shadow-black/20
                      ${intelligence.riskClassification.includes('CRITICAL') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                      {intelligence.riskClassification}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted/40">Common Usage</span>
                        <p className="text-[11px] text-foreground/80 leading-relaxed font-medium">{intelligence.commonUsage}</p>
                      </div>
                      {intelligence.warning && (
                        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex flex-col gap-2">
                           <span className="text-[9px] font-black uppercase tracking-widest text-red-400 flex items-center gap-2"><AlertTriangle className="size-3" /> Security Warning</span>
                           <p className="text-[11px] text-red-200/60 font-medium">{intelligence.warning}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2"><Shield className="size-4" /> Hardening</span>
                      <div className="flex flex-col gap-3">
                        {intelligence.hardening.map((h, i) => (
                          <div key={i} className="flex items-start gap-3 text-[11px] text-muted/80">
                            <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>
          </div>
        </section>

        {/* Cinematic Documentation Section */}
        <section className="mt-8 pt-12 border-t border-white/5 flex flex-col gap-12">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-foreground">Network Diagnostics Manual</h3>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Understanding Port Connectivity States</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard className="flex flex-col gap-5 p-6 bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/30 transition-colors">
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle2 className="size-5" />
                <h4 className="text-[11px] font-black uppercase tracking-wider">PORT OPEN</h4>
              </div>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                An application is actively accepting TCP connections, UDP datagrams, or SCTP associations on this port. 
                This indicates the service is running, bound to the specified interface, and reachable without firewall interference.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col gap-5 p-6 bg-red-500/[0.02] border-red-500/10 hover:border-red-500/30 transition-colors">
              <div className="flex items-center gap-3 text-red-400">
                <XCircle className="size-5" />
                <h4 className="text-[11px] font-black uppercase tracking-wider">PORT CLOSED</h4>
              </div>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                A closed port is accessible (it receives and responds to probe packets), but there is no application listening on it. 
                The host is reachable, but the intended service is either down or not configured to listen on this specific port.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col gap-5 p-6 bg-amber-500/[0.02] border-amber-500/10 hover:border-amber-500/30 transition-colors">
              <div className="flex items-center gap-3 text-amber-400">
                <Shield className="size-5" />
                <h4 className="text-[11px] font-black uppercase tracking-wider">FILTERED / TIMEOUT</h4>
              </div>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                The connection request was silently dropped by a firewall, filter, or network obstacle before reaching the target. 
                Because no response was received (not even an ICMP error), it is impossible to determine if the port is actually open or closed.
              </p>
            </GlassCard>
          </div>
        </section>
      </div>
    </ToolContainer>
  );
}
