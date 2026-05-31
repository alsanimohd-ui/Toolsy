"use client";

import { useState, useEffect, useRef } from "react";
import {
  ToolContainer,
  ToolHeader,
} from "@/components/tools";
import { 
  Code2, 
  ListTree, 
  AlertTriangle,
  PlayCircle,
  ArrowRightLeft,
  Database,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import GlassCard from "@/components/ui/GlassCard";
import type { RegexEngineResult } from "@/lib/regex-engine";

const DEFAULT_RESULT: RegexEngineResult = {
  isValid: true,
  matches: [],
  explanation: [],
  executionTime: 0,
  replacedText: "",
};

/* ─────────────────────────────────────────────
   Presets
  ───────────────────────────────────────────── */
const PRESETS = [
  { label: "Email Address", pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", flags: "g" },
  { label: "IPv4 Address", pattern: "\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b", flags: "g" },
  { label: "UUID / GUID", pattern: "\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\b", flags: "g" },
  { label: "URL", pattern: "https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)", flags: "g" },
  { label: "Credit Card", pattern: "\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\\d{3})\\d{11})\\b", flags: "g" }
];

/* ─────────────────────────────────────────────
   Component
  ───────────────────────────────────────────── */
export default function RegexStudioClient() {
  const [pattern, setPattern] = useState<string>("([A-Z])\\w+");
  const [flags, setFlags] = useState<string>("g");
  const [testString, setTestString] = useState<string>("Welcome to Regex Studio!\nThis is a World-Class testing environment.\nSupports Multiline, Unicode, and Replace.");
  const [replaceString, setReplaceString] = useState<string>("");
  const [outputMode, setOutputMode] = useState<"highlight" | "extracted" | "groups" | "replace">("highlight");
  const [workerResult, setWorkerResult] = useState<RegexEngineResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!pattern) return;

    setIsProcessing(true);
    setWorkerResult(null);

    const worker = new Worker(new URL("../../../../lib/regex-worker.ts", import.meta.url));
    workerRef.current = worker;

    const timeoutId = setTimeout(() => {
      worker.terminate();
      setWorkerResult({
        isValid: false,
        error:
          "Execution timed out after 5 seconds. Your pattern may be causing catastrophic backtracking.",
        matches: [],
        explanation: [],
        executionTime: 5000,
        replacedText: testString,
      });
      setIsProcessing(false);
    }, 5000);

    worker.onmessage = (e: MessageEvent) => {
      clearTimeout(timeoutId);
      setWorkerResult(e.data);
      setIsProcessing(false);
      worker.terminate();
    };

    worker.postMessage({ pattern, flags, testString, replaceString });

    return () => {
      clearTimeout(timeoutId);
      worker.terminate();
    };
  }, [pattern, flags, testString, replaceString]);

  const engineResult = workerResult ?? DEFAULT_RESULT;

  const toggleFlag = (flag: string) => {
    if (flags.includes(flag)) {
      setFlags(flags.replace(flag, ""));
    } else {
      setFlags(flags + flag);
    }
  };

  // Helper to highlight text
  const renderHighlightedText = () => {
    if (!engineResult.isValid || engineResult.matches.length === 0 || !pattern) {
      return <span className="opacity-80">{testString || "Enter test string here..."}</span>;
    }

    const result = [];
    let lastIndex = 0;

    engineResult.matches.forEach((m, i) => {
      if (m.index > lastIndex) {
        result.push(<span key={`text-${i}`}>{testString.substring(lastIndex, m.index)}</span>);
      }
      result.push(
        <mark key={`mark-${i}`} className="bg-accent/30 text-accent font-bold px-0.5 rounded border-b border-accent/50">
          {testString.substring(m.index, m.index + m.length)}
        </mark>
      );
      lastIndex = m.index + m.length;
    });

    if (lastIndex < testString.length) {
      result.push(<span key={`text-end`}>{testString.substring(lastIndex)}</span>);
    }

    return result;
  };

  return (
    <ToolContainer categoryId="dev-automation">
      <ToolHeader
        title="Regex Studio"
        description="World-class regex debugging and pattern analysis workstation. Write, test, and debug regular expressions in real-time."
        categoryId="dev-automation"
      />

      <div className="flex flex-col gap-8">
        
        {/* Top: Regex Input Console */}
        <GlassCard className="p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-accent">
              <Code2 className="size-4" /> Pattern Engine
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                className="toolsy-input bg-black/40 border-white/5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg appearance-none h-auto cursor-pointer"
                onChange={(e) => {
                  const preset = PRESETS.find(p => p.label === e.target.value);
                  if (preset) {
                    setPattern(preset.pattern);
                    setFlags(preset.flags);
                  }
                }}
              >
                <option value="">Presets...</option>
                {PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-muted/40">/</div>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="Enter regular expression..."
              className={`toolsy-input w-full bg-black/40 border-2 font-mono text-lg pl-10 pr-24 py-5 shadow-inner transition-all
                ${!engineResult.isValid ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/5 focus:border-accent/40'}`}
              spellCheck={false}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xl font-black text-muted/40">
              / <span className="text-accent text-sm ml-1 bg-accent/10 px-2 py-0.5 rounded">{flags}</span>
            </div>
          </div>

          {!engineResult.isValid && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 text-red-400 text-[11px] font-bold bg-red-500/10 border border-red-500/20 p-3 rounded-xl"
            >
              <AlertTriangle className="size-4" />
              {engineResult.error}
            </motion.div>
          )}

          {/* Flags Toggles */}
          <div className="flex flex-wrap gap-2">
            {[
              { f: 'g', label: 'Global' },
              { f: 'i', label: 'Case Insensitive' },
              { f: 'm', label: 'Multiline' },
              { f: 's', label: 'DotAll' },
              { f: 'u', label: 'Unicode' },
              { f: 'y', label: 'Sticky' },
            ].map(({f, label}) => (
              <button
                key={f}
                onClick={() => toggleFlag(f)}
                className={`px-3 py-1.5 rounded-lg border font-mono text-[10px] uppercase tracking-wider transition-all flex items-center gap-2
                  ${flags.includes(f) 
                    ? "bg-accent/20 border-accent/40 text-accent" 
                    : "bg-white/[0.02] border-white/5 text-muted hover:bg-white/[0.05] hover:border-white/10"}`}
              >
                <span className="opacity-50">{f}</span> {label}
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Middle: Test Input */}
        <div className="flex flex-col gap-8">
          
          {/* Input Area */}
          <GlassCard className="flex flex-col gap-6 p-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted">
                <Database className="size-4 text-emerald-400" /> Test Data
              </div>
            </div>
            
            <textarea
              value={testString}
              onChange={(e) => setTestString(e.target.value)}
              className="flex-1 w-full min-h-[300px] bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-sm text-foreground/80 resize-none focus:outline-none focus:border-accent/40 transition-colors custom-scrollbar leading-relaxed"
              placeholder="Paste test data here..."
              spellCheck={false}
            />

            {outputMode === "replace" && (
              <div className="flex flex-col gap-2 mt-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-amber-400/60">Replacement String</label>
                <input
                  type="text"
                  value={replaceString}
                  onChange={(e) => setReplaceString(e.target.value)}
                  placeholder="e.g. $1-$2"
                  className="toolsy-input w-full bg-black/40 border-amber-500/20 focus:border-amber-500/50 font-mono text-sm"
                />
              </div>
            )}
          </GlassCard>

          {/* Output / Analysis Panel */}
          <GlassCard className="flex flex-col gap-6 p-8 min-h-[500px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 gap-4">
              <div className="flex flex-wrap items-center gap-2 p-1 rounded-xl bg-white/[0.02] border border-white/5 w-max">
                <button 
                  onClick={() => setOutputMode("highlight")}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${outputMode === "highlight" ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground/80"}`}
                >
                  Highlight View
                </button>
                <button 
                  onClick={() => setOutputMode("extracted")}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${outputMode === "extracted" ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground/80"}`}
                >
                  Extracted Matches
                </button>
                <button 
                  onClick={() => setOutputMode("groups")}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${outputMode === "groups" ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground/80"}`}
                >
                  Capture Groups
                </button>
                <button 
                  onClick={() => setOutputMode("replace")}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${outputMode === "replace" ? "bg-amber-500/10 text-amber-400" : "text-muted hover:text-amber-400/80"}`}
                >
                  <ArrowRightLeft className="size-3" /> Replace Preview
                </button>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted/40 bg-white/5 px-2 py-1 rounded flex items-center gap-2">
                  {isProcessing ? (
                    <Loader2 className="size-3 text-accent animate-spin" />
                  ) : (
                    <PlayCircle className="size-3 text-blue-400" />
                  )}
                  {isProcessing ? "Processing..." : `${engineResult.executionTime.toFixed(2)}ms`}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted/40 bg-white/5 px-2 py-1 rounded">
                  {engineResult.matches.length} Matches
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-6 flex-1 overflow-hidden">
              {outputMode === "highlight" && (
                <div className="flex-1 bg-black/40 border border-white/5 rounded-xl p-4 overflow-y-auto custom-scrollbar">
                  <pre className="font-mono text-sm text-foreground/60 whitespace-pre-wrap word-break leading-relaxed">
                    {renderHighlightedText()}
                  </pre>
                </div>
              )}
              
              {outputMode === "extracted" && (
                <div className="flex flex-col gap-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {engineResult.matches.length > 0 ? (
                    engineResult.matches.map((m, i) => (
                      <div key={i} className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5 font-mono text-sm text-foreground/80 hover:border-white/10 transition-colors">
                        <span className="text-[8px] font-black text-muted/40 uppercase tracking-widest">Match {i + 1} • Index {m.index}</span>
                        {m.match}
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center flex flex-col items-center gap-3 opacity-50">
                      <ListTree className="size-8 text-muted" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted">No matches found</span>
                    </div>
                  )}
                </div>
              )}

              {outputMode === "groups" && (
                <div className="flex flex-col gap-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {engineResult.matches.length > 0 && engineResult.matches.some(m => m.groups.length > 0) ? (
                    engineResult.matches.map((m, i) => (
                      m.groups.length > 0 && (
                        <div key={i} className="flex flex-col gap-3 p-4 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted/40">Match {i + 1} Groups</span>
                          <div className="flex flex-col gap-2">
                            {m.groups.map((g, gi) => (
                              <div key={gi} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/5 font-mono text-[11px]">
                                <span className="text-accent opacity-50 w-16">Group {gi + 1}</span>
                                <span className="text-foreground">{g}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))
                  ) : (
                    <div className="py-20 text-center flex flex-col items-center gap-3 opacity-50">
                      <ListTree className="size-8 text-muted" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted">No capture groups found in pattern</span>
                    </div>
                  )}
                </div>
              )}

              {outputMode === "replace" && (
                <div className="flex-1 bg-black/40 border border-amber-500/20 rounded-xl p-4 overflow-y-auto custom-scrollbar">
                  <pre className="font-mono text-sm text-foreground/80 whitespace-pre-wrap word-break leading-relaxed">
                    {engineResult.replacedText || "No output."}
                  </pre>
                </div>
              )}
            </div>
          </GlassCard>

        </div>

        {/* Cinematic Documentation Section */}
        <section className="mt-8 pt-12 border-t border-white/5 flex flex-col gap-12">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-foreground">Regex Development Manual</h3>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Understanding Patterns & Optimization</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard className="flex flex-col gap-5 p-6 bg-purple-500/[0.02] border-purple-500/10 hover:border-purple-500/30 transition-colors">
              <div className="flex items-center gap-3 text-purple-400">
                <Code2 className="size-5" />
                <h4 className="text-[11px] font-black uppercase tracking-wider">Pattern Execution</h4>
              </div>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                Regex Studio parses your expression in real-time against the target payload. It supports multiline logs, deep JSON structures, and standard strings. Enable the `g` (global) flag to capture all instances instead of just the first match.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col gap-5 p-6 bg-blue-500/[0.02] border-blue-500/10 hover:border-blue-500/30 transition-colors">
              <div className="flex items-center gap-3 text-blue-400">
                <ListTree className="size-5" />
                <h4 className="text-[11px] font-black uppercase tracking-wider">Capture Groups</h4>
              </div>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                Wrap parts of your pattern in parentheses `( )` to extract specific sub-strings. These are crucial for extracting IP addresses from larger log lines or separating domains from URLs. Use `(?: )` for non-capturing groups to improve performance.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col gap-5 p-6 bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/30 transition-colors">
              <div className="flex items-center gap-3 text-emerald-400">
                <ArrowRightLeft className="size-5" />
                <h4 className="text-[11px] font-black uppercase tracking-wider">Transformations</h4>
              </div>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                Switch to Replace Mode to instantly format data. You can reference your capture groups using `$1`, `$2`, etc. This is incredibly powerful for converting messy CSV data into JSON arrays or normalizing log timestamps across huge files.
              </p>
            </GlassCard>
          </div>
        </section>
      </div>
    </ToolContainer>
  );
}
