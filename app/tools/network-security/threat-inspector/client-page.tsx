"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ToolContainer,
  ToolHeader,
  ToolButton,
} from "@/components/tools";
import { 
  Shield, 
  Upload, 
  Zap, 
  Activity, 
  Globe, 
  Database, 
  Lock, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Fingerprint,
  Layers,
  Terminal,
  FileSearch,
  Crosshair,
  CloudUpload,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/ui/GlassCard";
import { calculateEntropy, extractIOCs, extractPrintableStrings } from "@/lib/threat-analysis";

/* ─────────────────────────────────────────────
   Types & Interfaces
  ───────────────────────────────────────────── */
interface LocalAnalysis {
  md5: string;
  sha1: string;
  sha256: string;
  size: number;
  mimeType: string;
  entropy: number;
  iocs: {
    ips: string[];
    domains: string[];
    urls: string[];
  };
  strings: string[];
}

interface VTData {
  last_analysis_stats: {
    malicious: number;
    suspicious: number;
    undetected: number;
    harmless: number;
    timeout: number;
  };
  reputation: number;
  tags: string[];
  meaningful_name?: string;
  type_description: string;
}

/* ─────────────────────────────────────────────
   Analyst Dashboard Component
  ───────────────────────────────────────────── */
export default function ThreatInspectorClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localAnalysis, setLocalAnalysis] = useState<LocalAnalysis | null>(null);
  const [vtData, setVtData] = useState<VTData | null>(null);
  const [vtStatus, setVtStatus] = useState<"not_configured" | "not_found" | "found" | "error" | "polling" | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const performAnalysis = useCallback(async (selectedFile: File) => {
    setIsAnalyzing(true);
    setVtData(null);
    setVtStatus(null);
    setFile(selectedFile);

    try {
      const buffer = await selectedFile.arrayBuffer();
      
      // Hashing (SHA256 is the gold standard)
      const sha256Buffer = await crypto.subtle.digest("SHA-256", buffer);
      const sha256 = Array.from(new Uint8Array(sha256Buffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      // Entropy & IOCs
      const entropy = calculateEntropy(buffer);
      const textDecoder = new TextDecoder();
      const text = textDecoder.decode(buffer.slice(0, 50000)); // Sample first 50KB for strings
      const iocs = extractIOCs(text);
      
      // Filter strings (very basic heuristic)
      const strings = extractPrintableStrings(text);

      setLocalAnalysis({
        sha256,
        sha1: "...", 
        md5: "...",  
        size: selectedFile.size,
        mimeType: selectedFile.type || "application/octet-stream",
        entropy,
        iocs,
        strings
      });

      // VirusTotal Integration - Hash Lookup
      const vtResponse = await fetch(`/api/threat/hash/${sha256}`);
      if (vtResponse.ok) {
        const result = await vtResponse.json();
        if (result.configured === false) {
          setVtStatus("not_configured");
        } else if (result.found) {
          setVtData(result.data.attributes);
          setVtStatus("found");
        } else {
          setVtStatus("not_found");
        }
      } else {
        setVtStatus("error");
      }
    } catch {
      // Forensic analysis failed
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/threat/upload", {
        method: "POST",
        body: formData,
      });
      
      if (response.ok) {
        setVtStatus("polling");
        // In a real app, we'd poll /api/threat/report/[id] here
        // For this version, we'll notify that the upload was successful
      }
    } catch {
      setVtStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      performAnalysis(e.dataTransfer.files[0]);
    }
  };

  const threatVerdict = useMemo(() => {
    if (!vtData) return { label: "Unknown", color: "text-muted", bg: "bg-muted/10", icon: InfoIcon };
    const malicious = vtData.last_analysis_stats.malicious;
    if (malicious > 10) return { label: "MALICIOUS", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle };
    if (malicious > 0) return { label: "SUSPICIOUS", color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle };
    return { label: "CLEAN", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 };
  }, [vtData]);

  return (
    <ToolContainer categoryId="network-security">
      <ToolHeader
        title="Threat Inspector"
        description="Local-first malware investigation and file reputation engine."
        categoryId="network-security"
      />

      <div className="flex flex-col gap-10">
        
        {/* Cinematic Dropzone */}
        {!file || isAnalyzing ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative group h-[400px] flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed transition-all duration-700
              ${dragActive ? "border-accent bg-accent/5 scale-[0.99]" : "border-white/5 bg-black/20 hover:border-white/10"}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[32px]">
              <div className="absolute -top-1/2 -left-1/2 size-full bg-[radial-gradient(circle_at_center,rgba(var(--accent-rgb),0.03),transparent_50%)] animate-pulse" />
            </div>

            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="size-20 rounded-full border border-accent/20 border-t-accent"
                  />
                  <Shield className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-8 text-accent animate-pulse" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-sm font-black uppercase tracking-[0.3em] text-accent">Performing Local Triage</span>
                  <span className="text-[10px] font-bold text-muted/60 uppercase tracking-widest">Calculating Hashes & Extracting IOCs...</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-8">
                <div className="size-20 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform duration-500">
                  <Upload className="size-8 text-muted group-hover:text-accent transition-colors" />
                </div>
                <div className="flex flex-col items-center text-center gap-3">
                  <h3 className="text-xl font-black tracking-tight text-foreground">Initiate Investigation</h3>
                  <p className="text-sm text-muted/60 font-medium max-w-sm">
                    Drag and drop any binary, document, or script for forensic inspection. 
                    <span className="block mt-2 text-[10px] uppercase font-black tracking-widest text-emerald-500/60">Analysis is performed locally first.</span>
                  </p>
                </div>
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  onChange={(e) => e.target.files?.[0] && performAnalysis(e.target.files[0])} 
                />
                <ToolButton variant="secondary" onClick={() => document.getElementById("file-upload")?.click()}>
                  Browse Files
                </ToolButton>
              </div>
            )}
          </motion.div>
        ) : null}

        {/* Results Interface */}
        <AnimatePresence>
          {file && !isAnalyzing && localAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-8"
            >
              
              {/* Top Banner - Verdict & Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* File Identity */}
                <GlassCard className="lg:col-span-8 flex flex-col gap-8 p-10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-6">
                      <div className="size-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                        <FileSearch className="size-8 text-accent" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <h2 className="text-2xl font-black tracking-tight text-foreground truncate max-w-md">
                          {file.name}
                        </h2>
                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted/60">
                          <span className="flex items-center gap-1.5"><Database className="size-3" /> {(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span className="flex items-center gap-1.5"><Layers className="size-3" /> {localAnalysis.mimeType}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={`px-6 py-4 rounded-2xl ${threatVerdict.bg} border border-white/5 flex flex-col items-end gap-1`}>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted/40">Global Verdict</span>
                      <div className={`flex items-center gap-3 text-xl font-black tracking-tighter ${threatVerdict.color}`}>
                        {threatVerdict.icon && <threatVerdict.icon className="size-6" />}
                        {threatVerdict.label}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/5">
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted/40 flex items-center gap-2">
                        <Fingerprint className="size-3" /> SHA-256 Signature
                      </span>
                      <div className="toolsy-input bg-black/40 border-white/5 font-mono text-[10px] p-4 select-all">
                        {localAnalysis.sha256}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted/40 flex items-center gap-2">
                        <Zap className="size-3" /> Entropy Score
                      </span>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(localAnalysis.entropy / 8) * 100}%` }}
                            className={`h-full ${localAnalysis.entropy > 7 ? "bg-red-400" : "bg-accent"}`}
                          />
                        </div>
                        <span className="text-xs font-bold text-foreground">{localAnalysis.entropy.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Engine Breakdown */}
                <GlassCard className="lg:col-span-4 flex flex-col gap-8 p-10 bg-accent/5 border-accent/10">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent">
                    <Crosshair className="size-4" /> Detection Statistics
                  </div>
                  
                  {vtData ? (
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col items-center justify-center py-6 bg-black/40 rounded-3xl border border-white/5">
                        <span className="text-4xl font-black text-foreground">{vtData.last_analysis_stats.malicious}</span>
                        <span className="text-[10px] font-black text-muted/60 uppercase tracking-[0.2em] mt-1">Detections</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                          <span className="text-[8px] font-black uppercase tracking-widest text-red-400/60">Malicious</span>
                          <span className="text-lg font-black text-red-400">{vtData.last_analysis_stats.malicious}</span>
                        </div>
                        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                          <span className="text-[8px] font-black uppercase tracking-widest text-amber-400/60">Suspicious</span>
                          <span className="text-lg font-black text-amber-400">{vtData.last_analysis_stats.suspicious}</span>
                        </div>
                        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400/60">Harmless</span>
                          <span className="text-lg font-black text-emerald-400">{vtData.last_analysis_stats.harmless}</span>
                        </div>
                        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                          <span className="text-[8px] font-black uppercase tracking-widest text-blue-400/60">Total</span>
                          <span className="text-lg font-black text-blue-400">
                            {vtData.last_analysis_stats.malicious + vtData.last_analysis_stats.harmless + vtData.last_analysis_stats.undetected}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                      <div className="size-12 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                        {vtStatus === "not_found" ? <CloudUpload className="size-5 text-accent" /> : <Lock className="size-5 text-muted/40" />}
                      </div>
                      <div className="flex flex-col gap-4 items-center">
                        <p className="text-[10px] font-bold text-muted/40 uppercase tracking-widest leading-relaxed">
                          {vtStatus === "not_found" 
                            ? "Hash not found in global database." 
                            : vtStatus === "not_configured"
                            ? "VirusTotal reputation lookup is not configured."
                            : vtStatus === "error" 
                            ? "VirusTotal API connection failed."
                            : vtStatus === "polling"
                            ? "Analysis submitted. Check back shortly."
                            : "Global reputation unavailable."}
                        </p>
                        
                        {vtStatus === "not_found" && (
                          <ToolButton 
                            variant="primary" 
                            size="sm" 
                            onClick={handleUpload}
                            disabled={isUploading}
                          >
                            {isUploading ? (
                              <RefreshCw className="size-4 animate-spin mr-2" />
                            ) : (
                              <CloudUpload className="size-4 mr-2" />
                            )}
                            {isUploading ? "Uploading..." : "Request Cloud Analysis"}
                          </ToolButton>
                        )}
                      </div>
                    </div>
                  )}
                </GlassCard>
              </div>

              {/* Artifacts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                
                {/* Network Artifacts (IOCs) */}
                <GlassCard className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted">
                      <Globe className="size-4 text-blue-400" />
                      Network IOCs
                    </div>
                    <span className="text-[9px] font-black text-muted/40">{localAnalysis.iocs.ips.length + localAnalysis.iocs.domains.length} Detected</span>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    {localAnalysis.iocs.ips.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted/40">IP Addresses</span>
                        <div className="flex flex-col gap-1.5">
                          {localAnalysis.iocs.ips.map(ip => (
                            <div key={ip} className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5 group/ioc">
                              <span className="font-mono text-[10px] text-foreground/80">{ip}</span>
                              <ChevronRight className="size-3 text-muted/20 group-hover/ioc:text-accent group-hover/ioc:translate-x-0.5 transition-all" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-10 text-center border border-dashed border-white/5 rounded-2xl">
                        <span className="text-[10px] font-bold text-muted/30 uppercase tracking-widest">No IP signals</span>
                      </div>
                    )}
                  </div>
                </GlassCard>

                {/* Behavioral Strings */}
                <GlassCard className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted">
                      <Terminal className="size-4 text-emerald-400" />
                      Extracted Strings
                    </div>
                    <span className="text-[9px] font-black text-muted/40">Top 20</span>
                  </div>
                  <div className="flex flex-col gap-1.5 h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {localAnalysis.strings.map((str, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-black/40 border border-white/5 font-mono text-[10px] text-foreground/60 hover:text-foreground hover:bg-black/60 transition-colors">
                        {str}
                      </div>
                    ))}
                    {localAnalysis.strings.length === 0 && (
                      <div className="flex-1 flex items-center justify-center py-20 opacity-30 italic text-[10px]">No printable strings found</div>
                    )}
                  </div>
                </GlassCard>

                {/* Security Flags */}
                <GlassCard className="flex flex-col gap-6">
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted">
                    <Activity className="size-4 text-purple-400" />
                    Heuristic Indicators
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-foreground uppercase tracking-wider">High Entropy</span>
                        <span className="text-[9px] font-bold text-muted uppercase">Potential Packing/Encryption</span>
                      </div>
                      {localAnalysis.entropy > 7.2 ? <AlertTriangle className="size-5 text-amber-500" /> : <CheckCircle2 className="size-5 text-emerald-500/40" />}
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-foreground uppercase tracking-wider">Network Calls</span>
                        <span className="text-[9px] font-bold text-muted uppercase">Outbound Connection Strings</span>
                      </div>
                      {localAnalysis.iocs.urls.length > 0 ? <AlertTriangle className="size-5 text-amber-500" /> : <CheckCircle2 className="size-5 text-emerald-500/40" />}
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-foreground uppercase tracking-wider">Reputation</span>
                        <span className="text-[9px] font-bold text-muted uppercase">Global Engine Status</span>
                      </div>
                      {vtData?.last_analysis_stats.malicious ? <XCircle className="size-5 text-red-400" /> : <CheckCircle2 className="size-5 text-emerald-500/40" />}
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-4">
                    <ToolButton variant="secondary" size="sm" onClick={() => { setFile(null); setLocalAnalysis(null); }}>
                      New Investigation
                    </ToolButton>
                  </div>
                </GlassCard>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Tactical Footer */}
        <section className="mt-8 pt-12 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-12 select-text">
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-foreground">Forensic Protocol</h3>
            <p className="text-xs text-muted/60 leading-relaxed font-medium">
              Threat Inspector implements a multi-stage triage process. First, file entropy and internal strings are analyzed in the browser. Second, the SHA-256 hash is queried against global threat databases to determine historical reputation.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-foreground">Privacy Standards</h3>
            <p className="text-xs text-muted/60 leading-relaxed font-medium">
              Full file content never leaves your browser for initial triage. Only cryptographic hashes (SHA-256) are transmitted for global lookups. Your investigation remains confidential and secure.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-foreground">Capabilities</h3>
            <ul className="flex flex-col gap-2.5">
              <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted/80">
                <div className="size-1 rounded-full bg-accent" />
                Binary Triage
              </li>
              <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted/80">
                <div className="size-1 rounded-full bg-accent" />
                IOC Extraction (IP/URL/Domain)
              </li>
              <li className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted/80">
                <div className="size-1 rounded-full bg-accent" />
                Malware Reputation Check
              </li>
            </ul>
          </div>
        </section>
      </div>
    </ToolContainer>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
