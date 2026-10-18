"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Download,
  FileText,
  Fingerprint,
  ListFilter,
  Search,
  ServerCrash,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ToolContainer, ToolHeader, ToolButton } from "@/components/tools";
import {
  DEFAULT_FILTER,
  LEVELS,
  buildHighlightRegex,
  formatTime,
  parseTimeInput,
  toTimeInput,
  type Analysis,
  type Filter,
  type Incident,
  type IocEntry,
  type Level,
  type QueryResult,
} from "@/lib/log-store";
import type { WorkerRequest, WorkerResponse } from "@/lib/log-worker-protocol";
import LogViewport, { type RowsResponse } from "./LogViewport";

const SAMPLE_LOGS = `[2026-05-03 20:10:15] INFO: Server initialized on port 3000
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

type Tab = "FEED" | "INCIDENTS" | "IOCS";
type Status = "idle" | "loading" | "ready";

const LEVEL_CHIP: Record<Level, string> = {
  CRITICAL: "text-red-500",
  ERROR: "text-red-400",
  WARN: "text-amber-400",
  INFO: "text-foreground/80",
  DEBUG: "text-muted",
};

const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

const cardClass = "rounded-xl border border-border bg-surface";
const labelClass = "text-[11px] font-semibold uppercase tracking-wider text-muted";
const fieldClass =
  "h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-accent";

function Toggle({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`h-9 min-w-9 rounded-lg border px-2.5 font-mono text-xs transition-colors ${
        active ? "border-accent bg-accent/15 text-accent" : "border-border bg-background text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export default function LogAnalyzerClient() {
  const searchParams = useSearchParams();
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, (msg: WorkerResponse) => void>());
  const nextId = useRef(1);
  const pendingLine = useRef<number | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ bytes: 0, total: 0, lines: 0 });
  const [source, setSource] = useState<{ name: string; bytes: number } | null>(null);
  const [loadCount, setLoadCount] = useState(0);

  const [filter, setFilter] = useState<Filter>(DEFAULT_FILTER);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [version, setVersion] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [tab, setTab] = useState<Tab>("FEED");

  const [selected, setSelected] = useState(-1);
  const [jump, setJump] = useState<{ row: number; nonce: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [iocType, setIocType] = useState<IocEntry["type"] | "ALL">("ALL");
  const [copied, setCopied] = useState(false);

  /* ───────────── worker plumbing ───────────── */

  const post = useCallback((msg: WorkerRequest) => workerRef.current?.postMessage(msg), []);

  const request = useCallback(<T extends WorkerResponse>(build: (id: number) => WorkerRequest): Promise<T> => {
    return new Promise((resolve) => {
      const id = nextId.current++;
      pending.current.set(id, (m) => resolve(m as T));
      workerRef.current?.postMessage(build(id));
    });
  }, []);

  const jumpTo = useCallback((row: number) => {
    if (row < 0) return;
    setSelected(row);
    setJump((j) => ({ row, nonce: (j?.nonce ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL("../../../../lib/log-worker.ts", import.meta.url));
    workerRef.current = worker;
    const waiting = pending.current;
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data;
      switch (m.type) {
        case "progress":
          setProgress({ bytes: m.bytes, total: m.total, lines: m.lines });
          break;
        case "loaded":
          setSource((s) => ({ name: s?.name ?? "Pasted text", bytes: m.bytes }));
          setProgress((p) => ({ ...p, lines: m.lines }));
          setStatus("ready");
          setLoadCount((c) => c + 1);
          break;
        case "queryResult":
          setResult(m.result);
          setVersion(m.version);
          setSelected(-1);
          if (pendingLine.current !== null) {
            const line = pendingLine.current;
            pendingLine.current = null;
            const id = nextId.current++;
            waiting.set(id, (r) => {
              if (r.type === "rowOfLine") jumpTo(r.row);
            });
            worker.postMessage({ type: "rowOfLine", id, line } satisfies WorkerRequest);
          }
          break;
        case "analysis":
          setAnalysis(m.analysis);
          break;
        case "error":
          setError(m.message);
          setStatus((s) => (s === "loading" ? "idle" : s));
          break;
        default: {
          const resolve = waiting.get(m.id);
          if (resolve) {
            waiting.delete(m.id);
            resolve(m);
          }
        }
      }
    };
    return () => {
      worker.terminate();
      waiting.clear();
      workerRef.current = null;
    };
  }, [jumpTo]);

  /* ───────────── loading ───────────── */

  const startLoad = useCallback((name: string, size: number) => {
    setError(null);
    setStatus("loading");
    setSource({ name, bytes: size });
    setProgress({ bytes: 0, total: size, lines: 0 });
    setResult(null);
    setAnalysis(null);
    setFilter(DEFAULT_FILTER);
    setSelected(-1);
  }, []);

  const loadFile = useCallback(
    (file: File) => {
      startLoad(file.name, file.size);
      post({ type: "loadFile", file });
    },
    [post, startLoad]
  );

  const loadText = useCallback(
    (text: string, name: string) => {
      if (!text.trim()) return;
      startLoad(name, text.length);
      post({ type: "loadText", text, name });
    },
    [post, startLoad]
  );

  const clearAll = useCallback(() => {
    post({ type: "reset" });
    setStatus("idle");
    setSource(null);
    setResult(null);
    setAnalysis(null);
    setFilter(DEFAULT_FILTER);
    setError(null);
    setPasteText("");
  }, [post]);

  // `?input=` prefill from the home page smart input.
  const prefilled = useRef(false);
  useEffect(() => {
    const prefill = searchParams.get("input");
    if (prefill && !prefilled.current) {
      prefilled.current = true;
      // Wait a tick so the worker effect has created the worker.
      queueMicrotask(() => loadText(prefill, "Pasted text"));
    }
    // An earlier version stored the whole input here, which could not hold large files.
    try {
      localStorage.removeItem("mi_log_analyzer_input");
    } catch {}
  }, [searchParams, loadText]);

  /* ───────────── query ───────────── */

  useEffect(() => {
    if (status !== "ready") return;
    const t = setTimeout(() => post({ type: "query", id: nextId.current++, filter }), 150);
    return () => clearTimeout(t);
  }, [filter, status, loadCount, post]);

  const patch = useCallback((p: Partial<Filter>) => setFilter((f) => ({ ...f, ...p })), []);
  const highlight = useMemo(() => buildHighlightRegex(filter), [filter]);

  const fetchRows = useCallback(
    async (start: number, end: number): Promise<RowsResponse> => {
      const res = await request<Extract<WorkerResponse, { type: "rows" }>>((id) => ({ type: "rows", id, version: 0, start, end }));
      return { version: res.version, start: res.start, rows: res.rows };
    },
    [request]
  );

  const step = useCallback(
    async (dir: 1 | -1) => {
      if (!result || result.matchRows === 0) return;
      const from = selected >= 0 ? selected : dir === 1 ? -1 : result.viewLength;
      const res = await request<Extract<WorkerResponse, { type: "next" }>>((id) => ({ type: "next", id, from, dir }));
      jumpTo(res.row);
    },
    [request, result, selected, jumpTo]
  );

  const exportView = useCallback(async () => {
    const res = await request<Extract<WorkerResponse, { type: "export" }>>((id) => ({ type: "export", id }));
    return res.blob;
  }, [request]);

  const download = async () => {
    const blob = await exportView();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `filtered-${(source?.name ?? "log").replace(/\.[^.]+$/, "")}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyView = async () => {
    const blob = await exportView();
    await navigator.clipboard.writeText(await blob.text());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const showInFeed = (line: number) => {
    pendingLine.current = line;
    setFilter(DEFAULT_FILTER);
    setTab("FEED");
  };

  const searchFor = (value: string) => {
    setFilter({ ...DEFAULT_FILTER, include: value });
    setTab("FEED");
  };

  const toggleLevel = (level: Level) =>
    patch({ levels: filter.levels.includes(level) ? filter.levels.filter((l) => l !== level) : [...filter.levels, level] });

  const clickBucket = (i: number, shift: boolean) => {
    if (!result || result.tMin === null || result.tMax === null) return;
    const span = result.tMax - result.tMin;
    const start = Math.floor(result.tMin + (i * span) / result.histogram.length);
    const end = i === result.histogram.length - 1 ? result.tMax : Math.ceil(result.tMin + ((i + 1) * span) / result.histogram.length) - 1;
    if (shift && filter.from !== null) patch({ from: Math.min(filter.from, start), to: Math.max(end, filter.to ?? end) });
    else patch({ from: start, to: end });
  };

  const hasFilter =
    filter.levels.length > 0 || !!filter.include || !!filter.exclude || filter.from !== null || filter.to !== null;

  const iocs = useMemo(
    () => (analysis ? analysis.iocs.filter((i) => iocType === "ALL" || i.type === iocType) : []),
    [analysis, iocType]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  /* ───────────── render ───────────── */

  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.bytes / progress.total) * 100)) : 0;
  const maxBucket = result ? Math.max(1, ...result.histogram.map((b) => b.count)) : 1;
  const rangeActive = filter.from !== null || filter.to !== null;

  return (
    <ToolContainer categoryId="data-analytics">
      <ToolHeader
        title="Log Analyzer"
        description="Open any log file, search it with regex, filter by level and time, and jump straight to what matters. Everything runs in your browser."
        categoryId="data-analytics"
      />

      <div
        className="flex flex-col gap-5"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setIsDragging(false);
        }}
        onDrop={onDrop}
      >
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        )}

        {status === "idle" && (
          <div
            className={`${cardClass} flex flex-col items-center gap-4 border-dashed p-10 text-center transition-colors ${
              isDragging ? "border-accent bg-accent/5" : ""
            }`}
          >
            <FileText className="size-10 text-accent" />
            <div>
              <h2 className="text-lg font-semibold">Drop a log file here</h2>
              <p className="mt-1 text-sm text-muted">Any text log up to 512 MB. Files are read locally and never uploaded.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <label className="toolsy-button-primary inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold">
                <Upload className="size-3.5" />
                Choose file
                <input
                  type="file"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <ToolButton variant="secondary" size="sm" onClick={() => setPasteOpen((o) => !o)}>
                <ClipboardPaste className="mr-2 size-3.5" />
                Paste text
              </ToolButton>
              <ToolButton variant="secondary" size="sm" onClick={() => loadText(SAMPLE_LOGS, "sample.log")}>
                <Sparkles className="mr-2 size-3.5" />
                Load sample
              </ToolButton>
            </div>
            {pasteOpen && (
              <div className="flex w-full max-w-2xl flex-col gap-2 text-left">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste log text here"
                  className="min-h-[160px] w-full rounded-lg border border-border bg-background p-3 font-mono text-xs outline-none focus:border-accent"
                  aria-label="Log text"
                />
                <div className="flex justify-end">
                  <ToolButton size="sm" disabled={!pasteText.trim()} onClick={() => loadText(pasteText, "Pasted text")}>
                    Analyze
                  </ToolButton>
                </div>
              </div>
            )}
          </div>
        )}

        {status === "loading" && (
          <div className={`${cardClass} flex flex-col gap-3 p-6`}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Reading {source?.name}</span>
              <span className="text-muted">
                {progress.lines.toLocaleString()} lines · {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {status === "ready" && result && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-accent" />
                <span className="font-medium">{source?.name}</span>
                <span className="text-muted">
                  {formatBytes(source?.bytes ?? 0)} · {result.total.toLocaleString()} lines
                  {result.tMin !== null && result.tMax !== null && ` · ${formatTime(result.tMin)} to ${formatTime(result.tMax)}`}
                </span>
              </div>
              <div className="flex gap-2">
                <label className="toolsy-button-secondary inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold">
                  <Upload className="size-3.5" />
                  Open another
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) loadFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <ToolButton variant="secondary" size="sm" onClick={clearAll}>
                  <Trash2 className="mr-2 size-3.5" />
                  Clear
                </ToolButton>
              </div>
            </div>

            <div role="tablist" className="flex max-w-full gap-1 self-start overflow-x-auto rounded-xl border border-border bg-surface p-1">
              {(
                [
                  { id: "FEED", label: "Lines", icon: ListFilter, count: result.viewLength },
                  { id: "INCIDENTS", label: "Incidents", icon: ServerCrash, count: analysis?.incidents.length },
                  { id: "IOCS", label: "Indicators", icon: Fingerprint, count: analysis?.iocTotal },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:px-4 ${
                    tab === t.id ? "bg-accent text-[#04181a]" : "text-muted hover:text-foreground"
                  }`}
                >
                  <t.icon className="size-3.5" />
                  {t.label}
                  <span className="opacity-70">{t.count === undefined ? "…" : t.count.toLocaleString()}</span>
                </button>
              ))}
            </div>

            {tab === "FEED" && (
              <div className="flex flex-col gap-4">
                <div className={`${cardClass} flex flex-col gap-4 p-4`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[220px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                      <input
                        type="text"
                        value={filter.include}
                        onChange={(e) => patch({ include: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void step(e.shiftKey ? -1 : 1);
                          }
                        }}
                        placeholder={filter.regex ? "Regex, e.g. timeout|refused" : "Search. Enter = next match, Shift+Enter = previous"}
                        aria-label="Search"
                        className={`${fieldClass} w-full pl-9 font-mono`}
                      />
                    </div>
                    <Toggle active={filter.regex} onClick={() => patch({ regex: !filter.regex })} title="Regular expression">
                      .*
                    </Toggle>
                    <Toggle active={filter.caseSensitive} onClick={() => patch({ caseSensitive: !filter.caseSensitive })} title="Match case">
                      Aa
                    </Toggle>
                    <Toggle active={filter.wholeWord} onClick={() => patch({ wholeWord: !filter.wholeWord })} title="Whole word">
                      ab
                    </Toggle>
                    <div className="relative min-w-[180px] flex-1 basis-[200px]">
                      <input
                        type="text"
                        value={filter.exclude}
                        onChange={(e) => patch({ exclude: e.target.value })}
                        placeholder={filter.regex ? "Exclude regex" : "Exclude: health, ping"}
                        aria-label="Exclude"
                        className={`${fieldClass} w-full font-mono`}
                      />
                    </div>
                  </div>

                  {result.error && (
                    <p role="alert" className="text-xs text-red-400">
                      Invalid pattern: {result.error}
                    </p>
                  )}

                  <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                    <div className="flex flex-col gap-1.5">
                      <span className={labelClass}>Level</span>
                      <div className="flex flex-wrap gap-1.5">
                        {LEVELS.map((level) => {
                          const on = filter.levels.includes(level);
                          return (
                            <button
                              key={level}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleLevel(level)}
                              className={`h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors ${
                                on ? "border-accent bg-accent/15" : "border-border bg-background hover:bg-surface-raised"
                              } ${LEVEL_CHIP[level]}`}
                            >
                              {level} <span className="opacity-60">{result.levelCounts[level].toLocaleString()}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className={labelClass}>From (as written in log)</span>
                      <input
                        type="datetime-local"
                        step={1}
                        value={toTimeInput(filter.from)}
                        onChange={(e) => patch({ from: parseTimeInput(e.target.value) })}
                        aria-label="From time"
                        className={fieldClass}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className={labelClass}>To</span>
                      <input
                        type="datetime-local"
                        step={1}
                        value={toTimeInput(filter.to)}
                        onChange={(e) => patch({ to: parseTimeInput(e.target.value) })}
                        aria-label="To time"
                        className={fieldClass}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className={labelClass}>Context</span>
                      <select
                        value={filter.context}
                        onChange={(e) => patch({ context: Number(e.target.value) })}
                        aria-label="Context lines"
                        className={fieldClass}
                      >
                        {[0, 1, 2, 5, 10, 25].map((n) => (
                          <option key={n} value={n}>
                            {n === 0 ? "None" : `± ${n} lines`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex h-9 cursor-pointer items-center gap-2 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={filter.collapse}
                        onChange={(e) => patch({ collapse: e.target.checked })}
                        className="size-3.5 accent-[var(--accent)]"
                      />
                      Collapse repeats
                    </label>

                    {hasFilter && (
                      <ToolButton variant="ghost" size="sm" onClick={() => setFilter({ ...DEFAULT_FILTER, context: filter.context, collapse: filter.collapse })}>
                        <X className="mr-1.5 size-3.5" />
                        Reset filters
                      </ToolButton>
                    )}
                  </div>
                </div>

                {result.histogram.length > 0 && (
                  <div className={`${cardClass} flex flex-col gap-2 p-4`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={labelClass}>Timeline · click a bar to select that period, Shift+click to extend</span>
                      {rangeActive && (
                        <button className="text-xs text-accent hover:underline" onClick={() => patch({ from: null, to: null })}>
                          Clear time range
                        </button>
                      )}
                    </div>
                    <div className="flex h-20 items-end gap-[2px]" role="group" aria-label="Events over time">
                      {result.histogram.map((b, i) => {
                        const span = (result.tMax ?? 0) - (result.tMin ?? 0);
                        const start = (result.tMin ?? 0) + (i * span) / result.histogram.length;
                        const end = (result.tMin ?? 0) + ((i + 1) * span) / result.histogram.length;
                        const inRange = !rangeActive || ((filter.from === null || end >= filter.from) && (filter.to === null || start <= filter.to));
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={(e) => clickBucket(i, e.shiftKey)}
                            title={`${formatTime(start)} · ${b.count.toLocaleString()} lines, ${b.errors.toLocaleString()} errors`}
                            aria-label={`${formatTime(start)}: ${b.count} lines`}
                            className={`flex h-full min-w-[3px] flex-1 flex-col justify-end ${inRange ? "" : "opacity-30"}`}
                          >
                            <span
                              className={`w-full rounded-t-sm ${b.errors > 0 ? "bg-red-400/70" : "bg-accent/60"}`}
                              style={{ height: `${Math.max(b.count > 0 ? 3 : 0, (b.count / maxBucket) * 100)}%` }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>
                      <strong className="text-foreground">{result.matched.toLocaleString()}</strong> of {result.total.toLocaleString()} lines
                      {filter.context > 0 && result.viewLength !== result.matched && ` (${result.viewLength.toLocaleString()} shown with context)`}
                    </span>
                    {result.matchRows > 0 && (filter.include || filter.exclude) && (
                      <span className="flex gap-1">
                        <button
                          onClick={() => void step(-1)}
                          aria-label="Previous match"
                          className="rounded-md border border-border p-1 hover:bg-surface-raised"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          onClick={() => void step(1)}
                          aria-label="Next match"
                          className="rounded-md border border-border p-1 hover:bg-surface-raised"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <ToolButton variant="secondary" size="sm" onClick={copyView} disabled={result.viewLength === 0 || result.viewLength > 200_000}>
                      <Copy className="mr-2 size-3.5" />
                      {copied ? "Copied" : "Copy"}
                    </ToolButton>
                    <ToolButton variant="secondary" size="sm" onClick={download} disabled={result.viewLength === 0}>
                      <Download className="mr-2 size-3.5" />
                      Download
                    </ToolButton>
                  </div>
                </div>

                {result.viewLength === 0 ? (
                  <div className={`${cardClass} p-10 text-center text-sm text-muted`}>No lines match the current filters.</div>
                ) : (
                  <LogViewport
                    total={result.viewLength}
                    version={version}
                    fetchRows={fetchRows}
                    highlight={highlight}
                    jump={jump}
                    selected={selected}
                    onSelect={setSelected}
                  />
                )}
              </div>
            )}

            {tab === "INCIDENTS" && (
              <div className="flex flex-col gap-4">
                {!analysis ? (
                  <div className={`${cardClass} p-10 text-center text-sm text-muted`}>Analyzing…</div>
                ) : analysis.incidents.length === 0 ? (
                  <div className={`${cardClass} p-10 text-center text-sm text-muted`}>
                    No crashes, repeated auth failures or connection problems found.
                  </div>
                ) : (
                  analysis.incidents.map((inc: Incident) => (
                    <div key={inc.id} className={`${cardClass} flex flex-col gap-3 p-4`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              inc.severity === "CRITICAL" ? "bg-red-500/20 text-red-400" : inc.severity === "HIGH" ? "bg-red-400/15 text-red-400" : "bg-amber-400/15 text-amber-400"
                            }`}
                          >
                            {inc.severity}
                          </span>
                          <h3 className="text-sm font-semibold">{inc.title}</h3>
                          <span className="text-xs text-muted">{inc.total.toLocaleString()} lines</span>
                        </div>
                        <div className="flex gap-2">
                          {inc.actor && (
                            <ToolButton variant="ghost" size="sm" onClick={() => searchFor(inc.actor as string)}>
                              Search {inc.actor}
                            </ToolButton>
                          )}
                          <ToolButton variant="secondary" size="sm" onClick={() => showInFeed(inc.firstLine)}>
                            Show in lines
                          </ToolButton>
                        </div>
                      </div>
                      <pre className="max-h-[240px] overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-xs text-muted">
                        {inc.preview.map((p) => `${String(p.line + 1).padStart(6)}  ${p.text}`).join("\n")}
                        {inc.total > inc.preview.length ? `\n… ${inc.total - inc.preview.length} more` : ""}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "IOCS" && (
              <div className="flex flex-col gap-3">
                {!analysis ? (
                  <div className={`${cardClass} p-10 text-center text-sm text-muted`}>Analyzing…</div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex gap-1.5">
                        {(["ALL", "IP", "URL", "EMAIL", "HASH"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setIocType(t)}
                            aria-pressed={iocType === t}
                            className={`h-8 rounded-lg border px-3 text-[11px] font-semibold ${
                              iocType === t ? "border-accent bg-accent/15 text-accent" : "border-border bg-background text-muted hover:text-foreground"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <ToolButton variant="secondary" size="sm" disabled={iocs.length === 0} onClick={() => void navigator.clipboard.writeText(iocs.map((i) => i.value).join("\n"))}>
                        <Copy className="mr-2 size-3.5" />
                        Copy list
                      </ToolButton>
                    </div>
                    {iocs.length === 0 ? (
                      <div className={`${cardClass} p-10 text-center text-sm text-muted`}>No indicators of this type.</div>
                    ) : (
                      <div className={`${cardClass} max-h-[600px] overflow-auto`}>
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-surface text-muted">
                            <tr>
                              <th className="px-4 py-2 font-semibold">Type</th>
                              <th className="px-4 py-2 font-semibold">Value</th>
                              <th className="px-4 py-2 text-right font-semibold">Count</th>
                              <th className="px-4 py-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {iocs.map((i) => (
                              <tr key={`${i.type}:${i.value}`} className="border-t border-border hover:bg-surface-raised">
                                <td className="px-4 py-2 text-muted">{i.type}</td>
                                <td className="break-all px-4 py-2 font-mono">{i.value}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{i.count.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right">
                                  <button className="text-accent hover:underline" onClick={() => searchFor(i.value)}>
                                    Find in lines
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {analysis.iocTotal > analysis.iocs.length && (
                      <p className="text-xs text-muted">Showing the first {analysis.iocs.length.toLocaleString()} of {analysis.iocTotal.toLocaleString()} indicators.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {isDragging && status !== "idle" && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 text-lg font-semibold text-accent">
            Drop to open this file
          </div>
        )}
      </div>
    </ToolContainer>
  );
}
