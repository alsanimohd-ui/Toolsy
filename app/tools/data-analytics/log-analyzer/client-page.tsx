"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ToolContainer,
  ToolHeader,
  ToolButton,
  ToolTextarea,
} from "@/components/tools";
import { 
  Search, 
  Terminal, 
  Copy, 
  Trash2, 
  Sparkles, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Bug,
  Filter,
  Activity,
  Upload,
  FileText,
  XCircle,
  FileCode,
  ShieldCheck,
  Fingerprint,
  Target,
  Network,
  Crosshair,
  ServerCrash
} from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

const sampleLogs = `[2026-05-03 20:10:15] INFO: Server initialized on port 3000
[192.168.1.45] [2026-05-03 20:10:18] DEBUG: Fetching DB connection pool...
[2026-05-03 20:10:20] INFO: DB Connection pool established
[2026-05-03 20:11:05] WARN: API latency spiked to 450ms on endpoint /api/users
[10.0.0.12] [2026-05-03 20:12:34] ERROR: Failed to parse user payload: SyntaxError: Unexpected token < in JSON at position 0
[2026-05-03 20:12:40] DEBUG: Retrying payload parsing...
[2026-05-03 20:13:02] INFO: Request completed in 24ms
[10.0.5.22] [2026-05-03 20:14:11] ERROR: Auth failed for admin@maker-ai.tech
[10.0.5.22] [2026-05-03 20:14:12] ERROR: Auth failed for admin@maker-ai.tech
[10.0.5.22] [2026-05-03 20:14:12] ERROR: Auth failed for admin@maker-ai.tech
[10.0.5.22] [2026-05-03 20:14:13] ERROR: Auth failed for admin@maker-ai.tech
[127.0.0.1] [2026-05-03 20:14:15] ERROR: Database disconnected unexpectedly
[2026-05-03 20:14:15] WARN: Fallback cache server engaged
[2026-05-03 20:15:00] INFO: System status check passed
[2026-05-03 20:15:10] CRITICAL: system crash detected - OutOfMemoryError
    at Server.handleRequest (/usr/src/app/server.js:45:12)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async Server.listen (/usr/src/app/server.js:10:3)
[2026-05-03 20:16:00] timeout occurred during upstream request
[2026-05-03 20:16:00] connection refused by 10.0.4.1:8080
[2026-05-03 20:16:05] retry attempt 1 of 3
[2026-05-03 20:16:05] retry attempt 2 of 3
[2026-05-03 20:17:00] INFO: healthy`;

type LogLevel = "ALL" | "INFO" | "WARN" | "ERROR" | "DEBUG" | "CRITICAL";

interface Ioc {
  type: "IP" | "URL" | "DOMAIN" | "EMAIL" | "HASH";
  value: string;
}

interface LogLine {
  id: number;
  text: string;
  level: LogLevel;
  timestamp: string | null;
  ip: string | null;
  isStackTrace: boolean;
  iocs: Ioc[];
  duplicateCount?: number;
  isDuplicate?: boolean;
}

interface IncidentCluster {
  id: string;
  title: string;
  type: "BRUTE_FORCE" | "CRASH" | "NETWORK" | "ANOMALY";
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  logs: LogLine[];
  primaryActor?: string;
}

