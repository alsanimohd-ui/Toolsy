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
  BarChart3,
  Layers,
  Database,
  Globe,
  Zap,
  Activity,
  ShieldCheck
} from "lucide-react";
import { motion } from "framer-motion";
import GlassCard from "@/components/ui/GlassCard";

const sampleLogs = `[2026-05-03 20:10:15] INFO: Server initialized on port 3000
[192.168.1.45] [2026-05-03 20:10:18] DEBUG: Fetching DB connection pool...
[2026-05-03 20:10:20] INFO: DB Connection pool established
[2026-05-03 20:11:05] WARN: API latency spiked to 450ms on endpoint /api/users
[10.0.0.12] [2026-05-03 20:12:34] ERROR: Failed to parse user payload: SyntaxError: Unexpected token < in JSON at position 0
[2026-05-03 20:12:40] DEBUG: Retrying payload parsing...
[2026-05-03 20:13:02] INFO: Request completed in 24ms
[127.0.0.1] [2026-05-03 20:14:11] ERROR: Database disconnected unexpectedly
[2026-05-03 20:14:15] WARN: Fallback cache server engaged
[2026-05-03 20:15:00] INFO: System status check passed
[2026-05-03 20:15:10] CRITICAL: system crash detected
    at Server.handleRequest (/usr/src/app/server.js:45:12)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async Server.listen (/usr/src/app/server.js:10:3)
[2026-05-03 20:16:00] timeout occurred during upstream request
[2026-05-03 20:16:00] connection refused by 10.0.4.1:8080
[2026-05-03 20:16:05] retry attempt 1 of 3
[2026-05-03 20:16:05] retry attempt 1 of 3
[2026-05-03 20:16:05] retry attempt 1 of 3
[2026-05-03 20:17:00] INFO: healthy`;

type LogLevel = "ALL" | "INFO" | "WARN" | "ERROR" | "DEBUG";

interface LogLine {
  text: string;
  level: LogLevel;
  id: number;
  isStackTrace: boolean;
  timestamp?: string;
  isDuplicate?: boolean;
  duplicateCount?: number;
}

