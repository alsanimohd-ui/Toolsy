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
import { calculateEntropy, extractIOCs, extractPrintableStrings, detectMimeTypeFromMagic } from "@/lib/threat-analysis";

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
    emails: string[];
    hashes: string[];
    suspiciousCommands: string[];
  };
  strings: string[];
  magicDesc: string;
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
      
      // Full Cryptographic Hashing
      const hashBuffer = async (algo: string) => {
        const b = await crypto.subtle.digest(algo, buffer);
        return Array.from(new Uint8Array(b))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");
      };

      const sha256 = await hashBuffer("SHA-256");
      const sha1 = await hashBuffer("SHA-1");
      const md5 = await hashBuffer("MD5");

      // Entropy & IOCs
      const entropy = calculateEntropy(buffer);
      const textDecoder = new TextDecoder();
      const text = textDecoder.decode(buffer.slice(0, 100000)); // Sample 100KB
      const iocs = extractIOCs(text);
      const strings = extractPrintableStrings(text).slice(0, 50);

      const magic = detectMimeTypeFromMagic(buffer);

      setLocalAnalysis({
        sha256,
        sha1,
        md5,
        size: selectedFile.size,
        mimeType: magic.mime || selectedFile.type || "application/octet-stream",
        entropy,
        iocs,
        strings,
        magicDesc: magic.desc,
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
    } catch (e) {
      console.error("Forensic analysis failed:", e);
      setVtStatus("error");
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
        // Integration note: Polling logic would go here
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
    if (!vtData) return { label: "PENDING", color: "text-muted", bg: "bg-muted/10", icon: InfoIcon };
    const malicious = vtData.last_analysis_stats.malicious;
    const suspicious = vtData.last_analysis_stats.suspicious;
    
    if (malicious > 5) return { label: "MALICIOUS", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle };
    if (malicious > 0 || suspicious > 2) return { label: "SUSPICIOUS", color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle };
    return { label: "CLEAN", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 };
  }, [vtData]);

  return (
    <ToolContainer categoryId="network-security">
      <ToolHeader
        title="Threat Inspector"
        description="Local-first malware triage and global reputation engine. Perform deep forensic analysis on suspicious artifacts without data exposure."
        categoryId="network-security"
      />

      <div className="flex flex-col gap-6">
        
        {/* Cinematic Dropzone */}
        {!file || isAnalyzing ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative group h-[320px] flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed transition-all duration-700
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
                  <span className="text-sm font-black uppercase tracking-[0.3em] text-accent">Performing Triage</span>
                  <span className="text-[10px] font-bold text-muted/60 uppercase tracking-widest">Calculated SHA-256... Analyzing Entropy...</span>
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
                    <span className="block mt-2 text-[10px] uppercase font-black tracking-widest text-emerald-500/60">Local Analysis first. No content exposure.</span>
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
              className="flex flex-col gap-6"
            >
              
              {/* Top Banner - Verdict & Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* File Identity */}
                <GlassCard className="lg:col-span-8 flex flex-col gap-8 p-10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-6">
                      <div className="size-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                        <FileSearch className="size-8 text-accent" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <h2 className="text-2xl font-black tracking-tight text-foreground truncate max-w-md">
                          {vtData?.meaningful_name || file.name}
                        </h2>
                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted/60">
                          <span className="flex items-center gap-1.5"><Database className="size-3" /> {(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span className="flex items-center gap-1.5"><Layers className="size-3" /> {localAnalysis.magicDesc || vtData?.type_description || localAnalysis.mimeType}</span>
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
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted/40 flex items-center gap-2">
                          <Fingerprint className="size-3" /> SHA-256
                        </span>
                        <div className="toolsy-input bg-black/40 border-white/5 font-mono text-[9px] p-3 select-all truncate">
                          {localAnalysis.sha256}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 opacity-50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted/40">MD5 Hash</span>
                        <div className="toolsy-input bg-black/40 border-white/5 font-mono text-[9px] p-3 select-all">
                          {localAnalysis.md5}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted/40 flex items-center gap-2">
                        <Zap className="size-3" /> Entropy Analysis
                      </span>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(localAnalysis.entropy / 8) * 100}%` }}
                              className={`h-full ${localAnalysis.entropy > 7.2 ? "bg-red-400" : localAnalysis.entropy > 6.5 ? "bg-amber-400" : "bg-emerald-400"}`}
                            />
                          </div>
                          <span className="text-xs font-bold text-foreground">{localAnalysis.entropy.toFixed(3)}</span>
                        </div>
                        <p className="text-[9px] font-bold text-muted/40 uppercase leading-relaxed">
                          {localAnalysis.entropy > 7.2 
                            ? "CRITICAL: High entropy detected. Artifact likely packed or encrypted." 
                            : "NORMAL: Standard code/data distribution detected."}
                        </p>
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
                      <div className="flex flex-col items-center justify-center py-6 bg-black/40 rounded-3xl border border-white/5 shadow-2xl">
                        <span className="text-4xl font-black text-foreground">{vtData.last_analysis_stats.malicious}</span>
                        <span className="text-[10px] font-black text-muted/60 uppercase tracking-[0.2em] mt-1">Malicious Verdicts</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <StatItem label="Malicious" count={vtData.last_analysis_stats.malicious} color="text-red-400" bg="bg-red-500/5" border="border-red-500/10" />
                        <StatItem label="Suspicious" count={vtData.last_analysis_stats.suspicious} color="text-amber-400" bg="bg-amber-500/5" border="border-amber-500/10" />
                        <StatItem label="Undetected" count={vtData.last_analysis_stats.undetected} color="text-muted" bg="bg-white/5" border="border-white/5" />
                        <StatItem label="Harmless" count={vtData.last_analysis_stats.harmless} color="text-emerald-400" bg="bg-emerald-500/5" border="border-emerald-500/10" />
                      </div>

                      {vtData.tags && vtData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-4 border-t border-white/5">
                          {vtData.tags.slice(0, 5).map(tag => (
                            <span key={tag} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[8px] font-black uppercase tracking-widest text-muted/60">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                      <div className="size-12 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                        {vtStatus === "not_found" ? <CloudUpload className="size-5 text-accent" /> : <Lock className="size-5 text-muted/40" />}
                      </div>
                      <div className="flex flex-col gap-4 items-center px-4">
                        <p className="text-[10px] font-bold text-muted/40 uppercase tracking-widest leading-relaxed">
                          {vtStatus === "not_found" 
                            ? "Hash not found in global database. File may be a new or unique artifact." 
                            : vtStatus === "not_configured"
                            ? "VirusTotal API Key missing. Reputation lookup disabled."
                            : vtStatus === "error" 
                            ? "Forensic link to global database failed."
                            : vtStatus === "polling"
                            ? "Artifact uploaded. Analysis in progress."
                            : "Reputation check pending local triage."}
                        </p>
                        
                        {vtStatus === "not_found" && (
                          <ToolButton 
                            variant="primary" 
                            size="sm" 
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="w-full"
                          >
                            {isUploading ? (
                              <RefreshCw className="size-3 animate-spin mr-2" />
                            ) : (
                              <CloudUpload className="size-3 mr-2" />
                            )}
                            {isUploading ? "Uploading..." : "Request Global Scan"}
                          </ToolButton>
                        )}
                      </div>
                    </div>
                  )}
                </GlassCard>
              </div>

              {/* Artifacts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                
                {/* Network Artifacts (IOCs) */}
                <GlassCard className="flex flex-col gap-6 lg:col-span-1">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted">
                      <Globe className="size-4 text-blue-400" />
                      Network Indicators
                    </div>
                    <span className="text-[9px] font-black text-muted/40">{localAnalysis.iocs.ips.length + localAnalysis.iocs.domains.length + localAnalysis.iocs.urls.length + localAnalysis.iocs.emails.length} Extraction(s)</span>
                  </div>
                  
                  <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {localAnalysis.iocs.ips.length > 0 || localAnalysis.iocs.domains.length > 0 || localAnalysis.iocs.urls.length > 0 || localAnalysis.iocs.emails.length > 0 ? (
                      <>
                        {localAnalysis.iocs.ips.map(ip => (
                          <div key={ip} className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 group/ioc hover:border-accent/20 transition-all">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-black text-muted/40 uppercase">IP Node</span>
                              <span className="font-mono text-[10px] text-foreground/80 break-all">{ip}</span>
                            </div>
                          </div>
                        ))}
                        {localAnalysis.iocs.domains.map(domain => (
                          <div key={domain} className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 group/ioc hover:border-accent/20 transition-all">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-black text-muted/40 uppercase">Domain Host</span>
                              <span className="font-mono text-[10px] text-foreground/80 break-all">{domain}</span>
                            </div>
                          </div>
                        ))}
                        {localAnalysis.iocs.urls.map(url => (
                          <div key={url} className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 group/ioc hover:border-accent/20 transition-all">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-black text-muted/40 uppercase">Extracted URL</span>
                              <span className="font-mono text-[10px] text-foreground/80 break-all">{url}</span>
                            </div>
                          </div>
                        ))}
                        {localAnalysis.iocs.emails.map(email => (
                          <div key={email} className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 group/ioc hover:border-accent/20 transition-all">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-black text-muted/40 uppercase">Email Address</span>
                              <span className="font-mono text-[10px] text-foreground/80 break-all">{email}</span>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="py-20 text-center border border-dashed border-white/5 rounded-[32px] flex flex-col items-center gap-3">
                        <Activity className="size-6 text-muted/10" />
                        <span className="text-[9px] font-black text-muted/30 uppercase tracking-[0.2em]">No Network Artifacts</span>
                      </div>
                    )}
                  </div>
                </GlassCard>

                {/* MITRE & Suspicious Commands */}
                <GlassCard className="flex flex-col gap-6 lg:col-span-1">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted">
                      <Terminal className="size-4 text-red-400" />
                      Suspicious Activity
                    </div>
                    <span className="text-[9px] font-black text-muted/40">{localAnalysis.iocs.suspiciousCommands.length} Found</span>
                  </div>
                  
                  <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {localAnalysis.iocs.suspiciousCommands.length > 0 ? (
                      localAnalysis.iocs.suspiciousCommands.map(cmd => (
                        <div key={cmd} className="flex flex-col gap-2 p-3 rounded-xl bg-black/40 border border-white/5 group/ioc hover:border-red-500/20 transition-all">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] text-red-400 font-bold">{cmd}</span>
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold uppercase tracking-wider">MITRE Hint</span>
                          </div>
                          <p className="text-[9px] text-muted/60 leading-relaxed">
                            {cmd.includes("powershell") || cmd.includes("iex") ? "T1059.001 - PowerShell Execution" : 
                             cmd.includes("base64") ? "T1140 - Deobfuscate/Decode Files or Information" :
                             cmd.includes("wscript") ? "T1059.005 - Visual Basic" :
                             "Suspicious execution artifact detected."}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center border border-dashed border-white/5 rounded-[32px] flex flex-col items-center gap-3">
                        <Shield className="size-6 text-emerald-400/20" />
                        <span className="text-[9px] font-black text-muted/30 uppercase tracking-[0.2em]">No Suspicious Commands</span>
                      </div>
                    )}
                  </div>
                </GlassCard>

                {/* Embedded Hashes */}
                <GlassCard className="flex flex-col gap-6 lg:col-span-1">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted">
                      <Fingerprint className="size-4 text-purple-400" />
                      Embedded Hashes
                    </div>
                    <span className="text-[9px] font-black text-muted/40">{localAnalysis.iocs.hashes.length} Found</span>
                  </div>
                  
                  <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {localAnalysis.iocs.hashes.length > 0 ? (
                      localAnalysis.iocs.hashes.map(hash => (
                        <div key={hash} className="flex flex-col gap-0.5 p-3 rounded-xl bg-black/40 border border-white/5 group/ioc hover:border-purple-500/20 transition-all">
                          <span className="text-[8px] font-black text-muted/40 uppercase">Hash Artifact</span>
                          <span className="font-mono text-[10px] text-foreground/80 break-all">{hash}</span>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center border border-dashed border-white/5 rounded-[32px] flex flex-col items-center gap-3">
                        <Lock className="size-6 text-purple-400/20" />
                        <span className="text-[9px] font-black text-muted/30 uppercase tracking-[0.2em]">No Embedded Hashes</span>
                      </div>
                    )}
                  </div>
                </GlassCard>

                {/* Behavioral Strings */}
                <GlassCard className="flex flex-col gap-6 lg:col-span-2">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted">
                      <Terminal className="size-4 text-emerald-400" />
                      Memory Strings
                    </div>
                    <span className="text-[9px] font-black text-muted/40">Heuristic Sample</span>
                  </div>
                  <div className="flex flex-col gap-1.5 h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {localAnalysis.strings.length > 0 ? (
                      localAnalysis.strings.map((str, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-[10px] text-foreground/60 hover:text-foreground hover:bg-black/60 transition-colors">
                          {str.length > 100 ? str.substring(0, 100) + "..." : str}
                        </div>
                      ))
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4 border-2 border-dashed border-white/5 rounded-[32px]">
                        <Database className="size-10 text-muted/10" />
                        <span className="text-[10px] font-black text-muted/30 uppercase tracking-[0.2em]">No Printable Sequences</span>
                        <span className="text-[8px] font-bold text-muted/20 uppercase tracking-widest">Strings extracted from binary data will appear here</span>
                      </div>
                    )}
                  </div>
                </GlassCard>

                {/* Security Flags */}
                <GlassCard className="flex flex-col gap-6 lg:col-span-1">
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted border-b border-white/5 pb-4">
                    <Activity className="size-4 text-purple-400" />
                    Forensic Indicators
                  </div>
                  <div className="flex flex-col gap-3">
                    <IndicatorItem 
                      title="Encryption Entropy" 
                      subtitle="Packing or obfuscation detection" 
                      active={localAnalysis.entropy > 7.1} 
                    />
                    <IndicatorItem 
                      title="Outbound Calls" 
                      subtitle="Presence of Network artifacts" 
                      active={localAnalysis.iocs.ips.length > 0 || localAnalysis.iocs.domains.length > 0 || localAnalysis.iocs.urls.length > 0} 
                    />
                    <IndicatorItem 
                      title="Reputation Link" 
                      subtitle="Global malware database match" 
                      active={!!(vtData && vtData.last_analysis_stats.malicious > 0)} 
                    />
                    <IndicatorItem 
                      title="Suspicious Activity" 
                      subtitle="Known malicious commands/API calls" 
                      active={localAnalysis.iocs.suspiciousCommands.length > 0} 
                    />
                  </div>
                </GlassCard>
              </div>

              {/* Action Bar */}
              <div className="flex justify-end pt-4">
                <button 
                  onClick={() => { setFile(null); setLocalAnalysis(null); setVtData(null); }}
                  className="px-8 py-3.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                >
                  New Investigation
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Refined Documentation System */}
        <section className="mt-10 pt-8 border-t border-white/5 flex flex-col gap-8">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-foreground">Forensic Documentation</h3>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Malware Triage & Investigation Protocol</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassCard className="flex flex-col gap-6 p-8 bg-white/[0.01]">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
                  <Shield className="size-4 text-accent" />
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-wider">Triage Methodology</h4>
              </div>
              <div className="flex flex-col gap-4 text-[11px] font-medium text-muted/60 leading-relaxed">
                <p>
                  1. <span className="text-foreground">Local Static Analysis:</span> We calculate MD5, SHA-1, and SHA-256 hashes instantly. Our engine analyzes Shannon entropy to detect packed or encrypted malware samples.
                </p>
                <p>
                  2. <span className="text-foreground">IOC Extraction:</span> High-speed regex engines extract potential Indicators of Compromise (IPs, URLs, Domains) from binary strings without executing the code.
                </p>
                <p>
                  3. <span className="text-foreground">Global Reputation:</span> Your cryptographic hashes are queried against VirusTotal&apos;s 70+ security engines to provide a unified maliciousness verdict.
                </p>
              </div>
            </GlassCard>

            <GlassCard className="flex flex-col gap-6 p-8 bg-white/[0.01]">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <Lock className="size-4 text-emerald-400" />
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-wider">Privacy & OPSEC Protocol</h4>
              </div>
              <div className="flex flex-col gap-4 text-[11px] font-medium text-muted/60 leading-relaxed">
                <p>
                  <span className="text-foreground font-black">HASH-ONLY LOOKUP:</span> By default, only the file&apos;s SHA-256 hash is transmitted to external reputation databases. Your raw file content remains strictly within the browser sandbox.
                </p>
                <p>
                  <span className="text-foreground font-black">OPTIONAL UPLOAD:</span> Content is only uploaded if you explicitly request a &quot;Global Scan&quot; for an unknown artifact. This ensures maximum OPSEC during sensitive investigations.
                </p>
              </div>
            </GlassCard>
          </div>
        </section>
      </div>
    </ToolContainer>
  );
}

/* ─────────────────────────────────────────────
   Helper Components
  ───────────────────────────────────────────── */

function StatItem({ label, count, color, bg, border }: { label: string, count: number, color: string, bg: string, border: string }) {
  return (
    <div className={`flex flex-col gap-1 p-4 rounded-2xl ${bg} border ${border}`}>
      <span className={`text-[8px] font-black uppercase tracking-widest ${color} opacity-60`}>{label}</span>
      <span className={`text-lg font-black ${color}`}>{count}</span>
    </div>
  );
}

function IndicatorItem({ title, subtitle, active }: { title: string, subtitle: string, active: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-white/10 transition-all">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-black text-foreground uppercase tracking-wider">{title}</span>
        <span className="text-[9px] font-bold text-muted uppercase">{subtitle}</span>
      </div>
      {active ? (
        <AlertTriangle className="size-5 text-amber-500 animate-pulse" />
      ) : (
        <CheckCircle2 className="size-5 text-emerald-500/20" />
      )}
    </div>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
