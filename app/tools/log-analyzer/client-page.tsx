"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  ToolContainer,
  ToolHeader,
  ToolSection,
  ToolButton,
  ToolTextarea,
} from "@/components/tools";

const sampleLogs = `[2026-05-03 20:10:15] INFO: Server initialized on port 3000
[192.168.1.45] [2026-05-03 20:10:18] DEBUG: Fetching DB connection pool...
[2026-05-03 20:10:20] INFO: DB Connection pool established
[2026-05-03 20:11:05] WARN: API latency spiked to 450ms on endpoint /api/users
[10.0.0.12] [2026-05-03 20:12:34] ERROR: Failed to parse user payload: SyntaxError: Unexpected token < in JSON at position 0
[2026-05-03 20:12:40] DEBUG: Retrying payload parsing...
[2026-05-03 20:13:02] INFO: Request completed in 24ms
[127.0.0.1] [2026-05-03 20:14:11] ERROR: Database disconnected unexpectedly
[2026-05-03 20:14:15] WARN: Fallback cache server engaged
[2026-05-03 20:15:00] INFO: System status check passed`;

type LogLevel = "ALL" | "INFO" | "WARN" | "ERROR" | "DEBUG";

interface LogLine {
  text: string;
  level: LogLevel;
}

export default function LogAnalyzerClient() {
  const [logs, setLogs] = useState<string>("");
  const [filterLevel, setFilterLevel] = useState<LogLevel>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const searchParams = useSearchParams();

  useEffect(() => {
    const prefill = searchParams.get("input");
    if (prefill) {
      setLogs(prefill);
    } else {
      try {
        const stored = localStorage.getItem("toolsy_log_analyzer_input");
        if (stored) {
          setLogs(stored);
        }
      } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    if (logs) {
      try {
        localStorage.setItem("toolsy_log_analyzer_input", logs);
      } catch {}
    }
  }, [logs]);

  // Highlight timestamps and IPs using regex replacements or split scanning
  const highlightLine = (line: string) => {
    const timeRegex = /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/g;
    const ipRegex = /(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/g;

    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    // We can do a unified token scanner or just text slicing.
    // For performance and safety, let's scan all matches for timestamps/IPs
    const tokens: { start: number; end: number; type: string; val: string }[] = [];

    let match;
    while ((match = timeRegex.exec(line)) !== null) {
      tokens.push({ start: match.index, end: match.index + match[0].length, type: "time", val: match[0] });
    }
    while ((match = ipRegex.exec(line)) !== null) {
      tokens.push({ start: match.index, end: match.index + match[0].length, type: "ip", val: match[0] });
    }

    tokens.sort((a, b) => a.start - b.start);

    // Merge overlapping/adjacent tokens
    const filteredTokens: typeof tokens = [];
    tokens.forEach((token) => {
      if (!filteredTokens.length || token.start >= filteredTokens[filteredTokens.length - 1].end) {
        filteredTokens.push(token);
      }
    });

    filteredTokens.forEach((token) => {
      if (token.start > lastIndex) {
        parts.push(line.slice(lastIndex, token.start));
      }
      if (token.type === "time") {
        parts.push(
          <span key={token.start} className="text-emerald-300 font-semibold select-text">
            {token.val}
          </span>
        );
      } else {
        parts.push(
          <span key={token.start} className="text-cyan-300 font-semibold select-text">
            {token.val}
          </span>
        );
      }
      lastIndex = token.end;
    });

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return parts;
  };

  // Group errors by specific type
  const getGroupedErrors = () => {
    const errors: Record<string, number> = {};
    if (!logs.trim()) return errors;

    logs.split("\n").forEach((line) => {
      const uppercase = line.toUpperCase();
      if (uppercase.includes("ERROR") || uppercase.includes("FATAL") || uppercase.includes("FAIL")) {
        // Extract a type from the line or extract error name
        const match = line.match(/(SyntaxError|TypeError|ReferenceError|Database|API|Timeout|Network|Connection|Failed to [a-z0-9_]+)/i);
        const errType = match ? match[0] : "General Runtime Error";
        errors[errType] = (errors[errType] || 0) + 1;
      }
    });
    return errors;
  };

  const parseLogs = (raw: string): LogLine[] => {
    if (!raw.trim()) return [];
    if (raw.length > 2000000) {
      return [{ text: "Input too large (Max 2MB). Please truncate to continue.", level: "ERROR" }];
    }
    const lines = raw.split("\n");
    const displayLines = lines.length > 5000 ? lines.slice(0, 5000) : lines;
    
    return displayLines
      .map((line) => {
        let level: LogLevel = "ALL";
        const uppercaseLine = line.toUpperCase();

        if (uppercaseLine.includes("ERROR") || uppercaseLine.includes("FATAL") || uppercaseLine.includes("FAIL")) {
          level = "ERROR";
        } else if (uppercaseLine.includes("WARN") || uppercaseLine.includes("WARNING")) {
          level = "WARN";
        } else if (uppercaseLine.includes("DEBUG")) {
          level = "DEBUG";
        } else if (uppercaseLine.includes("INFO")) {
          level = "INFO";
        }

        return { text: line, level };
      })
      .filter((line) => {
        const matchesLevel = filterLevel === "ALL" || line.level === filterLevel;
        const matchesSearch =
          searchQuery.trim() === "" ||
          line.text.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesLevel && matchesSearch;
      });
  };

  const parsedLines = parseLogs(logs);

  const getLogSummary = () => {
    const summary = {
      all: 0,
      info: 0,
      warn: 0,
      error: 0,
      debug: 0,
    };

    if (!logs.trim()) return summary;

    logs.split("\n").forEach((line) => {
      summary.all++;
      const uppercaseLine = line.toUpperCase();
      if (uppercaseLine.includes("ERROR") || uppercaseLine.includes("FATAL") || uppercaseLine.includes("FAIL")) {
        summary.error++;
      } else if (uppercaseLine.includes("WARN") || uppercaseLine.includes("WARNING")) {
        summary.warn++;
      } else if (uppercaseLine.includes("DEBUG")) {
        summary.debug++;
      } else if (uppercaseLine.includes("INFO")) {
        summary.info++;
      }
    });

    return summary;
  };

  const summary = getLogSummary();
  const groupedErrors = getGroupedErrors();

  const loadSample = () => {
    setLogs(sampleLogs);
    setFilterLevel("ALL");
    setSearchQuery("");
    setStatus("Sample loaded.");
    setTimeout(() => setStatus(""), 2000);
  };

  const handleClear = () => {
    setLogs("");
    setFilterLevel("ALL");
    setSearchQuery("");
    setStatus("Cleared.");
    setTimeout(() => setStatus(""), 2000);
    try {
      localStorage.removeItem("toolsy_log_analyzer_input");
    } catch {}
  };

  const handleCopy = () => {
    if (!parsedLines.length) return;
    try {
      const output = parsedLines.map((l) => l.text).join("\n");
      navigator.clipboard.writeText(output);
      setStatus("Copied filtered results!");
      setTimeout(() => setStatus(""), 2500);
    } catch {
      setStatus("Failed to copy filtered results.");
      setTimeout(() => setStatus(""), 2000);
    }
  };

  return (
    <ToolContainer>
      <ToolHeader
        title="Log Analyzer"
        description="Filter, search, and analyze raw log files to pinpoint errors and warnings quickly."
        badge="Logs"
      />

      <div className="flex flex-col gap-6 animate-fadeIn">
        <ToolSection
          title="Input Logs"
          description="Paste raw logs or load sample logs to begin analyzing."
        >
          <div className="flex flex-col gap-4">
            <ToolTextarea
              label="Raw Log Contents"
              placeholder="Paste logs here or click Load Sample Logs..."
              showCount
              value={logs}
              onChange={(e) => setLogs(e.target.value)}
              className="min-h-[160px] font-mono"
            />

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <ToolButton variant="primary" onClick={loadSample}>
                  Load Sample Logs
                </ToolButton>
                <ToolButton
                  variant="secondary"
                  onClick={handleClear}
                  disabled={!logs}
                >
                  Clear All
                </ToolButton>
              </div>

              {status && (
                <span className="text-xs font-semibold text-[var(--accent-hover)] bg-[var(--accent-glow)]/10 px-3 py-1.5 rounded-lg animate-pulse">
                  {status}
                </span>
              )}
            </div>
          </div>
        </ToolSection>

        {logs ? (
          <>
            <ToolSection title="Filter & Analysis Controls" className="animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-[var(--muted)] tracking-wide uppercase">
                    Filter by Log Level
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(["ALL", "INFO", "WARN", "ERROR", "DEBUG"] as LogLevel[]).map((level) => {
                      const isActive = filterLevel === level;
                      return (
                        <ToolButton
                          key={level}
                          variant={isActive ? "primary" : "secondary"}
                          size="sm"
                          onClick={() => setFilterLevel(level)}
                        >
                          {level}
                        </ToolButton>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-[var(--muted)] tracking-wide uppercase">
                    Search / Match Keyword
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. timeout, database..."
                    className="w-full px-4 py-2 border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--foreground)] rounded-xl text-sm focus:border-[var(--accent)] focus:ring-[var(--accent-glow)] outline-none transition-all duration-150"
                  />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 border-t border-[var(--border)] pt-4 select-none animate-fadeIn">
                <div className="flex flex-col bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-3 rounded-xl text-center">
                  <span className="text-xs text-[var(--muted)] font-medium uppercase">All</span>
                  <span className="text-lg font-bold text-[var(--foreground)]">{summary.all}</span>
                </div>
                <div className="flex flex-col bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-3 rounded-xl text-center">
                  <span className="text-xs text-blue-400 font-medium uppercase">Info</span>
                  <span className="text-lg font-bold text-blue-300">{summary.info}</span>
                </div>
                <div className="flex flex-col bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-3 rounded-xl text-center">
                  <span className="text-xs text-yellow-400 font-medium uppercase">Warn</span>
                  <span className="text-lg font-bold text-yellow-300">{summary.warn}</span>
                </div>
                <div className="flex flex-col bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-3 rounded-xl text-center">
                  <span className="text-xs text-red-400 font-medium uppercase">Error</span>
                  <span className="text-lg font-bold text-red-300">{summary.error}</span>
                </div>
                <div className="flex flex-col bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-3 rounded-xl text-center">
                  <span className="text-xs text-purple-400 font-medium uppercase">Debug</span>
                  <span className="text-lg font-bold text-purple-300">{summary.debug}</span>
                </div>
              </div>
            </ToolSection>

            {/* Advanced Grouped Errors Section */}
            {Object.keys(groupedErrors).length > 0 && (
              <ToolSection title="Errors Grouped by Type" className="animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(groupedErrors).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-3.5 bg-red-950/20 border border-red-900/40 rounded-xl text-sm">
                      <span className="text-red-300 font-medium truncate max-w-[70%]" title={type}>{type}</span>
                      <span className="px-2.5 py-0.5 text-xs font-bold text-red-200 bg-red-900/60 rounded-full">{count} calls</span>
                    </div>
                  ))}
                </div>
              </ToolSection>
            )}

            <ToolSection
              title="Results & Output"
              description={`Showing ${parsedLines.length} matched log entries`}
              className="animate-fadeIn"
            >
              {parsedLines.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="w-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-xl p-4 overflow-x-auto min-h-[220px]">
                    <pre className="font-mono text-xs leading-relaxed flex flex-col gap-1.5 select-text">
                      {parsedLines.map((line, idx) => {
                        let colorClass = "text-[var(--foreground)]";
                        if (line.level === "ERROR") colorClass = "text-red-400 bg-red-950/20 px-1.5 py-0.5 rounded";
                        if (line.level === "WARN") colorClass = "text-yellow-300 bg-yellow-950/20 px-1.5 py-0.5 rounded";
                        if (line.level === "DEBUG") colorClass = "text-purple-300 bg-purple-950/20 px-1.5 py-0.5 rounded";
                        if (line.level === "INFO") colorClass = "text-blue-300 bg-blue-950/20 px-1.5 py-0.5 rounded";

                        return (
                          <div key={idx} className={`${colorClass} whitespace-pre-wrap break-all flex gap-3`}>
                            <span className="text-[var(--muted)] select-none">[{idx + 1}]</span>
                            <span className="flex-1">{highlightLine(line.text)}</span>
                          </div>
                        );
                      })}
                    </pre>
                  </div>
                  <div className="flex self-end">
                    <ToolButton variant="secondary" onClick={handleCopy}>
                      Copy Result
                    </ToolButton>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-xl text-center">
                  <span className="text-sm text-[var(--muted)]">
                    No logs match the current filters.
                  </span>
                </div>
              )}
            </ToolSection>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-[var(--border-subtle)] rounded-xl text-center text-[var(--muted)] animate-fadeIn">
            <span className="text-3xl mb-1 select-none">⌨️</span>
            <p className="text-sm">Ready for input. Paste your server logs or load the Sample trace.</p>
            <p className="text-xs mt-1 text-[var(--muted)]/70">Press filters above to slice data in real time.</p>
          </div>
        )}

        {/* Structured SEO educational content section */}
        <section className="mt-8 border-t border-[var(--border)] pt-8 flex flex-col gap-6 select-text">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold text-[var(--foreground)]">What is a Log Analyzer?</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              A log analyzer digests raw text files, system traces, or console outputs to extract and segment log severity levels
              such as INFO, WARN, ERROR, and DEBUG. This accelerates error isolation and helps monitor system health.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-[var(--foreground)] tracking-wide uppercase">How to Use This Tool</h3>
              <ol className="text-sm text-[var(--muted)] leading-relaxed list-decimal list-inside flex flex-col gap-1.5">
                <li>Paste any log output or trace into the input text area.</li>
                <li>Slice lines instantly by choosing a log level filter (e.g. <strong>ERROR</strong>).</li>
                <li>Match specific lines using keywords or regex filters.</li>
              </ol>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-[var(--foreground)] tracking-wide uppercase">Benefits & Use Cases</h3>
              <ul className="text-sm text-[var(--muted)] leading-relaxed list-disc list-inside flex flex-col gap-1.5">
                <li>Identify production application errors and runtime crashes instantly.</li>
                <li>Extract and copy only relevant traces to simplify bug logging.</li>
                <li>Enhance debugging throughput by slicing gigabytes of log lines in real time.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </ToolContainer>
  );
}
