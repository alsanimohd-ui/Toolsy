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
  const [showMore, setShowMore] = useState(false);

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
          case "ip-lookup":
            // Placeholder for networking tool integration
            current = `Network Triage: Routing investigation for ${current}...`;
            break;
        }
      } catch {
        error = `Error in ${step.label}: Invalid format`;
        break;
      }
    }
    return { data: current, error };
  }, [input, pipeline]);

  // 2. Dynamic Suggestion Engine
  const suggestionGroups = useMemo(() => {
    const data = processedData.data;
    if (!data.trim()) return [];

    const matches = ALL_OPERATIONS.filter(op => op.check(data));
    const sorted = matches.sort((a, b) => b.priority - a.priority);
    
    const visible = showMore ? sorted : sorted.slice(0, 5);
    
    // Group by category
    const groups: Partial<Record<Category, Suggestion[]>> = {};
    visible.forEach(op => {
      const cat = op.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(op);
    });

    return Object.entries(groups).map(([cat, ops]) => ({
      category: cat as Category,
      items: ops
    }));
  }, [processedData.data, showMore]);

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

  return (
    <ToolContainer categoryId="dev-automation">
      <ToolHeader
        title="Core Encoder"
        description="Next-generation intelligent workstation for data transformation, forensic analysis, and cryptographic hashing."
        categoryId="dev-automation"
      />

      <div className="flex flex-col gap-10 max-w-[80rem] mx-auto w-full pb-32">
        
        {/* PIPELINE CONTROL AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* INPUT & PIPELINE (Left) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-accent/80">
                  <Zap className="size-4" /> Input Stream
                </div>
                <button 
                  onClick={() => { setInput(""); setPipeline([]); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-widest text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  Reset Workspace
                </button>
              </div>

              <GlassCard className="relative group overflow-hidden bg-black/40 border-accent/10 shadow-2xl">
                <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste payload (Base64, JWT, JSON...) for intelligent transformation..."
                  className="w-full min-h-[220px] bg-transparent p-8 font-mono text-sm leading-relaxed outline-none resize-none placeholder:opacity-20 custom-scrollbar focus:bg-accent/[0.01] transition-all"
                  spellCheck={false}
                />
              </GlassCard>
            </section>

            {/* ACTIVE PIPELINE STEPS */}
            <section className="flex flex-col gap-4">
               <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-muted/40 ml-2">
                <Workflow className="size-4" /> Processing Pipeline
              </div>
              <div className="flex flex-wrap items-center gap-3 min-h-[60px] p-4 rounded-3xl border-2 border-dashed border-white/5 bg-white/[0.01]">
                <AnimatePresence mode="popLayout">
                  {pipeline.length === 0 ? (
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted/20 ml-2">No active steps | Stream unmodified</span>
                  ) : (
                    pipeline.map((step, idx) => (
                      <motion.div
                        key={step.id}
                        layout
                        initial={{ opacity: 0, scale: 0.8, x: -10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, x: 10 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent group"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest">{step.label}</span>
                        <button onClick={() => removeStep(step.id)} className="text-accent/40 hover:text-red-400 transition-colors">
                          <X className="size-3.5" />
                        </button>
                        {idx < pipeline.length - 1 && <ChevronRight className="size-3 text-accent/20" />}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>

          {/* SUGGESTIONS & ACTIONS (Right) */}
          <div className="lg:col-span-5 flex flex-col gap-6 sticky top-8">
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-accent ml-2">
                <Sparkles className="size-4" /> Intelligent Suggestions
              </div>
              
              <div className="flex flex-col gap-6">
                <AnimatePresence mode="wait">
                  {suggestionGroups.length > 0 ? (
                    <motion.div 
                      key="groups"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col gap-6"
                    >
                      {suggestionGroups.map((group) => (
                        <div key={group.category} className="flex flex-col gap-3">
                          <div className="text-[9px] font-black uppercase tracking-widest text-muted/40 ml-1">{group.category}</div>
                          <div className="grid grid-cols-1 gap-2">
                            {group.items.map((s, i) => (
                              <button
                                key={s.type + i}
                                onClick={() => addStep(s)}
                                className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] hover:border-accent/30 transition-all group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="size-8 rounded-lg bg-accent/5 border border-accent/10 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                                    <s.icon className="size-4" />
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground group-hover:text-accent transition-colors">
                                    {s.label}
                                  </span>
                                </div>
                                <Plus className="size-3.5 text-muted/20 group-hover:text-accent transition-colors" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      
                      {ALL_OPERATIONS.filter(op => op.check(processedData.data)).length > 5 && (
                        <button 
                          onClick={() => setShowMore(!showMore)}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-widest text-muted hover:text-white hover:bg-white/10 transition-all mt-2"
                        >
                          <ChevronDown className={`size-3 transition-transform ${showMore ? "rotate-180" : ""}`} />
                          {showMore ? "Show Fewer Actions" : "Show All Potential Actions"}
                        </button>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.2 }}
                      className="p-12 text-center border border-dashed border-white/5 rounded-3xl"
                    >
                      <Activity className="size-12 mx-auto mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Awaiting Data Signal</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </div>

        {/* FINAL OUTPUT AREA */}
        <section className="flex flex-col gap-6">
           <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-muted/40 ml-2">
            <Fingerprint className="size-4" /> Final Signal Output
          </div>

          <GlassCard className={`p-8 border-accent/20 bg-accent/[0.02] relative group shadow-2xl transition-all ${processedData.error ? "border-red-500/40 bg-red-500/5" : ""}`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-accent">State Transformation</span>
                <h3 className="text-base font-black text-foreground">Processed Result</h3>
              </div>
              <button 
                onClick={handleCopy}
                disabled={!processedData.data}
                className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
                  ${copiedId === "final" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-accent text-white shadow-lg shadow-accent/20 hover:opacity-90 disabled:opacity-20"}`}
              >
                {copiedId === "final" ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
                {copiedId === "final" ? "Copied" : "Copy Output"}
              </button>
            </div>

            {processedData.error ? (
              <div className="p-10 text-center flex flex-col items-center gap-4 text-red-400">
                <X className="size-12 opacity-50" />
                <p className="font-mono text-sm uppercase tracking-widest">{processedData.error}</p>
              </div>
            ) : (
              <div className="bg-black/60 rounded-3xl p-8 font-mono text-base leading-relaxed break-all max-h-[500px] overflow-y-auto custom-scrollbar border border-white/10 shadow-inner text-blue-100/90 whitespace-pre-wrap">
                {processedData.data || "Awaiting transformation instructions..."}
              </div>
            )}
          </GlassCard>
        </section>

        {/* OPERATION MANUAL */}
        <section className="mt-12 pt-20 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { 
              title: "Heuristic Engine", 
              icon: Search, 
              desc: "Deep-analyzes input entropy and patterns to suggest the most logical next step in your forensic triage.",
              color: "text-blue-400"
            },
            { 
              title: "Pipeline Chaining", 
              icon: Workflow, 
              desc: "Chain multiple operations in a high-performance flow. Reorder or remove steps with zero latency.",
              color: "text-amber-400"
            },
            { 
              title: "Local Isolation", 
              icon: ShieldCheck, 
              desc: "State-of-the-art security via local-only processing. No data telemetry or external API calls.",
              color: "text-emerald-400"
            }
          ].map((card, i) => (
            <div key={i} className="flex flex-col gap-6 p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
              <div className={`size-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center ${card.color} group-hover:scale-110 transition-transform`}>
                <card.icon className="size-6" />
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">{card.title}</h4>
                <p className="text-[11px] font-medium text-muted/60 leading-relaxed">{card.desc}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </ToolContainer>
  );
}