const REGEX = {
  ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  time: /\[?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\]?/g,
  hash: /\b[a-fA-F0-9]{32}\b|\b[a-fA-F0-9]{40}\b|\b[a-fA-F0-9]{64}\b/g,
  url: /https?:\/\/[^\s"'<>\)]+/g,
  domain: /\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
};

export default function LogAnalyzerClient() {
  const [logs, setLogs] = useState<string>("");
  const [filterLevel, setFilterLevel] = useState<LogLevel>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [collapseDuplicates, setCollapseDuplicates] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  
  const [activeTab, setActiveTab] = useState<"FEED" | "INCIDENTS" | "IOCS">("FEED");

  const searchParams = useSearchParams();

  useEffect(() => {
    const prefill = searchParams.get("input");
    if (prefill) setLogs(prefill);
    else {
      try {
        const stored = localStorage.getItem("mi_log_analyzer_input");
        if (stored) setLogs(stored);
      } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    if (logs) {
      try {
        localStorage.setItem("mi_log_analyzer_input", logs);
      } catch {}
    }
  }, [logs]);

  /* ─────────────────────────────────────────────
     Tactical Parser Engine & IOC Extractor
    ───────────────────────────────────────────── */
  const parsedData = useMemo(() => {
    if (!logs.trim()) return [];
    
    const lines = logs.split("\n");
    const result: LogLine[] = [];
    let lastNonStackIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      if (!text.trim() && i > 0) continue;

      const upper = text.toUpperCase();
      const isStackTrace = text.trim().startsWith("at ") || text.trim().startsWith("...");
      
      let level: LogLevel = "INFO";
      if (upper.includes("CRITICAL") || upper.includes("FATAL") || upper.includes("PANIC")) {
        level = "CRITICAL";
      } else if (upper.includes("ERROR") || upper.includes("FAIL") || upper.includes("CRASH") || upper.includes("EXCEPTION") || upper.includes("TIMEOUT") || upper.includes("REFUSED") || upper.includes("DENIED")) {
        level = "ERROR";
      } else if (upper.includes("WARN") || upper.includes("WARNING") || upper.includes("LATENCY") || upper.includes("RETRY")) {
        level = "WARN";
      } else if (upper.includes("DEBUG") || upper.includes("TRACE")) {
        level = "DEBUG";
      } else if (isStackTrace) {
        level = lastNonStackIdx >= 0 ? result[lastNonStackIdx].level : "CRITICAL";
      }

      // Extract IOCs
      const iocs: Ioc[] = [];
      const ips = Array.from(text.matchAll(REGEX.ip)).map(m => m[0]);
      ips.forEach(ip => iocs.push({ type: "IP", value: ip }));
      
      const urls = Array.from(text.matchAll(REGEX.url)).map(m => m[0]);
      urls.forEach(url => iocs.push({ type: "URL", value: url }));
      
      const emails = Array.from(text.matchAll(REGEX.email)).map(m => m[0]);
      emails.forEach(email => iocs.push({ type: "EMAIL", value: email }));
      
      const hashes = Array.from(text.matchAll(REGEX.hash)).map(m => m[0]);
      hashes.forEach(hash => iocs.push({ type: "HASH", value: hash }));

      const timeMatch = text.match(REGEX.time);
      const timestamp = timeMatch ? timeMatch[0] : null;

      const logLine: LogLine = {
        id: i,
        text,
        level,
        timestamp,
        ip: ips.length > 0 ? ips[0] : null,
        isStackTrace,
        iocs
      };

      if (collapseDuplicates && i > 0 && text === lines[i - 1] && !isStackTrace) {
        if (result.length > 0) {
          const lastLog = result[result.length - 1];
          lastLog.isDuplicate = true;
          lastLog.duplicateCount = (lastLog.duplicateCount || 1) + 1;
          continue;
        }
      }

      if (!isStackTrace) lastNonStackIdx = result.length;
      result.push(logLine);
    }

    return result;
  }, [logs, collapseDuplicates]);

  /* ─────────────────────────────────────────────
     Correlation Engine (Incident Grouping)
    ───────────────────────────────────────────── */
  const incidents = useMemo(() => {
    const clusters: IncidentCluster[] = [];
    if (!parsedData.length) return clusters;

    // 1. Detect Crash / Stack Traces
    let currentCrash: IncidentCluster | null = null;
    for (const line of parsedData) {
      if (line.level === "CRITICAL" || line.isStackTrace || line.text.toLowerCase().includes("crash")) {
        if (!currentCrash) {
          currentCrash = {
            id: `crash-${line.id}`,
            title: "Application Crash / Panic Detected",
            type: "CRASH",
            severity: "CRITICAL",
            logs: [line]
          };
          clusters.push(currentCrash);
        } else {
          currentCrash.logs.push(line);
        }
      } else {
        currentCrash = null;
      }
    }

    // 2. Detect Brute Force / Repeated Auth Failures by IP
    const authFailsByIp: Record<string, LogLine[]> = {};
    parsedData.forEach(line => {
      const isAuthFail = line.text.toLowerCase().includes("auth failed") || line.text.toLowerCase().includes("login failed") || line.text.toLowerCase().includes("denied");
      if (isAuthFail && line.ip) {
        if (!authFailsByIp[line.ip]) authFailsByIp[line.ip] = [];
        authFailsByIp[line.ip].push(line);
      }
    });

    Object.entries(authFailsByIp).forEach(([ip, lines]) => {
      const totalFails = lines.reduce((acc, curr) => acc + (curr.duplicateCount || 1), 0);
      if (totalFails >= 3) {
        clusters.push({
          id: `brute-${ip}`,
          title: `Potential Brute Force Attack from ${ip}`,
          type: "BRUTE_FORCE",
          severity: "HIGH",
          logs: lines,
          primaryActor: ip
        });
      }
    });

    // 3. Network Outages / Timeouts
    const networkErrors = parsedData.filter(l => l.text.toLowerCase().includes("timeout") || l.text.toLowerCase().includes("refused") || l.text.toLowerCase().includes("disconnected"));
    if (networkErrors.length >= 2) {
      clusters.push({
        id: "network-outage",
        title: "Network Outage / Connection Drops",
        type: "NETWORK",
        severity: "MEDIUM",
        logs: networkErrors
      });
    }

    return clusters;
  }, [parsedData]);

  const uniqueIocs = useMemo(() => {
    const map = new Map<string, Ioc>();
    parsedData.forEach(line => {
      line.iocs.forEach(ioc => {
        if (!map.has(ioc.value)) map.set(ioc.value, ioc);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.type.localeCompare(b.type));
  }, [parsedData]);

  const filteredLines = useMemo(() => {
    return parsedData.filter((line) => {
      const matchesLevel = filterLevel === "ALL" || line.level === filterLevel;
      const matchesSearch = searchQuery.trim() === "" || line.text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesLevel && matchesSearch;
    });
  }, [parsedData, filterLevel, searchQuery]);

  const highlightLine = (line: string) => {
    const tokens = [
      { regex: REGEX.time, style: "text-emerald-400 font-bold" },
      { regex: REGEX.ip, style: "text-cyan-400 font-bold" },
      { regex: REGEX.url, style: "text-blue-400 underline decoration-blue-500/30" },
      { regex: REGEX.domain, style: "text-blue-300 font-semibold" },
      { regex: /(:\d{2,5}\b)/g, style: "text-amber-400/80" },
      { regex: REGEX.hash, style: "text-purple-400 font-mono" }
    ];

    let parts: (string | JSX.Element)[] = [line];
    tokens.forEach(({ regex, style }, tokenIdx) => {
      const nextParts: (string | JSX.Element)[] = [];
      parts.forEach((part, partIdx) => {
        if (typeof part !== "string") {
          nextParts.push(part);
          return;
        }
        let lastIndex = 0;
        let match;
        // reset lastIndex because we're reusing regex objects globally
        regex.lastIndex = 0;
        while ((match = regex.exec(part)) !== null) {
          if (match.index > lastIndex) nextParts.push(part.slice(lastIndex, match.index));
          nextParts.push(
            <span key={`${tokenIdx}-${partIdx}-${match.index}`} className={`${style} select-text`}>
              {match[0]}
            </span>
          );
          lastIndex = regex.lastIndex;
        }
        if (lastIndex < part.length) nextParts.push(part.slice(lastIndex));
      });
      parts = nextParts;
    });

    return parts;
  };

  const loadSample = () => {
    setLogs(sampleLogs);
    setFilterLevel("ALL");
  };

  const handleClear = () => {
    setLogs("");
    setFilterLevel("ALL");
    setSearchQuery("");
    try { localStorage.removeItem("mi_log_analyzer_input"); } catch {}
  };

  const handleCopy = () => {
    if (!filteredLines.length) return;
    const output = filteredLines.map((l) => l.text).join("\n");
    navigator.clipboard.writeText(output);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setLogs(content);
      setFileMeta({ name: file.name, size: file.size });
    };
    reader.readAsText(file);
  };

  return (
    <ToolContainer categoryId="data-analytics">
      <ToolHeader
        title="Log Analyzer & Correlation Workspace"
        description="SOC-grade log investigation platform. Ingest logs, extract IOCs, correlate anomalies, and build forensic timelines."
        categoryId="data-analytics"
      />

      <div className="flex flex-col gap-8">
        
        {/* INGESTION & UPLOAD */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 px-1">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
                <Terminal className="size-4 text-accent" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">Ingestion Stream</h2>
                <p className="text-[9px] font-bold text-muted/50 uppercase tracking-wider">Tactical log analysis & forensics</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 mr-2 px-3 py-1.5 rounded-md bg-white/[0.02] border border-white/5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted/70">SOC Correlation Engine</span>
              </div>
              
              <ToolButton variant="secondary" size="sm" onClick={loadSample}>
                <Sparkles className="size-3 mr-2" />
                Load Sample
              </ToolButton>
              <ToolButton 
                variant="secondary" 
                size="sm" 
                onClick={handleClear} 
                disabled={!logs}
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
                    <span className="text-[10px] font-black uppercase tracking-widest text-accent">Upload Logs</span>
                    <input type="file" className="hidden" accept=".log,.txt,.json,.csv" onChange={e => { const f = e.target.files?.[0]; if(f) processFile(f); }} />
                  </label>
                  
                  <div className="hidden md:flex items-center gap-4 text-muted/40">
                    <div className="flex items-center gap-1.5"><FileText className="size-3" /><span className="text-[9px] font-bold uppercase">.log</span></div>
                    <div className="flex items-center gap-1.5"><FileCode className="size-3" /><span className="text-[9px] font-bold uppercase">.txt</span></div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {fileMeta && (
                    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 animate-fadeIn">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">{fileMeta.name}</span>
                        <span className="text-[8px] font-bold text-emerald-400/40 uppercase">{(fileMeta.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <button onClick={() => { setFileMeta(null); setLogs(""); }} className="hover:text-red-400 transition-colors">
                        <XCircle className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <ToolTextarea
                  placeholder="Paste raw server logs, network captures, or incident dumps here. The SOC engine will automatically parse IOCs and build incident clusters..."
                  value={logs}
                  onChange={(e) => setLogs(e.target.value)}
                  className="min-h-[250px] font-mono text-[13px] leading-relaxed bg-transparent border-none focus:ring-0 px-6 py-6"
                />
              </div>
            </GlassCard>
          </div>
        </div>

        {logs && (
          <div className="flex flex-col gap-8 animate-fadeIn">
            {/* WORKSPACE TABS */}
            <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/5 rounded-xl self-start">
              {[
                { id: "FEED", label: "Tactical Feed", icon: Activity },
                { id: "INCIDENTS", label: `Incidents (${incidents.length})`, icon: ServerCrash },
                { id: "IOCS", label: `Extracted IOCs (${uniqueIocs.length})`, icon: Fingerprint },
              ].map(t => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as "FEED" | "INCIDENTS" | "IOCS")}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? "bg-accent text-accent-foreground shadow-[0_0_15px_rgba(var(--accent),0.3)]" : "text-muted hover:text-foreground hover:bg-white/5"}`}
                  >
                    <Icon className="size-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT: FEED */}
            {activeTab === "FEED" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* FILTER PANEL */}
                <GlassCard className="lg:col-span-12 flex flex-col gap-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
                      <Filter className="size-3.5" /> Filter Engine
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={collapseDuplicates} onChange={(e) => setCollapseDuplicates(e.target.checked)} className="size-3.5 rounded border-white/10 bg-black/40 accent-accent" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted group-hover:text-foreground transition-colors">Collapse Duplicates</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-3">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted/60">Severity Level</label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(["ALL", "CRITICAL", "ERROR", "WARN", "INFO", "DEBUG"] as LogLevel[]).map((level) => {
                          const isActive = filterLevel === level;
                          return (
                            <button
                              key={level}
                              onClick={() => setFilterLevel(level)}
                              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${isActive ? "bg-white/10 border-white/20 text-foreground" : "border-white/5 bg-white/[0.02] text-muted hover:bg-white/5"}`}
                            >
                              {level}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted/60">Pattern Matching</label>
                      <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted group-focus-within:text-accent transition-colors" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search IDs, IPs, hashes, or keywords..."
                          className="toolsy-input h-10 pl-10 pr-4 text-xs bg-black/40 border-white/5"
                        />
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* FEED OUTPUT */}
                <GlassCard className="lg:col-span-12 flex flex-col gap-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                      <Activity className="size-4 text-emerald-400" />
                      <h2 className="text-sm font-black uppercase tracking-[0.2em]">Live Investigation Feed</h2>
                      <span className="text-[9px] font-bold text-muted/40 uppercase tracking-widest ml-2">{filteredLines.length} Entries</span>
                    </div>
                    <ToolButton variant="secondary" size="sm" onClick={handleCopy}>
                      <Copy className="size-3 mr-2" /> Copy Feed
                    </ToolButton>
                  </div>

                  <div className="relative group overflow-hidden rounded-2xl border border-white/5 bg-[#0A0A0A]">
                    <div className="p-6 overflow-x-auto max-h-[700px] custom-scrollbar">
                      <div className="font-mono text-[12px] leading-relaxed flex flex-col gap-0.5">
                        {filteredLines.map((line, idx) => {
                          const isStack = line.isStackTrace;
                          let levelStyles = "text-foreground/70";
                          let Icon = Info;
                          if (line.level === "CRITICAL") { levelStyles = "text-purple-400 bg-purple-400/5"; Icon = ShieldCheck; }
                          else if (line.level === "ERROR") { levelStyles = "text-red-400 bg-red-400/5"; Icon = AlertCircle; }
                          else if (line.level === "WARN") { levelStyles = "text-amber-400 bg-amber-400/5"; Icon = AlertTriangle; }
                          else if (line.level === "DEBUG") { levelStyles = "text-blue-400 opacity-60"; Icon = Bug; }

                          return (
                            <div key={line.id} className={`group/line flex items-start gap-4 px-3 py-1 rounded transition-colors hover:bg-white/[0.03] ${isStack ? "ml-12 opacity-50 italic border-l border-white/10" : ""}`}>
                              <div className="flex items-center gap-3 min-w-[30px] select-none text-[9px] font-bold text-muted/30 group-hover/line:text-muted/60">
                                {idx + 1}
                              </div>
                              {!isStack && (
                                <div className={`p-1 rounded-md ${levelStyles.split(" ")[1]} opacity-50 group-hover/line:opacity-100 transition-opacity`}>
                                  <Icon className="size-3" />
                                </div>
                              )}
                              <div className={`flex-1 break-all whitespace-pre-wrap ${levelStyles.split(" ")[0]} transition-colors group-hover/line:text-foreground`}>
                                {highlightLine(line.text)}
                                {line.duplicateCount && line.duplicateCount > 1 && (
                                  <span className="ml-4 px-2 py-0.5 rounded border border-accent/20 bg-accent/10 text-accent text-[9px] font-black uppercase tracking-tighter">
                                    {line.duplicateCount}x Repeated
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </div>
            )}

            {/* TAB CONTENT: INCIDENTS */}
            {activeTab === "INCIDENTS" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3 mb-2">
                  <ServerCrash className="size-5 text-accent" />
                  <div className="flex flex-col">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em]">Correlated Incidents</h2>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Heuristic anomaly grouping and stack trace extraction</p>
                  </div>
                </div>

                {incidents.length === 0 ? (
                  <GlassCard className="py-20 flex flex-col items-center gap-4 text-center border-dashed border-white/10">
                    <ShieldCheck className="size-12 text-emerald-400/30" />
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400/80">No Incidents Detected</h3>
                      <p className="text-xs text-muted/50 font-medium">Log feed appears clean based on heuristic correlation rules.</p>
                    </div>
                  </GlassCard>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {incidents.map((incident) => (
                      <GlassCard key={incident.id} className={`flex flex-col gap-4 ${incident.severity === 'CRITICAL' ? 'border-purple-500/30 bg-purple-500/[0.02]' : incident.severity === 'HIGH' ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-amber-500/30 bg-amber-500/[0.02]'}`}>
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                          <div className="flex items-center gap-3">
                            {incident.type === "BRUTE_FORCE" ? <Target className="size-5 text-red-400" /> : incident.type === "CRASH" ? <ServerCrash className="size-5 text-purple-400" /> : <Network className="size-5 text-amber-400" />}
                            <h3 className="text-xs font-black uppercase tracking-widest text-foreground">{incident.title}</h3>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                            {incident.primaryActor && <span className="text-cyan-400 border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 rounded">Actor: {incident.primaryActor}</span>}
                            <span className="text-muted/60">{incident.logs.length} Events</span>
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-black/60 font-mono text-xs text-muted/80 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar border border-white/5">
                          {incident.logs.map((l, i) => <div key={i}>{l.text}</div>)}
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: IOCS */}
            {activeTab === "IOCS" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3 mb-2">
                  <Fingerprint className="size-5 text-accent" />
                  <div className="flex flex-col">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em]">Extracted Intelligence</h2>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Auto-detected indicators of compromise (IOCs)</p>
                  </div>
                </div>

                {uniqueIocs.length === 0 ? (
                  <GlassCard className="py-20 flex flex-col items-center gap-4 text-center border-dashed border-white/10">
                    <Crosshair className="size-12 text-muted/20" />
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-black uppercase tracking-widest text-muted/80">No IOCs Extracted</h3>
                      <p className="text-xs text-muted/50 font-medium">No IPs, domains, or hashes found in the current log set.</p>
                    </div>
                  </GlassCard>
                ) : (
                  <GlassCard className="flex flex-col gap-0 p-0 overflow-hidden">
                    <div className="grid grid-cols-[120px_1fr] p-4 bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-muted/60">
                      <div>Type</div>
                      <div>Indicator Value</div>
                    </div>
                    <div className="flex flex-col max-h-[600px] overflow-y-auto custom-scrollbar">
                      {uniqueIocs.map((ioc, idx) => {
                        let color = "text-foreground";
                        if (ioc.type === "IP") color = "text-cyan-400";
                        if (ioc.type === "HASH") color = "text-purple-400";
                        if (ioc.type === "URL" || ioc.type === "DOMAIN") color = "text-blue-400";
                        
                        return (
                          <div key={idx} className="grid grid-cols-[120px_1fr] p-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors items-center">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted bg-black/40 px-2 py-1 rounded w-fit border border-white/5">{ioc.type}</div>
                            <div className={`font-mono text-xs font-medium ${color} break-all`}>{ioc.value}</div>
                          </div>
                        );
                      })}
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