export default function LogAnalyzerClient() {
  const [logs, setLogs] = useState<string>("");
  const [filterLevel, setFilterLevel] = useState<LogLevel>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [collapseDuplicates, setCollapseDuplicates] = useState(true);
  const searchParams = useSearchParams();

  // Load initial data
  useEffect(() => {
    const prefill = searchParams.get("input");
    if (prefill) {
      setLogs(prefill);
    } else {
      try {
        const stored = localStorage.getItem("toolsy_log_analyzer_input");
        if (stored) setLogs(stored);
      } catch {}
    }
  }, [searchParams]);

  // Persist logs
  useEffect(() => {
    if (logs) {
      try {
        localStorage.setItem("toolsy_log_analyzer_input", logs);
      } catch {}
    }
  }, [logs]);

  /* ─────────────────────────────────────────────
     Tactical Parser Engine
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
      
      // Heuristic Level Detection
      let level: LogLevel = "INFO";
      if (upper.includes("ERROR") || upper.includes("FATAL") || upper.includes("FAIL") || upper.includes("CRITICAL") || upper.includes("EXCEPTION") || upper.includes("CRASH") || upper.includes("TIMEOUT") || upper.includes("REFUSED") || upper.includes("DENIED") || upper.includes("UNREACHABLE")) {
        level = "ERROR";
      } else if (upper.includes("WARN") || upper.includes("WARNING") || upper.includes("LATENCY") || upper.includes("RETRY") || upper.includes("SLOW") || upper.includes("DEPRECATED")) {
        level = "WARN";
      } else if (upper.includes("DEBUG") || upper.includes("TRACE")) {
        level = "DEBUG";
      } else if (upper.includes("INFO")) {
        level = "INFO";
      } else if (isStackTrace) {
        // Inherit level from parent log line if stack trace
        level = lastNonStackIdx >= 0 ? result[lastNonStackIdx].level : "ERROR";
      }

      const logLine: LogLine = {
        text,
        level,
        id: i,
        isStackTrace,
      };

      // Duplicate detection logic
      if (collapseDuplicates && i > 0 && text === lines[i - 1] && !isStackTrace) {
        if (result.length > 0) {
          const lastLog = result[result.length - 1];
          lastLog.isDuplicate = true;
          lastLog.duplicateCount = (lastLog.duplicateCount || 1) + 1;
          continue; // Skip adding this line
        }
      }

      if (!isStackTrace) lastNonStackIdx = result.length;
      result.push(logLine);
    }

    return result;
  }, [logs, collapseDuplicates]);

  // Filtered results
  const filteredLines = useMemo(() => {
    return parsedData.filter((line) => {
      const matchesLevel = filterLevel === "ALL" || line.level === filterLevel;
      const matchesSearch =
        searchQuery.trim() === "" ||
        line.text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesLevel && matchesSearch;
    });
  }, [parsedData, filterLevel, searchQuery]);

  // Normalization Statistics
  const stats = useMemo(() => {
    const s = { all: 0, info: 0, warn: 0, error: 0, debug: 0, groups: {} as Record<string, number> };
    if (!logs.trim()) return s;

    parsedData.forEach(line => {
      const count = line.duplicateCount || 1;
      s.all += count;
      if (line.level === "INFO") s.info += count;
      else if (line.level === "WARN") s.warn += count;
      else if (line.level === "ERROR") s.error += count;
      else if (line.level === "DEBUG") s.debug += count;

      if (line.level === "ERROR") {
        const text = line.text.toLowerCase();
        let group = "General Ops";
        if (text.includes("sql") || text.includes("db") || text.includes("database") || text.includes("query")) group = "Database";
        else if (text.includes("parse") || text.includes("json") || text.includes("syntax")) group = "Parsing";
        else if (text.includes("network") || text.includes("connection") || text.includes("refused") || text.includes("timeout")) group = "Network";
        else if (text.includes("auth") || text.includes("denied") || text.includes("permission") || text.includes("token")) group = "Auth";
        
        s.groups[group] = (s.groups[group] || 0) + count;
      }
    });
    return s;
  }, [logs, parsedData]);

  /* ─────────────────────────────────────────────
     High-Fidelity Highlighter
    ───────────────────────────────────────────── */
  const highlightLine = (line: string) => {
    const tokens = [
      { regex: /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/g, style: "text-emerald-400 font-bold" }, // Time
      { regex: /(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/g, style: "text-cyan-400 font-bold" }, // IP
      { regex: /(https?:\/\/[^\s]+)/g, style: "text-blue-400 underline decoration-blue-500/30" }, // URL
      { regex: /(\b[a-z0-9-]+\.[a-z]{2,}\b)/gi, style: "text-blue-300 font-semibold" }, // Domain
      { regex: /(:\d{2,5}\b)/g, style: "text-amber-400/80" }, // Port
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
        while ((match = regex.exec(part)) !== null) {
          if (match.index > lastIndex) {
            nextParts.push(part.slice(lastIndex, match.index));
          }
          nextParts.push(
            <span key={`${tokenIdx}-${partIdx}-${match.index}`} className={`${style} select-text`}>
              {match[0]}
            </span>
          );
          lastIndex = regex.lastIndex;
        }
        if (lastIndex < part.length) {
          nextParts.push(part.slice(lastIndex));
        }
      });
      parts = nextParts;
    });

    return parts;
  };

  const loadSample = () => {
    setLogs(sampleLogs);
    setFilterLevel("ALL");
    setStatus("Tactical sample loaded.");
    setTimeout(() => setStatus(""), 2000);
  };

  const handleClear = () => {
    setLogs("");
    setFilterLevel("ALL");
    setSearchQuery("");
    setStatus("Terminal cleared.");
    setTimeout(() => setStatus(""), 2000);
    try {
      localStorage.removeItem("toolsy_log_analyzer_input");
    } catch {}
  };

  const handleCopy = () => {
    if (!filteredLines.length) return;
    const output = filteredLines.map((l) => l.text).join("\n");
    navigator.clipboard.writeText(output);
    setStatus("Results cached to clipboard.");
    setTimeout(() => setStatus(""), 2500);
  };

  return (
    <ToolContainer categoryId="data-analytics">
      <ToolHeader
        title="Log Analyzer"
        description="Forensic-grade log analysis with heuristic severity detection and intelligent error grouping."
        categoryId="data-analytics"
      />

      <div className="flex flex-col gap-8">
        
        {/* Input Interface */}
        <GlassCard className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal className="size-5 text-accent" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em]">Input Stream</h2>
            </div>
            <div className="flex items-center gap-2">
              <ToolButton variant="secondary" size="sm" onClick={loadSample}>
                <Sparkles className="size-3 mr-2" />
                Sample Trace
              </ToolButton>
              <ToolButton variant="secondary" size="sm" onClick={handleClear} disabled={!logs}>
                <Trash2 className="size-3 mr-2" />
                Flush
              </ToolButton>
            </div>
          </div>

          <ToolTextarea
            placeholder="Paste raw server logs, cloud traces, or stack dumps here..."
            value={logs}
            onChange={(e) => setLogs(e.target.value)}
            className="min-h-[220px] font-mono text-[13px] leading-relaxed bg-black/20 border-white/5 focus:border-accent/30"
          />

          {status && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-black uppercase tracking-widest text-accent bg-accent/5 self-center px-4 py-2 rounded-full border border-accent/10"
            >
              {status}
            </motion.div>
          )}
        </GlassCard>

        {logs && (
          <div className="flex flex-col gap-8 animate-fadeIn">
            
            {/* Investigation Controls & Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Filter Module */}
              <GlassCard className="lg:col-span-8 flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
                    <Filter className="size-3.5" />
                    Investigation Filters
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={collapseDuplicates} 
                        onChange={(e) => setCollapseDuplicates(e.target.checked)}
                        className="size-3.5 rounded border-white/10 bg-white/5 text-accent focus:ring-accent/30"
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted group-hover:text-foreground transition-colors">Collapse Duplicates</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-col gap-3">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted/60">Severity Level</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(["ALL", "INFO", "WARN", "ERROR", "DEBUG"] as LogLevel[]).map((level) => {
                        const isActive = filterLevel === level;
                        const colors = {
                          ALL: "hover:bg-white/10",
                          INFO: "hover:bg-blue-500/10 text-blue-400",
                          WARN: "hover:bg-amber-500/10 text-amber-400",
                          ERROR: "hover:bg-red-500/10 text-red-400",
                          DEBUG: "hover:bg-purple-500/10 text-purple-400"
                        };
                        return (
                          <button
                            key={level}
                            onClick={() => setFilterLevel(level)}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${
                              isActive 
                                ? "bg-accent border-accent text-black shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]" 
                                : `border-white/5 bg-white/[0.02] ${colors[level]}`
                            }`}
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
                        placeholder="Search IDs, IPs, or keywords..."
                        className="toolsy-input h-10 pl-10 pr-4 text-xs bg-white/[0.02] border-white/5 focus:bg-white/[0.04]"
                      />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Stats Module */}
              <GlassCard className="lg:col-span-4 flex flex-col gap-6 bg-accent/5 border-accent/10">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent/80">
                  <BarChart3 className="size-3.5" />
                  Forensic Metrics
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted/60">Total Lines</span>
                    <span className="text-xl font-black text-foreground">{stats.all}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                    <span className="text-[8px] font-black uppercase tracking-widest text-red-400/60">Errors</span>
                    <span className="text-xl font-black text-red-400">{stats.error}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <span className="text-[8px] font-black uppercase tracking-widest text-amber-400/60">Warnings</span>
                    <span className="text-xl font-black text-amber-400">{stats.warn}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                    <span className="text-[8px] font-black uppercase tracking-widest text-blue-400/60">Activity</span>
                    <span className="text-xl font-black text-blue-400">{stats.info}</span>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Error Normalization Engine View */}
            {Object.keys(stats.groups).length > 0 && (
              <GlassCard className="flex flex-col gap-6">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
                  <Layers className="size-3.5" />
                  Intelligent Error Classification
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(stats.groups).map(([group, count]) => {
                    const icons = {
                      Database: Database,
                      Parsing: Bug,
                      Network: Globe,
                      Auth: ShieldCheck,
                      "General Ops": Zap
                    };
                    const Icon = icons[group as keyof typeof icons] || Zap;
                    return (
                      <div key={group} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
                        <div className="p-2 rounded-lg bg-white/5">
                          <Icon className="size-4 text-accent/60" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-foreground uppercase tracking-wider">{group}</span>
                          <span className="text-[9px] font-bold text-muted uppercase">{count} occurrences</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            )}

            {/* Forensic Output */}
            <GlassCard className="flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <Activity className="size-4 text-emerald-400" />
                  <h2 className="text-sm font-black uppercase tracking-[0.2em]">Tactical Feed</h2>
                  <span className="text-[9px] font-bold text-muted/40 uppercase tracking-widest ml-2">Displaying {filteredLines.length} filtered entries</span>
                </div>
                <ToolButton variant="secondary" size="sm" onClick={handleCopy}>
                  <Copy className="size-3 mr-2" />
                  Export Trace
                </ToolButton>
              </div>

              <div className="relative group overflow-hidden rounded-2xl border border-white/5 bg-black/40">
                {/* Visual scanner line animation */}
                <motion.div 
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-px bg-accent/20 z-10 pointer-events-none"
                />

                <div className="p-6 overflow-x-auto max-h-[600px] custom-scrollbar">
                  {filteredLines.length > 0 ? (
                    <div className="font-mono text-[12px] leading-relaxed flex flex-col gap-0.5">
                      {filteredLines.map((line, idx) => {
                        const isStack = line.isStackTrace;
                        
                        let levelStyles = "text-foreground/70";
                        let Icon = Info;
                        if (line.level === "ERROR") { levelStyles = "text-red-400 bg-red-400/5"; Icon = AlertCircle; }
                        else if (line.level === "WARN") { levelStyles = "text-amber-400 bg-amber-400/5"; Icon = AlertTriangle; }
                        else if (line.level === "DEBUG") { levelStyles = "text-purple-400 bg-purple-400/5"; Icon = Bug; }
                        else if (line.level === "INFO") { levelStyles = "text-blue-400 bg-blue-400/5"; Icon = Info; }

                        return (
                          <div 
                            key={line.id} 
                            className={`group/line flex items-start gap-4 px-3 py-1 rounded transition-colors hover:bg-white/[0.03] ${isStack ? "ml-12 opacity-60 italic" : ""}`}
                          >
                            <div className="flex items-center gap-3 min-w-[40px] select-none text-[10px] font-bold text-muted/30 group-hover/line:text-muted/60 transition-colors">
                              {idx + 1}
                            </div>
                            
                            {!isStack && (
                              <div className={`p-1 rounded-md ${levelStyles.split(" ")[1]} opacity-40 group-hover/line:opacity-100 transition-opacity`}>
                                <Icon className="size-3" />
                              </div>
                            )}

                            <div className={`flex-1 break-all whitespace-pre-wrap ${levelStyles.split(" ")[0]} transition-colors group-hover/line:text-foreground`}>
                              {highlightLine(line.text)}
                              
                              {line.duplicateCount && line.duplicateCount > 1 && (
                                <span className="ml-4 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-black uppercase tracking-tighter">
                                  {line.duplicateCount}x Repeated
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-20 flex flex-col items-center gap-4 text-center">
                      <div className="size-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                        <Search className="size-6 text-muted/30" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-black uppercase tracking-widest text-muted">No signal detected</h3>
                        <p className="text-xs text-muted/50 font-bold uppercase tracking-tighter">Adjust filters to reveal hidden data</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>

          </div>
        )}

        {/* Tactical Documentation */}
        <section className="mt-8 pt-12 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-12 select-text">
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-foreground">Forensic Engine</h3>
            <p className="text-xs text-muted/60 leading-relaxed font-medium">
              The analyzer uses heuristic pattern matching to detect severity even in unlabeled streams. It automatically identifies IPs, URLs, domains, and ports for rapid investigation.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-foreground">Intelligence Layers</h3>
            <ul className="flex flex-col gap-2.5">
              <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted/80">
                <div className="size-1 rounded-full bg-accent" />
                Auto-Normalization
              </li>
              <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted/80">
                <div className="size-1 rounded-full bg-accent" />
                Duplicate Collapsing
              </li>
              <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted/80">
                <div className="size-1 rounded-full bg-accent" />
                Trace Classification
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-foreground">Privacy Protocol</h3>
            <p className="text-xs text-muted/60 leading-relaxed font-medium">
              Processing occurs strictly in your browser&apos;s local sandbox. No log data is transmitted to external servers. Systems are offline-first by design.
            </p>
          </div>
        </section>
      </div>
    </ToolContainer>
  );
}
