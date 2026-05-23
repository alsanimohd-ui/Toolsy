"use client";

import React, { useState, useMemo } from "react";
import { ToolContainer, ToolHeader } from "@/components/tools";
import { 
  Zap, 
  Search, 
  Trash2, 
  Copy, 
  CheckCircle2, 
  Hash, 
  RefreshCcw,
  Sparkles,
  Fingerprint,
  ChevronRight,
  Plus,
  X,
  FileCode,
  ShieldCheck,
  Activity,
  Workflow,
  Globe,
  Binary,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/ui/GlassCard";
import forge from "node-forge";

/* ─────────────────────────────────────────────
   Types & Utilities
  ───────────────────────────────────────────── */

type Category = "Encoding" | "Decoding" | "Hashing" | "Parsing" | "Networking";

type OpType = 
  | "base64-decode" | "base64-encode" 
  | "hex-decode" | "hex-encode" 
  | "url-decode" | "url-encode" 
  | "json-prettify" | "json-minify" 
  | "jwt-decode"
  | "sha256" | "sha512" | "md5"
  | "binary-decode" | "binary-encode"
  | "ip-lookup";

interface Suggestion {
  type: OpType;
  label: string;
  category: Category;
  icon: React.ElementType;
  priority: number;
  check: (data: string) => boolean;
}

interface PipelineStep {
  id: string;
  type: OpType;
  label: string;
}

const DETECTORS = {
  json: (s: string) => {
    try {
      const p = JSON.parse(s);
      return typeof p === "object" && p !== null;
    } catch { return false; }
  },
  base64: (s: string) => /^[A-Za-z0-9+/]*={0,2}$/.test(s) && s.length % 4 === 0 && s.length > 8,
  hex: (s: string) => /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0 && s.length > 4,
  url: (s: string) => /%[0-9a-fA-F]{2}/.test(s),
  jwt: (s: string) => /^([a-zA-Z0-9_=]+)\.([a-zA-Z0-9_=]+)\.([a-zA-Z0-9_\-\+\/=]*)$/.test(s),
  binary: (s: string) => /^[01\s]+$/.test(s) && s.replace(/\s/g, "").length >= 8,
  ip: (s: string) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(s.trim()),
};

const ALL_OPERATIONS: Suggestion[] = [
  { type: "jwt-decode", label: "Parse JWT", category: "Parsing", icon: ShieldCheck, priority: 10, check: DETECTORS.jwt },
  { type: "json-prettify", label: "Prettify JSON", category: "Parsing", icon: FileCode, priority: 9, check: DETECTORS.json },
  { type: "json-minify", label: "Minify JSON", category: "Parsing", icon: Trash2, priority: 8, check: DETECTORS.json },
  { type: "base64-decode", label: "Base64 Decode", category: "Decoding", icon: RefreshCcw, priority: 9, check: DETECTORS.base64 },
  { type: "hex-decode", label: "Hex Decode", category: "Decoding", icon: Binary, priority: 8, check: DETECTORS.hex },
  { type: "url-decode", label: "URL Decode", category: "Decoding", icon: Globe, priority: 8, check: DETECTORS.url },
  { type: "binary-decode", label: "Binary Decode", category: "Decoding", icon: Binary, priority: 7, check: DETECTORS.binary },
  { type: "ip-lookup", label: "IP Lookup", category: "Networking", icon: Globe, priority: 10, check: DETECTORS.ip },
  
  // Encodings & Hashes (Fallback or Contextual)
  { type: "base64-encode", label: "Base64 Encode", category: "Encoding", icon: RefreshCcw, priority: 5, check: (s) => s.length > 0 },
  { type: "hex-encode", label: "Hex Encode", category: "Encoding", icon: Binary, priority: 4, check: (s) => s.length > 0 },
  { type: "url-encode", label: "URL Encode", category: "Encoding", icon: Globe, priority: 3, check: (s) => s.length > 0 },
  { type: "sha256", label: "SHA-256", category: "Hashing", icon: Hash, priority: 5, check: (s) => s.length > 0 },
  { type: "md5", label: "MD5", category: "Hashing", icon: Hash, priority: 4, check: (s) => s.length > 0 },
];

/* ─────────────────────────────────────────────
   Core Encoder Component
  ───────────────────────────────────────────── */

export default function CoreEncoderClient() {

  const [input, setInput] = useState("");
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. Core Processing Engine
  const processedData = useMemo(() => {
    let current = input;
    let error: string | null = null;

    for (const step of pipeline) {
      try {
        switch (step.type) {
          case "base64-decode": current = atob(current); break;
          case "base64-encode": current = btoa(current); break;
          case "hex-decode": current = forge.util.hexToBytes(current); break;
          case "hex-encode": current = forge.util.bytesToHex(current); break;
          case "url-decode": current = decodeURIComponent(current); break;
          case "url-encode": current = encodeURIComponent(current); break;
          case "json-prettify": current = JSON.stringify(JSON.parse(current), null, 2); break;
          case "json-minify": current = JSON.stringify(JSON.parse(current)); break;
          case "jwt-decode": 
            const parts = current.split('.');
            current = JSON.stringify({
              header: JSON.parse(atob(parts[0])),
              payload: JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))),
              signature: parts[2]
            }, null, 2);
            break;
          case "sha256": 
            const sha = forge.md.sha256.create();
            sha.update(current);
            current = sha.digest().toHex();
            break;
          case "sha512":
            const sha512 = forge.md.sha512.create();
            sha512.update(current);
            current = sha512.digest().toHex();
            break;
          case "md5":
            const md = forge.md.md5.create();
            md.update(current);
            current = md.digest().toHex();
            break;
          case "binary-decode":
            const clean = current.replace(/\s/g, "");
            let text = "";
            for (let i = 0; i < clean.length; i += 8) {
              text += String.fromCharCode(parseInt(clean.substr(i, 8), 2));
            }
            current = text;
            break;
          case "binary-encode":
            let bin = "";
            for (let i = 0; i < current.length; i++) {
              bin += current.charCodeAt(i).toString(2).padStart(8, '0') + " ";
            }
            current = bin.trim();
            break;
        }
      } catch {
        error = `Error in ${step.label}: Invalid format`;
        break;
      }
    }
    return { data: current, error };
  }, [input, pipeline]);

  // 2. Action Logic
  const addStep = (op: { type: OpType; label: string }) => {
    setPipeline([...pipeline, { id: Math.random().toString(36).substr(2, 9), ...op }]);
  };

  const removeStep = (id: string) => {
    setPipeline(pipeline.filter(s => s.id !== id));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(processedData.data);
    setCopiedId("final");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const matchingOps = useMemo(() => {
    const data = processedData.data;
    if (!data.trim()) return [];
    return ALL_OPERATIONS.filter(op => op.check(data)).sort((a, b) => b.priority - a.priority);
  }, [processedData.data]);

  return (
    <ToolContainer categoryId="dev-automation">
      <ToolHeader
        title="Core Encoder"
        description="High-fidelity data transformation workstation with intelligent heuristics."
        categoryId="dev-automation"
      />

      <div className="flex flex-col gap-8 max-w-[80rem] mx-auto w-full pb-32">
        
        {/* INPUT AREA */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-accent/80">
              <Zap className="size-4" /> Input Stream
            </div>
            <button 
              onClick={() => { setInput(""); setPipeline([]); }}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-widest text-muted hover:text-red-400 transition-all"
            >
              Reset
            </button>
          </div>

          <GlassCard className="relative overflow-hidden bg-black/40 border-accent/10 shadow-2xl">
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste payload (Base64, JWT, JSON...) for transformation..."
              className="w-full min-h-[160px] bg-transparent p-6 font-mono text-sm leading-relaxed outline-none resize-none placeholder:opacity-20 custom-scrollbar focus:bg-accent/[0.01] transition-all"
              spellCheck={false}
            />
            
            {/* Quick Actions Bar inside Input Block */}
            <div className="flex items-center gap-2 p-3 bg-white/[0.03] border-t border-white/5 overflow-x-auto custom-scrollbar">
              <span className="text-[8px] font-black uppercase tracking-widest text-muted/40 px-2 shrink-0">Quick Decode:</span>
              {[
                { type: "base64-decode", label: "Base64", icon: RefreshCcw },
                { type: "jwt-decode", label: "JWT", icon: ShieldCheck },
                { type: "json-prettify", label: "JSON", icon: FileCode },
                { type: "hex-decode", label: "Hex", icon: Binary },
                { type: "url-decode", label: "URL", icon: Globe },
              ].map(op => (
                <button
                  key={op.type}
                  onClick={() => addStep(op as any)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-widest text-muted hover:text-accent hover:border-accent/40 transition-all whitespace-nowrap"
                >
                  <op.icon className="size-3" /> {op.label}
                </button>
              ))}
            </div>
          </GlassCard>
        </section>

        {/* PIPELINE & SUGGESTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Active Pipeline (Left) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
             <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-muted/40 ml-2">
              <Workflow className="size-4" /> Processing Chain
            </div>
            <div className="flex flex-wrap items-center gap-3 min-h-[60px] p-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
              <AnimatePresence mode="popLayout">
                {pipeline.length === 0 ? (
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted/20 ml-2">No operations active</span>
                ) : (
                  pipeline.map((step, idx) => (
                    <motion.div
                      key={step.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent group"
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest">{step.label}</span>
                      <button onClick={() => removeStep(step.id)} className="text-accent/40 hover:text-red-400 transition-colors">
                        <X className="size-3.5" />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Suggestions (Right) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-accent/80 ml-2">
              <Sparkles className="size-4" /> Smart Actions
            </div>
            <div className="flex flex-col gap-2">
              <AnimatePresence mode="wait">
                {matchingOps.length > 0 ? (
                  <motion.div key="suggestions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-2">
                    {matchingOps.slice(0, 3).map((s, i) => (
                      <button
                        key={s.type + i}
                        onClick={() => addStep(s)}
                        className="flex items-center justify-between p-3 rounded-xl bg-accent/5 border border-accent/20 hover:bg-accent/10 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <s.icon className="size-4 text-accent" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-foreground group-hover:text-accent transition-colors">
                            {s.label}
                          </span>
                        </div>
                        <Plus className="size-3.5 text-accent/40" />
                      </button>
                    ))}
                  </motion.div>
                ) : (
                  <div className="p-8 text-center border border-white/5 rounded-2xl opacity-20">
                    <span className="text-[9px] font-black uppercase tracking-widest">Awaiting Signal...</span>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* RESULTS AREA */}
        <section className="flex flex-col gap-4">
           <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-muted/40 ml-2">
            <Fingerprint className="size-4" /> Processed Output
          </div>

          <GlassCard className={`p-6 border-accent/20 bg-accent/[0.02] transition-all ${processedData.error ? "border-red-500/40 bg-red-500/5" : ""}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase tracking-[0.4em] text-accent">State Transformation</span>
                <h3 className="text-sm font-black text-foreground">Result Stream</h3>
              </div>
              <button 
                onClick={handleCopy}
                disabled={!processedData.data}
                className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
                  ${copiedId === "final" ? "bg-emerald-500 text-white" : "bg-accent text-white hover:opacity-90 disabled:opacity-20"}`}
              >
                {copiedId === "final" ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
                {copiedId === "final" ? "Copied" : "Copy Output"}
              </button>
            </div>

            {processedData.error ? (
              <div className="p-8 text-center flex flex-col items-center gap-4 text-red-400">
                <X className="size-10 opacity-50" />
                <p className="font-mono text-xs uppercase tracking-widest">{processedData.error}</p>
              </div>
            ) : (
              <div className="bg-black/60 rounded-2xl p-6 font-mono text-sm leading-relaxed break-all max-h-[400px] overflow-y-auto custom-scrollbar border border-white/5 text-blue-100/90 whitespace-pre-wrap selection:bg-accent/40">
                {processedData.data || "Awaiting transformation..."}
              </div>
            )}
          </GlassCard>
        </section>

        {/* ALL OPERATIONS (Categorized) */}
        <section className="mt-8 flex flex-col gap-6">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-muted/40 ml-2">
            <Search className="size-4" /> All Operations
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from(new Set(ALL_OPERATIONS.map(op => op.category))).map(cat => (
              <div key={cat} className="flex flex-col gap-3">
                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted/30 ml-1">{cat}</h4>
                <div className="flex flex-col gap-1.5">
                  {ALL_OPERATIONS.filter(op => op.category === cat).map(op => (
                    <button
                      key={op.type}
                      onClick={() => addStep(op)}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] hover:border-accent/20 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <op.icon className="size-3.5 text-muted/40 group-hover:text-accent transition-colors" />
                        <span className="text-[10px] font-bold text-muted group-hover:text-foreground transition-colors">{op.label}</span>
                      </div>
                      <Plus className="size-3 text-muted/10 group-hover:text-accent transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ToolContainer>
  );
}
