"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ToolContainer, ToolHeader } from "@/components/tools";
import {
  Zap,
  Copy,
  CheckCircle2,
  Hash,
  RefreshCcw,
  Sparkles,
  Fingerprint,
  Plus,
  X,
  Globe,
  Binary,
  Search,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  GripVertical,
  Terminal,
} from "lucide-react";
import { Reorder } from "framer-motion";
import forge from "node-forge";

/* ═══════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════ */

type Category = "Encoding" | "Decoding" | "Hashing";

type OpType =
  | "base64-encode" | "base64-decode"
  | "hex-encode" | "hex-decode"
  | "url-encode" | "url-decode"
  | "html-encode" | "html-decode"
  | "binary-encode" | "binary-decode"
  | "md5" | "sha1" | "sha256" | "sha512"
  | "hmac";

interface OpDefinition {
  type: OpType;
  label: string;
  category: Category;
  icon: React.ElementType;
  hasConfig?: boolean;
  configLabel?: string;
  configPlaceholder?: string;
}

interface ChainStep {
  id: string;
  type: OpType;
  config: Record<string, string>;
}

interface StepResult {
  output: string;
  error: string | null;
}

interface Preset {
  label: string;
  icon: React.ElementType;
  steps: { type: OpType; label: string; config?: Record<string, string> }[];
}

/* ═══════════════════════════════════════════════
   Operations Library
   ═══════════════════════════════════════════════ */

const CATEGORY_LABELS: Record<Category, string> = {
  Encoding: "Encoding",
  Decoding: "Decoding",
  Hashing: "Hashing",
};

const ALL_OPS: OpDefinition[] = [
  { type: "base64-encode", label: "Base64 Encode", category: "Encoding", icon: RefreshCcw },
  { type: "base64-decode", label: "Base64 Decode", category: "Decoding", icon: RefreshCcw },
  { type: "hex-encode", label: "Hex Encode", category: "Encoding", icon: Binary },
  { type: "hex-decode", label: "Hex Decode", category: "Decoding", icon: Binary },
  { type: "url-encode", label: "URL Encode", category: "Encoding", icon: Globe },
  { type: "url-decode", label: "URL Decode", category: "Decoding", icon: Globe },
  { type: "html-encode", label: "HTML Encode", category: "Encoding", icon: Eye },
  { type: "html-decode", label: "HTML Decode", category: "Decoding", icon: EyeOff },
  { type: "binary-encode", label: "Binary Encode", category: "Encoding", icon: Binary },
  { type: "binary-decode", label: "Binary Decode", category: "Decoding", icon: Binary },
  { type: "md5", label: "MD5", category: "Hashing", icon: Hash },
  { type: "sha1", label: "SHA-1", category: "Hashing", icon: Fingerprint },
  { type: "sha256", label: "SHA-256", category: "Hashing", icon: Fingerprint },
  { type: "sha512", label: "SHA-512", category: "Hashing", icon: Fingerprint },
  { type: "hmac", label: "HMAC", category: "Hashing", icon: Key, hasConfig: true, configLabel: "Secret Key", configPlaceholder: "Enter HMAC secret..." },
];

const CATEGORIES = Array.from(new Set(ALL_OPS.map((o) => o.category))) as Category[];

/* ═══════════════════════════════════════════════
   HTML Entity Helpers (browser-safe)
   ═══════════════════════════════════════════════ */

function htmlEncode(str: string): string {
  const el = document.createElement("span");
  el.appendChild(document.createTextNode(str));
  return el.innerHTML;
}

function htmlDecode(str: string): string {
  const el = document.createElement("span");
  el.innerHTML = str;
  return el.textContent || "";
}

/* ═══════════════════════════════════════════════
   Pipeline Execution Engine
   ═══════════════════════════════════════════════ */

