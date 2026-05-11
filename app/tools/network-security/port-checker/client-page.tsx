"use client";

import { useState, useMemo } from "react";
import {
  ToolContainer,
  ToolHeader,
  ToolButton,
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
  ChevronDown,
  Settings2,
  Shield,
  Search,
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
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleScan = async () => {
    if (!host || !port) return;
    
    setIsScanning(true);
    setResult(null);

    try {
      const res = await fetch("/api/network/port-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, timeout: timeoutMs }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({
        host,
        port: parseInt(port, 10),
        status: "ERROR",
        latency: 0,
        message: "Failed to communicate with local API.",
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
        return { label: "CONNECTION REFUSED", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle, border: "border-red-500/20" };
      case "TIMEOUT":
        return { label: "FILTERED / TIMEOUT", color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock, border: "border-amber-500/20" };
      case "UNREACHABLE":
        return { label: "HOST UNREACHABLE", color: "text-red-400", bg: "bg-red-500/10", icon: AlertTriangle, border: "border-red-500/20" };
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
        description="Cinematic network utility to instantly query service availability, measure connection latency, and diagnose firewall configurations."
        categoryId="network-security"
      />

      <div className="flex flex-col gap-10">
        
        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Controls */}
          <GlassCard className="lg:col-span-7 flex flex-col gap-8 p-10">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-accent border-b border-white/5 pb-4">
              <Crosshair className="size-4" /> Targeting Parameters
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                  <Globe className="size-3" /> Target Host or IP
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. scanme.nmap.org or 8.8.8.8"
                    className="toolsy-input w-full bg-black/40 border-white/5 font-mono text-sm pl-10 h-14"
                    onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  />
                  <Server className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted/40" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                  <Activity className="size-3" /> Port
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="e.g. 443"
                  className="toolsy-input w-full bg-black/40 border-white/5 font-mono text-sm h-14"
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                />
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-col gap-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted/40">Quick Services</span>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.port}
                    onClick={() => handlePresetSelect(p.port)}
                    className={`px-3 py-1.5 rounded-lg border font-mono text-[10px] uppercase tracking-wider transition-all
                      ${port === p.port.toString() 
                        ? "bg-accent/20 border-accent/40 text-accent" 
                        : "bg-white/[0.02] border-white/5 text-muted hover:bg-white/[0.05] hover:border-white/10"}`}
                  >
                    {p.label} <span className="opacity-50 ml-1">:{p.port}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <div className="flex flex-col gap-4 border-t border-white/5 pt-6">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted/60 hover:text-foreground transition-colors w-max"
              >
                <Settings2 className="size-3" />
                Advanced Settings
                <ChevronDown className={`size-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              </button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted/40 flex items-center justify-between">
                          Timeout Duration
                          <span className="text-accent">{timeoutMs}ms</span>
                        </label>
                        <input 
                          type="range" 
                          min="500" 
                          max="10000" 
                          step="500" 
                          value={timeoutMs}
                          onChange={(e) => setTimeoutMs(Number(e.target.value))}
                          className="accent-accent"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4">
              <ToolButton 
                variant="primary" 
                size="lg" 
                className="w-full h-14"
                onClick={handleScan}
                disabled={isScanning || !host || !port}
              >
                {isScanning ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  >
                    <Search className="size-5 mr-2" />
                  </motion.div>
                ) : (
                  <Network className="size-5 mr-2" />
                )}
                {isScanning ? "Engaging Radar..." : "Initiate Connection"}
              </ToolButton>
            </div>
          </GlassCard>

          {/* Visualization & Results */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <GlassCard className="relative overflow-hidden flex flex-col items-center justify-center p-8 group min-h-[400px]">
              
              {/* Background Atmosphere */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] bg-[radial-gradient(circle,rgba(var(--accent-rgb),0.03)_0%,transparent_70%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_20%,transparent_100%)] opacity-20" />
              </div>

              <AnimatePresence mode="wait">
                {isScanning ? (
                  <motion.div 
                    key="scanning"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    className="relative z-10 flex flex-col items-center gap-6"
                  >
                    <div className="relative size-32 flex items-center justify-center">
                      <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: [1, 2, 2], opacity: [0.5, 0, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                        className="absolute inset-0 rounded-full border border-accent"
                      />
                      <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: [1, 2, 2], opacity: [0.5, 0, 0] }}
                        transition={{ duration: 2, delay: 0.6, repeat: Infinity, ease: "easeOut" }}
                        className="absolute inset-0 rounded-full border border-accent/50"
                      />
                      <div className="size-12 rounded-full bg-accent/20 flex items-center justify-center border border-accent/40 z-10 relative backdrop-blur-md">
                        <Network className="size-5 text-accent animate-pulse" />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.3em] text-accent">Interrogating</span>
                      <span className="font-mono text-xs text-muted">{host}:{port}</span>
                    </div>
                  </motion.div>
                ) : result && statusInfo ? (
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 flex flex-col items-center w-full gap-8"
                  >
                    <div className={`size-24 rounded-full ${statusInfo.bg} flex items-center justify-center border ${statusInfo.border} shadow-[0_0_40px_rgba(0,0,0,0.5)]`}>
                      <statusInfo.icon className={`size-10 ${statusInfo.color}`} />
                    </div>
                    
                    <div className="flex flex-col items-center gap-2 text-center">
                      <h3 className={`text-2xl font-black tracking-tighter ${statusInfo.color}`}>
                        {statusInfo.label}
                      </h3>
                      <p className="text-sm font-medium text-muted/80 max-w-[280px]">
                        {result.message}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full pt-6 border-t border-white/5">
                      <div className="flex flex-col gap-1 p-4 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted/60">Latency</span>
                        <span className="text-lg font-mono text-foreground flex items-center gap-2">
                          <Zap className="size-4 text-amber-400" />
                          {result.latency}ms
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 p-4 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted/60">Service</span>
                        <span className="text-lg font-mono text-foreground flex items-center gap-2">
                          <Activity className="size-4 text-blue-400" />
                          {PRESETS.find(p => p.port === result.port)?.label || "UNKNOWN"}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative z-10 flex flex-col items-center text-center gap-4 opacity-40 grayscale"
                  >
                    <Globe className="size-16 mb-4" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Awaiting Coordinates</h3>
                    <p className="text-[10px] font-bold tracking-wider max-w-[200px] leading-relaxed">
                      Enter a host and port to initiate deep packet inspection.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>

            {/* Service Intelligence Panel */}
            <AnimatePresence>
              {result && intelligence && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: 20 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  className="overflow-hidden"
                >
                  <GlassCard className="flex flex-col gap-6 p-8 border-l-4 border-l-accent">
                    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                            {intelligence.name}
                          </h3>
                          <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-white/5 text-muted/80">
                            {intelligence.protocol}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-muted/60 leading-relaxed">
                          {intelligence.description}
                        </span>
                      </div>
                      
                      <div className={`px-3 py-1.5 rounded-lg border text-[8px] font-black uppercase tracking-widest whitespace-nowrap
                        ${intelligence.riskClassification.includes('CRITICAL') || intelligence.riskClassification.includes('HIGH-RISK') 
                          ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                          : intelligence.riskClassification.includes('PUBLIC EXPOSURE')
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                        {intelligence.riskClassification}
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted/40">Common Usage</span>
                        <p className="text-[11px] text-muted/80 font-medium leading-relaxed">{intelligence.commonUsage}</p>
                      </div>

                      {intelligence.warning && (
                        <div className="flex flex-col gap-2 p-4 rounded-xl bg-red-500/[0.02] border border-red-500/10">
                          <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-red-400">
                            <AlertTriangle className="size-3" /> Security Warning
                          </span>
                          <p className="text-[11px] text-red-200/70 font-medium leading-relaxed">{intelligence.warning}</p>
                        </div>
                      )}

                      <div className="flex flex-col gap-3">
                        <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                          <Shield className="size-3" /> Hardening Guidance
                        </span>
                        <div className="flex flex-col gap-2">
                          {intelligence.hardening.map((tip, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-[10px] text-muted/80 font-medium">
                              <CheckCircle2 className="size-3 text-emerald-400 mt-0.5 shrink-0" />
                              <span className="leading-relaxed">{tip}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

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