function executeStep(input: string, step: ChainStep): StepResult {
  try {
    const t = step.type;
    if (!input && t !== "md5" && t !== "sha1" && t !== "sha256" && t !== "sha512" && t !== "hmac") {
      return { output: input, error: null };
    }
    let result = input;

    switch (t) {
      case "base64-decode": result = atob(input); break;
      case "base64-encode": result = btoa(input); break;
      case "hex-decode": result = forge.util.hexToBytes(input); break;
      case "hex-encode": result = forge.util.bytesToHex(input); break;
      case "url-decode": result = decodeURIComponent(input); break;
      case "url-encode": result = encodeURIComponent(input); break;
      case "html-encode": result = htmlEncode(input); break;
      case "html-decode": result = htmlDecode(input); break;
      case "md5": { const md = forge.md.md5.create(); md.update(input); result = md.digest().toHex(); break; }
      case "sha1": { const md = forge.md.sha1.create(); md.update(input); result = md.digest().toHex(); break; }
      case "sha256": { const md = forge.md.sha256.create(); md.update(input); result = md.digest().toHex(); break; }
      case "sha512": { const md = forge.md.sha512.create(); md.update(input); result = md.digest().toHex(); break; }
      case "hmac": {
        const key = step.config.key || "";
        if (!key) return { output: "", error: "HMAC requires a secret key" };
        const hmac = forge.hmac.create();
        hmac.start("sha256", key);
        hmac.update(input);
        result = hmac.digest().toHex();
        break;
      }
      case "binary-decode": {
        const clean = input.replace(/\s/g, "");
        let text = "";
        for (let i = 0; i < clean.length; i += 8) {
          text += String.fromCharCode(parseInt(clean.substring(i, i + 8), 2));
        }
        result = text;
        break;
      }
      case "binary-encode": {
        let bin = "";
        for (let i = 0; i < input.length; i++) {
          bin += input.charCodeAt(i).toString(2).padStart(8, "0") + " ";
        }
        result = bin.trim();
        break;
      }
      default:
        return { output: input, error: `Unknown operation: ${t}` };
    }
    return { output: result, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Operation failed";
    return { output: input, error: msg };
  }
}

function runPipeline(input: string, steps: ChainStep[]): StepResult[] {
  let current = input;
  const results: StepResult[] = [];
  for (const step of steps) {
    const r = executeStep(current, step);
    results.push(r);
    if (r.error) {
      // Subsequent steps receive the previous input unchanged so chain stays visible
    } else {
      current = r.output;
    }
  }
  return results;
}

/* ═══════════════════════════════════════════════
   Quick Decode Presets
   ═══════════════════════════════════════════════ */

const PRESETS: Preset[] = [
  { label: "Base64", icon: RefreshCcw, steps: [{ type: "base64-decode", label: "Base64 Decode" }] },
  { label: "Hex", icon: Binary, steps: [{ type: "hex-decode", label: "Hex Decode" }] },
  { label: "URL", icon: Globe, steps: [{ type: "url-decode", label: "URL Decode" }] },
  {
    label: "Base64 → Hex",
    icon: Sparkles,
    steps: [
      { type: "base64-decode", label: "Base64 Decode" },
      { type: "hex-encode", label: "Hex Encode" },
    ],
  },
];

/* ═══════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════ */

export default function CoreEncoderClient() {
  const [input, setInput] = useState("");
  const [pipeline, setPipeline] = useState<ChainStep[]>([]);
  const [copied, setCopied] = useState(false);
  const [opSearch, setOpSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Pipeline Execution ───────────────────── */

  const stepResults = useMemo(() => runPipeline(input, pipeline), [input, pipeline]);

  const finalOutput = useMemo(() => {
    if (stepResults.length === 0) return input;
    return stepResults[stepResults.length - 1].output;
  }, [stepResults, input]);

  const hasError = useMemo(() => stepResults.some((r) => r.error), [stepResults]);

  /* ── Step Handlers ────────────────────────── */

  const addStep = useCallback((type: OpType, label: string, config?: Record<string, string>) => {
    setPipeline((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 11), type, config: config || {} },
    ]);
    setOpSearch("");
  }, []);

  const clearChainAndAdd = useCallback((preset: Preset) => {
    setPipeline(
      preset.steps.map((s) => ({
        id: Math.random().toString(36).substring(2, 11),
        type: s.type,
        config: s.config || {},
      }))
    );
    setOpSearch("");
  }, []);

  const removeStep = useCallback((id: string) => {
    setPipeline((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateStepConfig = useCallback((id: string, key: string, value: string) => {
    setPipeline((prev) =>
      prev.map((s) => (s.id === id ? { ...s, config: { ...s.config, [key]: value } } : s))
    );
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(finalOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [finalOutput]);

  const resetAll = useCallback(() => {
    setInput("");
    setPipeline([]);
    setOpSearch("");
  }, []);

  /* ── Textarea auto-resize ─────────────────── */

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 360) + "px";
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 360) + "px";
    }
  }, [input]);

  /* ── Cmd+K focus search ───────────────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Operations Browser ───────────────────── */

  const filteredOps = useMemo(() => {
    if (!opSearch.trim()) return null;
    const q = opSearch.toLowerCase();
    return ALL_OPS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.type.toLowerCase().includes(q) ||
        o.category.toLowerCase().includes(q)
    );
  }, [opSearch]);

  const opDefMap = useMemo(() => {
    const m = new Map<OpType, OpDefinition>();
    ALL_OPS.forEach((o) => m.set(o.type, o));
    return m;
  }, []);

  const activeStepWithConfig = useMemo(
    () => pipeline.find((s) => opDefMap.get(s.type)?.hasConfig),
    [pipeline, opDefMap]
  );

  /* ── Render ───────────────────────────────── */

  return (
    <ToolContainer categoryId="dev-automation">
      <ToolHeader
        title="Core Encoder"
        description="Data transformation pipeline with live input & output."
        categoryId="dev-automation"
      />

      <div className="flex flex-1 min-h-0 gap-5">
        {/* ════════════ LEFT: DATA STREAM ════════════ */}
        <div className="flex flex-col flex-1 min-w-0 gap-5">
          {/* ── Input Card ── */}
          <div className="toolsy-card flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <Zap className="size-4 text-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground">Input</span>
              </div>
              <button
                onClick={resetAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-muted/50 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
              >
                <X className="size-3" />
                Clear
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Paste payload for transformation…"
              className="w-full min-h-[80px] bg-transparent p-5 font-mono text-sm leading-relaxed outline-none resize-none placeholder:opacity-15 custom-scrollbar focus:bg-accent/[0.01] transition-all flex-1"
              spellCheck={false}
              rows={3}
            />

            {activeStepWithConfig && (
              <div className="shrink-0 border-t border-border px-5 py-3 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <Key className="size-3.5 text-muted/40 shrink-0" />
                  <input
                    type="text"
                    value={activeStepWithConfig.config.key || ""}
                    onChange={(e) => updateStepConfig(activeStepWithConfig.id, "key", e.target.value)}
                    placeholder="Enter HMAC secret key…"
                    className="bg-transparent text-xs font-mono text-foreground outline-none flex-1 placeholder:opacity-25"
                    aria-label="HMAC Secret Key"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Output Card ── */}
          <div className="toolsy-card flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <Terminal className="size-4 text-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground">Output</span>
                {pipeline.length > 0 && (
                  <span className="text-muted/40 font-mono text-[9px] tracking-normal bg-white/[0.04] px-2 py-0.5 rounded-md">
                    {finalOutput.length} chars
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasError && pipeline.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[7px] font-black uppercase tracking-widest">
                    <AlertTriangle className="size-2.5" />
                    Pipeline Error
                  </span>
                )}
                <button
                  onClick={handleCopy}
                  disabled={!finalOutput}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border ${
                    copied
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "text-muted/50 hover:text-foreground hover:bg-white/5 border-transparent hover:border-white/10"
                  } disabled:opacity-20`}
                >
                  {copied ? <CheckCircle2 className="size-3" /> : <Copy className="size-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <pre
              className={`flex-1 min-h-0 p-5 font-mono text-sm leading-relaxed overflow-auto custom-scrollbar whitespace-pre-wrap break-all selection:bg-accent/30 transition-colors ${
                hasError && pipeline.length > 0
                  ? "text-red-300/70"
                  : "text-blue-100/90"
              }`}
            >
              {finalOutput || "Awaiting transformation…"}
            </pre>
          </div>
        </div>

        {/* ════════════ RIGHT: ENGINE PANEL ════════════ */}
        <div className="flex flex-col w-[400px] shrink-0 gap-5">
          {/* ── Processing Chain Card ── */}
          <div className="toolsy-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="size-4 text-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground">
                  Processing Chain
                </span>
                {pipeline.length > 0 && (
                  <span className="text-muted/40 font-mono text-[9px] tracking-normal bg-white/[0.04] px-2 py-0.5 rounded-md">
                    {pipeline.length}
                  </span>
                )}
              </div>
            </div>

            {pipeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-5 text-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted/20">
                  No steps in chain
                </span>
                <span className="text-[8px] text-muted/15 mt-1">
                  Add operations below to build your pipeline
                </span>
              </div>
            ) : (
              <div className="flex flex-col max-h-[220px] overflow-y-auto custom-scrollbar">
                <Reorder.Group
                  axis="y"
                  values={pipeline}
                  onReorder={setPipeline}
                  className="flex flex-col gap-0.5 p-1.5"
                >
                  {pipeline.map((step, idx) => {
                    const def = opDefMap.get(step.type);
                    const result = stepResults[idx];
                    return (
                      <Reorder.Item
                        key={step.id}
                        value={step}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-xl border cursor-grab active:cursor-grabbing select-none transition-colors
                          ${result?.error
                            ? "border-red-500/30 bg-red-500/8 text-red-300"
                            : "border-border hover:border-accent/20 hover:bg-accent/[0.03] text-foreground"
                          }
                        `}
                      >
                        <GripVertical className="size-3.5 text-muted/30 shrink-0" />
                        <div className="flex items-center justify-center size-6 rounded-lg bg-white/[0.04] shrink-0">
                          {def && <def.icon className="size-3.5 text-accent" />}
                        </div>
                        <span className="flex-1 text-[11px] font-bold truncate">
                          {def?.label || step.type}
                        </span>
                        {idx === 0 && (
                          <span className="text-[7px] font-black uppercase tracking-widest text-accent/40 bg-accent/[0.06] px-1.5 py-0.5 rounded shrink-0">
                            First
                          </span>
                        )}
                        {result?.error && (
                          <AlertTriangle className="size-3 text-red-400 shrink-0" />
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                          className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
                          aria-label={`Remove ${def?.label || step.type}`}
                        >
                          <X className="size-3 text-muted/40 hover:text-red-400" />
                        </button>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </div>
            )}
          </div>

          {/* ── Operations Library Card ── */}
          <div className="toolsy-card flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <Search className="size-4 text-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground">
                  Operations
                </span>
                <span className="text-muted/30 font-mono text-[8px]">({ALL_OPS.length})</span>
              </div>
            </div>

            <div className="shrink-0 px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted/30 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={opSearch}
                  onChange={(e) => setOpSearch(e.target.value)}
                  placeholder="Search…  (⌘K)"
                  className="w-full h-8 bg-black/40 border border-border-subtle pl-9 pr-3 rounded-xl text-[11px] font-mono outline-none placeholder:opacity-25 focus:border-accent/40 transition-all"
                />
                {opSearch && (
                  <button
                    onClick={() => setOpSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted/30 hover:text-foreground transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 pb-4">
              {opSearch.trim() ? (
                <div className="flex flex-wrap gap-1.5">
                  {filteredOps!.length === 0 ? (
                    <span className="text-[9px] text-muted/30 py-4 text-center w-full">No matching operations</span>
                  ) : (
                    filteredOps!.map((op) => (
                      <button
                        key={op.type}
                        onClick={() => addStep(op.type, op.label)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-border-subtle hover:bg-accent/[0.08] hover:border-accent/25 transition-all group text-[9px] font-semibold text-muted hover:text-accent"
                        title={`${op.label} — ${op.category}`}
                      >
                        <op.icon className="size-3 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                        <span className="whitespace-nowrap">{op.label}</span>
                        <Plus className="size-2.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {CATEGORIES.map((cat) => (
                    <div key={cat}>
                      <span className="text-[7px] font-black uppercase tracking-[0.2em] text-muted/30 block mb-1.5">
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_OPS.filter((o) => o.category === cat).map((op) => (
                          <button
                            key={op.type}
                            onClick={() => addStep(op.type, op.label)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-border-subtle hover:bg-accent/[0.08] hover:border-accent/25 transition-all group text-[9px] font-semibold text-muted hover:text-accent"
                            title={op.label}
                          >
                            <op.icon className="size-3 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                            <span className="whitespace-nowrap">{op.label}</span>
                            <Plus className="size-2.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Quick Presets Card ── */}
          <div className="toolsy-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-4 text-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground">
                  Quick Presets
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => clearChainAndAdd(p)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-subtle bg-white/[0.02] hover:bg-white/[0.06] hover:border-accent/25 transition-all text-[8px] font-black uppercase tracking-widest text-muted/60 hover:text-accent"
                  title={`${p.steps.map((s) => s.label).join(" → ")}`}
                >
                  <p.icon className="size-2.5" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ToolContainer>
  );
}
