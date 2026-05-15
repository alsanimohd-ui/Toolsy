"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ToolContainer, ToolHeader } from "@/components/tools";
import { 
  Send,
  Settings2,
  ListTree,
  Lock,
  Braces,
  Globe,
  Clock,
  HardDrive,
  AlertTriangle,
  Copy,
  CheckCircle2,
  ChevronDown,
  Trash2,
  Plus,
  ShieldAlert,
  FileType,
  FileCode,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/ui/GlassCard";

/* ─────────────────────────────────────────────
   Types & Interfaces
  ───────────────────────────────────────────── */

interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface ApiResponse {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: string;
  timing?: number;
  size?: number;
  error?: string;
}

type AuthType = "none" | "bearer" | "basic";
type BodyType = "none" | "json" | "form-data" | "raw";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

/* ─────────────────────────────────────────────
   Component
  ───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   Custom Method Selector (Cinematic Dropdown)
  ───────────────────────────────────────────── */
function MethodSelector({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (m: string) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const getMethodStyle = (m: string) => {
    switch(m) {
      case "GET": return "text-blue-400 bg-blue-500/5";
      case "POST": return "text-emerald-400 bg-emerald-500/5";
      case "PUT": return "text-amber-400 bg-amber-500/5";
      case "DELETE": return "text-red-400 bg-red-500/5";
      case "PATCH": return "text-purple-400 bg-purple-500/5";
      default: return "text-muted bg-white/5";
    }
  };

  return (
    <div className="relative min-w-[160px] z-[60]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-4 px-6 py-5 bg-black/60 border-y-2 border-l-2 border-r-0 border-white/5 rounded-l-2xl rounded-r-none font-black uppercase tracking-[0.2em] text-sm transition-all hover:bg-black/80 group ${isOpen ? "border-accent/40 bg-black/90" : ""}`}
      >
        <span className={getMethodStyle(value).split(' ')[0]}>{value}</span>
        <ChevronDown className={`size-4 text-muted/40 transition-transform duration-500 group-hover:text-muted ${isOpen ? "rotate-180 text-accent" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute left-0 top-full mt-2 w-full min-w-[180px] bg-black/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-50"
            >
              <div className="p-2 flex flex-col gap-1">
                {METHODS.map((m) => {
                  const isSelected = value === m;
                  const style = getMethodStyle(m);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        onChange(m);
                        setIsOpen(false);
                      }}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all group
                        ${isSelected ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-foreground"}`}
                    >
                      <span className={isSelected ? style.split(' ')[0] : "group-hover:text-foreground"}>{m}</span>
                      {isSelected && <div className="size-1.5 rounded-full bg-accent animate-pulse" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ApiRequestLabClient() {
  // 1. Request Basics
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/posts/1");
  const [isLoading, setIsLoading] = useState(false);
  
  // 2. Navigation State
  const [activeReqTab, setActiveReqTab] = useState("params");
  const [activeResTab, setActiveResTab] = useState("body");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);

  // 3. Request Configuration
  const [params, setParams] = useState<KeyValuePair[]>([{ id: "1", key: "", value: "", enabled: true }]);
  const [headers, setHeaders] = useState<KeyValuePair[]>([{ id: "1", key: "Accept", value: "*/*", enabled: true }]);
  const [authType, setAuthType] = useState<AuthType>("none");
  const [bearerToken, setBearerToken] = useState("");
  const [basicUser, setBasicUser] = useState("");
  const [basicPass, setBasicPass] = useState("");
  
  const [bodyType, setBodyType] = useState<BodyType>("none");
  const [reqBody, setReqBody] = useState("");
  const [formData, setFormData] = useState<KeyValuePair[]>([{ id: "1", key: "", value: "", enabled: true }]);
  
  // 4. Advanced Settings
  const [ignoreSsl, setIgnoreSsl] = useState(false);

  // 5. Response Data
  const [response, setResponse] = useState<ApiResponse | null>(null);

  /* ─────────────────────────────────────────────
     Handlers
    ───────────────────────────────────────────── */

  const addRow = (setter: React.Dispatch<React.SetStateAction<KeyValuePair[]>>) => {
    setter(prev => [...prev, { id: Math.random().toString(36).substring(7), key: "", value: "", enabled: true }]);
  };

  const updateRow = (setter: React.Dispatch<React.SetStateAction<KeyValuePair[]>>, id: string, field: keyof KeyValuePair, val: unknown) => {
    setter(prev => prev.map(row => row.id === id ? { ...row, [field]: val } as KeyValuePair : row));
  };

  const removeRow = (setter: React.Dispatch<React.SetStateAction<KeyValuePair[]>>, id: string) => {
    setter(prev => prev.filter(row => row.id !== id));
  };

  const handleCopy = () => {
    if (!response?.rawBody) return;
    navigator.clipboard.writeText(response.rawBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!url) return;
    setIsLoading(true);
    setResponse(null);

    try {
      const finalHeaders: Record<string, string> = {};
      headers.filter(h => h.enabled && h.key).forEach(h => {
        finalHeaders[h.key] = h.value;
      });

      // Auth Injection
      if (authType === "bearer" && bearerToken) {
        finalHeaders["Authorization"] = `Bearer ${bearerToken}`;
      } else if (authType === "basic" && basicUser && basicPass) {
        finalHeaders["Authorization"] = `Basic ${btoa(`${basicUser}:${basicPass}`)}`;
      }

      // Body Handling
      let finalBody: string | undefined = undefined;
      if (["POST", "PUT", "PATCH"].includes(method)) {
        if (bodyType === "json" || bodyType === "raw") {
          finalBody = reqBody;
          if (bodyType === "json" && !finalHeaders["Content-Type"]) {
            finalHeaders["Content-Type"] = "application/json";
          }
        } else if (bodyType === "form-data") {
          const fd = new URLSearchParams();
          formData.filter(f => f.enabled && f.key).forEach(f => fd.append(f.key, f.value));
          finalBody = fd.toString();
          if (!finalHeaders["Content-Type"]) {
            finalHeaders["Content-Type"] = "application/x-www-form-urlencoded";
          }
        }
      }

      let finalUrl = url;
      const activeParams = params.filter(p => p.enabled && p.key);
      if (activeParams.length > 0) {
        try {
          const urlObj = new URL(url);
          activeParams.forEach(p => urlObj.searchParams.append(p.key, p.value));
          finalUrl = urlObj.toString();
        } catch { 
          // Fallback if URL is partial
          const separator = url.includes('?') ? '&' : '?';
          const query = activeParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
          finalUrl = `${url}${separator}${query}`;
        }
      }

      const res = await fetch("/api/network/api-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: finalUrl,
          method,
          headers: finalHeaders,
          body: finalBody,
          ignoreSsl // Even if proxy doesn't support it yet, we pass it
        })
      });

      const data = await res.json();
      setResponse(data);
    } catch (err: unknown) {
      setResponse({ error: (err as Error).message || "Connection failed. Ensure the URL is reachable." });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: number | undefined) => {
    if (!status) return "text-muted";
    if (status < 300) return "text-emerald-400";
    if (status < 400) return "text-blue-400";
    if (status < 500) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <ToolContainer categoryId="dev-automation">
      <ToolHeader
        title="API Request Lab"
        description="High-fidelity HTTP Request Builder for advanced API engineering and debugging."
        categoryId="dev-automation"
      />

      <div className="flex flex-col gap-24 max-w-[96rem] mx-auto w-full pb-32">
        
        {/* STEP 1: TARGETING (URL & METHOD) */}
        <section className="flex flex-col gap-8 relative z-50">
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-accent/70 ml-2">
            <Globe className="size-4" /> 01. Configure Target
          </div>
          <GlassCard className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4 border-l-4 border-l-accent bg-accent/[0.02]">
            <div className="flex items-center gap-0 w-full">
              <MethodSelector value={method} onChange={setMethod} />
              <div className="relative flex-1">
                <input 
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://api.example.com/v1/resource"
                  className="toolsy-input w-full bg-black/40 border-2 border-white/5 rounded-r-2xl py-5 px-6 font-mono text-sm shadow-inner transition-all focus:border-accent/40 focus:bg-black/60"
                  spellCheck={false}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
              </div>
            </div>
            <button 
              onClick={handleSend}
              disabled={isLoading || !url}
              className="flex items-center justify-center gap-3 px-10 py-5 bg-accent text-accent-foreground rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:opacity-90 disabled:opacity-50 transition-all shrink-0 shadow-[0_0_30px_rgba(var(--accent-rgb),0.3)] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="size-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
              ) : (
                <span className="flex items-center gap-2"><Send className="size-4" /> Request</span>
              )}
            </button>
          </GlassCard>
        </section>

        {/* STEP 2 & 3: CONFIGURATION & INSPECTION */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* CONFIGURATION PANEL (LEFT) */}
          <div className="xl:col-span-6 flex flex-col gap-8 relative z-10">
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-muted/40 ml-2">
              <Settings2 className="size-4" /> 02. Configuration
            </div>
            <GlassCard className="flex flex-col overflow-hidden min-h-[620px] shadow-2xl">
              {/* Tabs */}
              <div className="flex items-center gap-2 p-4 bg-white/[0.03] border-b border-white/5 overflow-x-auto custom-scrollbar">
                {[
                  { id: "params", label: "Params", icon: ListTree },
                  { id: "auth", label: "Auth", icon: Lock },
                  { id: "headers", label: "Headers", icon: Globe },
                  { id: "body", label: "Body", icon: Braces },
                ].map(t => {
                  const Icon = t.icon;
                  const isActive = activeReqTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveReqTab(t.id)}
                      className={`flex items-center gap-3 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all whitespace-nowrap border
                        ${isActive 
                          ? "bg-accent/10 text-accent border-accent/20" 
                          : "text-muted/60 border-transparent hover:text-foreground/80 hover:bg-white/5"}`}
                    >
                      <Icon className={`size-3.5 ${isActive ? "text-accent" : "text-muted/40"}`} /> {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="p-8 flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-black/20">
                
                {/* KEY/VALUE EDITORS (Params, Headers, Form-Data) */}
                {(activeReqTab === "params" || activeReqTab === "headers" || (activeReqTab === "body" && bodyType === "form-data")) && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-[30px_1fr_1fr_30px] gap-4 mb-4 px-2">
                      <div className="w-[30px]"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted/40">Key</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted/40">Value</span>
                      <div className="w-[30px]"></div>
                    </div>
                    
                    {(activeReqTab === "params" ? params : activeReqTab === "headers" ? headers : formData).map((row) => (
                      <motion.div 
                        key={row.id} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="grid grid-cols-[30px_1fr_1fr_30px] gap-4 items-center group"
                      >
                        <input 
                          type="checkbox" 
                          checked={row.enabled}
                          onChange={(e) => updateRow(
                            activeReqTab === "params" ? setParams : activeReqTab === "headers" ? setHeaders : setFormData, 
                            row.id, "enabled", e.target.checked
                          )}
                          className="size-5 rounded-lg border-white/10 bg-black/60 accent-accent cursor-pointer transition-all hover:scale-110"
                        />
                        <input 
                          type="text" 
                          value={row.key}
                          onChange={(e) => updateRow(
                            activeReqTab === "params" ? setParams : activeReqTab === "headers" ? setHeaders : setFormData, 
                            row.id, "key", e.target.value
                          )}
                          placeholder="e.g. limit"
                          className="toolsy-input bg-black/60 border border-white/5 rounded-xl px-4 py-3 font-mono text-xs focus:border-accent/40 transition-all placeholder:opacity-20"
                        />
                        <input 
                          type="text" 
                          value={row.value}
                          onChange={(e) => updateRow(
                            activeReqTab === "params" ? setParams : activeReqTab === "headers" ? setHeaders : setFormData, 
                            row.id, "value", e.target.value
                          )}
                          placeholder="e.g. 100"
                          className="toolsy-input bg-black/60 border border-white/5 rounded-xl px-4 py-3 font-mono text-xs focus:border-accent/40 transition-all placeholder:opacity-20"
                        />
                        <button 
                          onClick={() => removeRow(
                            activeReqTab === "params" ? setParams : activeReqTab === "headers" ? setHeaders : setFormData, 
                            row.id
                          )}
                          className="size-8 flex items-center justify-center rounded-lg text-muted/40 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </motion.div>
                    ))}
                    
                    <button 
                      onClick={() => addRow(activeReqTab === "params" ? setParams : activeReqTab === "headers" ? setHeaders : setFormData)}
                      className="mt-6 flex items-center gap-2 self-start text-[10px] font-black uppercase tracking-[0.2em] text-accent hover:text-accent/80 transition-all bg-accent/5 px-4 py-2.5 rounded-xl border border-accent/20"
                    >
                      <Plus className="size-3.5" /> Add New Key
                    </button>
                  </div>
                )}

                {/* AUTH EDITOR */}
                {activeReqTab === "auth" && (
                  <div className="flex flex-col gap-10">
                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                        <Lock className="size-3" /> Authorization Type
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(["none", "bearer", "basic"] as AuthType[]).map(type => (
                          <button
                            key={type}
                            onClick={() => setAuthType(type)}
                            className={`px-4 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all
                              ${authType === type 
                                ? "bg-accent/10 border-accent/40 text-accent shadow-lg shadow-accent/10" 
                                : "bg-black/40 border-white/5 text-muted hover:border-white/20"}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {authType === "bearer" && (
                        <motion.div 
                          key="bearer" 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex flex-col gap-3"
                        >
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted/60">Token</label>
                          <textarea 
                            value={bearerToken}
                            onChange={(e) => setBearerToken(e.target.value)}
                            placeholder="Bearer eyJhbGciOiJIUzI1Ni..."
                            className="toolsy-input w-full min-h-[140px] bg-black/60 border border-white/5 rounded-2xl p-6 font-mono text-xs resize-none focus:border-accent/40 shadow-inner"
                            spellCheck={false}
                          />
                        </motion.div>
                      )}

                      {authType === "basic" && (
                        <motion.div 
                          key="basic"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="grid grid-cols-2 gap-4"
                        >
                          <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted/60">Username</label>
                            <input 
                              type="text"
                              value={basicUser}
                              onChange={e => setBasicUser(e.target.value)}
                              className="toolsy-input bg-black/60 border border-white/5 rounded-2xl px-5 py-4 font-mono text-xs focus:border-accent/40"
                            />
                          </div>
                          <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted/60">Password</label>
                            <input 
                              type="password"
                              value={basicPass}
                              onChange={e => setBasicPass(e.target.value)}
                              className="toolsy-input bg-black/60 border border-white/5 rounded-2xl px-5 py-4 font-mono text-xs focus:border-accent/40"
                            />
                          </div>
                        </motion.div>
                      )}

                      {authType === "none" && (
                        <motion.div 
                          key="none"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center py-20 text-muted/20"
                        >
                          <ShieldAlert className="size-20 mb-4" />
                          <span className="text-[10px] font-black uppercase tracking-[0.3em]">No Authentication Required</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* BODY EDITOR */}
                {activeReqTab === "body" && (
                  <div className="flex flex-col gap-8 flex-1">
                    <div className="flex items-center gap-3">
                      {(["none", "json", "form-data", "raw"] as BodyType[]).map(type => (
                        <button
                          key={type}
                          onClick={() => setBodyType(type)}
                          className={`flex-1 px-3 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all
                            ${bodyType === type 
                              ? "bg-white/10 border-white/20 text-foreground" 
                              : "bg-black/20 border-white/5 text-muted hover:bg-white/5"}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    <AnimatePresence mode="wait">
                      {bodyType === "none" ? (
                        <motion.div 
                          key="none-body"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex-1 flex flex-col items-center justify-center text-muted/20"
                        >
                          <FileType className="size-16 mb-4" />
                          <span className="text-[10px] font-black uppercase tracking-[0.3em]">No Payload Selected</span>
                        </motion.div>
                      ) : bodyType === "form-data" ? (
                        <motion.div key="fd-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                           {/* Reuses the KV editor logic triggered by the main tab check */}
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="text-body"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex-1 flex flex-col gap-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted/40">
                              {bodyType === "json" ? "Application / JSON" : "Raw Text Payload"}
                            </span>
                            {bodyType === "json" && (
                              <button 
                                onClick={() => {
                                  try { setReqBody(JSON.stringify(JSON.parse(reqBody), null, 2)); } catch {}
                                }}
                                className="text-[10px] font-black uppercase tracking-widest text-accent hover:text-accent/80 transition-all bg-accent/10 px-3 py-1.5 rounded-lg border border-accent/20"
                              >
                                Tidy JSON
                              </button>
                            )}
                          </div>
                          <textarea 
                            value={reqBody}
                            onChange={(e) => setReqBody(e.target.value)}
                            placeholder={bodyType === "json" ? '{ "id": 1, "name": "Toolsy" }' : "Enter raw payload..."}
                            className="toolsy-input flex-1 w-full bg-black/60 border border-white/5 rounded-2xl p-6 font-mono text-sm leading-relaxed resize-none focus:border-accent/40 custom-scrollbar shadow-inner"
                            spellCheck={false}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Advanced Settings Footer */}
              <div className="p-4 bg-white/[0.01] border-t border-white/5">
                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted/60 hover:text-foreground transition-colors"
                >
                  <Settings2 className="size-3.5" /> Advanced Settings
                  <ChevronDown className={`size-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 flex flex-col gap-4">
                        <label className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5 cursor-pointer group hover:border-white/10 transition-all">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Ignore SSL Certificates</span>
                            <span className="text-[9px] font-bold text-muted/40 uppercase">Enable for self-signed development servers</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={ignoreSsl}
                            onChange={e => setIgnoreSsl(e.target.checked)}
                            className="size-6 rounded-lg accent-accent"
                          />
                        </label>
                        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-black/20 border border-dashed border-white/5 opacity-50 grayscale">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted/60">Client Certificate (PFX / PEM)</span>
                          <div className="flex items-center justify-center h-20 border border-white/5 rounded-xl border-dashed">
                             <span className="text-[9px] font-bold uppercase tracking-widest">Enterprise Support Only</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </GlassCard>
          </div>

          {/* RESPONSE PANEL (RIGHT) */}
          <div className="xl:col-span-6 flex flex-col gap-6">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-muted/60">
              <Zap className="size-4" /> 03. Response Inspector
            </div>
            <GlassCard className="flex flex-col overflow-hidden min-h-[580px]">
              {/* Meta Stats Bar */}
              <div className="flex flex-wrap items-center justify-between p-4 bg-white/[0.04] border-b border-white/5 gap-4 shadow-xl relative z-10">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted/40">Status</span>
                    <span className={`text-sm font-black tracking-tighter ${getStatusColor(response?.status)}`}>
                      {response?.status || "---"} {response?.statusText || "IDLE"}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-white/5" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted/40">Time</span>
                    <span className="text-sm font-mono font-bold text-blue-400">
                      {response?.timing ? `${response.timing}ms` : "---"}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-white/5" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted/40">Size</span>
                    <span className="text-sm font-mono font-bold text-amber-400">
                      {response?.size ? `${(response.size / 1024).toFixed(2)} KB` : "---"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleCopy}
                    disabled={!response?.rawBody}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-muted hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all"
                  >
                    {copied ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy Body"}
                  </button>
                </div>
              </div>

              {/* Inspector Tabs */}
              <div className="flex items-center gap-1 p-3 bg-white/[0.02] border-b border-white/5">
                {[
                  { id: "body", label: "Formatted Body", icon: FileCode },
                  { id: "headers", label: "Response Headers", icon: ListTree },
                ].map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveResTab(t.id)}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all
                        ${activeResTab === t.id ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground/80 hover:bg-white/5"}`}
                    >
                      <Icon className="size-3.5" /> {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Response Content Area */}
              <div className="flex-1 flex flex-col relative overflow-hidden bg-black/60 group">
                {!response ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 opacity-20 transition-opacity group-hover:opacity-30">
                    <div className="relative">
                       <Globe className="size-20 text-muted" />
                       <div className="absolute inset-0 bg-accent/20 blur-[40px] rounded-full animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.4em] text-foreground">Radio Silence</span>
                      <span className="text-[9px] font-bold text-muted uppercase tracking-widest">Awaiting Remote Transmission</span>
                    </div>
                  </div>
                ) : response.error ? (
                  <div className="p-8 flex flex-col gap-6 h-full justify-center">
                    <div className="p-8 bg-red-500/[0.03] border border-red-500/10 rounded-[2rem] flex flex-col items-center gap-6 text-center max-w-sm mx-auto shadow-2xl">
                      <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                        <ShieldAlert className="size-8 text-red-500 animate-pulse" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <h4 className="text-lg font-black uppercase tracking-tighter text-red-400">Transmission Failed</h4>
                        <p className="text-[11px] font-mono font-medium text-red-300/60 leading-relaxed uppercase">
                          {response.error}
                        </p>
                      </div>
                      <button 
                        onClick={handleSend}
                        className="px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        Re-attempt Handshake
                      </button>
                    </div>
                  </div>
                ) : activeResTab === "body" ? (
                  <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                    <pre className="font-mono text-[13px] text-foreground/90 leading-[1.8] word-break whitespace-pre-wrap selection:bg-accent/30">
                      {typeof response.body === 'object' 
                        ? JSON.stringify(response.body, null, 2) 
                        : response.rawBody}
                    </pre>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto p-6 custom-scrollbar flex flex-col gap-2">
                    {Object.entries(response.headers || {}).map(([k, v], i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex gap-6 p-4 hover:bg-white/[0.04] rounded-2xl transition-all border-b border-white/[0.03] last:border-0 group/row"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest text-accent/50 w-1/3 shrink-0 break-all group-hover/row:text-accent transition-colors">{k}</span>
                        <span className="text-xs font-mono font-medium text-foreground/70 break-all group-hover/row:text-foreground transition-colors">{v}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

        </div>

        {/* CINEMATIC DOCUMENTATION */}
        <section className="mt-12 pt-16 border-t border-white/5 flex flex-col gap-12">
          <div className="flex flex-col gap-3 text-center md:text-left">
            <h3 className="text-sm font-black uppercase tracking-[0.4em] text-accent">Protocol Intelligence Manual</h3>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Mastering the Request-Response Lifecycle</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                title: "Hydration Logic", 
                icon: ListTree, 
                desc: "Query parameters are automatically hydrated into the URL string. You can configure them in the 'Params' tab for dynamic targeting.",
                color: "text-blue-400",
                bg: "bg-blue-500/5"
              },
              { 
                title: "Handshake Auth", 
                icon: Lock, 
                desc: "Securely inject Bearer tokens or Basic credentials. Auth payloads are base64 encoded and attached to the Authorization header.",
                color: "text-amber-400",
                bg: "bg-amber-500/5"
              },
              { 
                title: "Payload Encoding", 
                icon: Braces, 
                desc: "Support for JSON, x-www-form-urlencoded, and raw text. The lab automatically assigns the appropriate Content-Type for known formats.",
                color: "text-emerald-400",
                bg: "bg-emerald-500/5"
              },
              { 
                title: "Forensic Inspector", 
                icon: Zap, 
                desc: "Deep inspection of headers and body payloads. High-performance JSON parsing for massive data streams.",
                color: "text-purple-400",
                bg: "bg-purple-500/5"
              }
            ].map((card, i) => (
              <GlassCard key={i} className={`p-8 flex flex-col gap-6 ${card.bg} border-white/5 hover:border-white/20 transition-all group`}>
                <div className={`size-12 rounded-2xl flex items-center justify-center border border-white/5 ${card.color} group-hover:scale-110 transition-transform`}>
                  <card.icon className="size-6" />
                </div>
                <div className="flex flex-col gap-2">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">{card.title}</h4>
                  <p className="text-[11px] font-medium text-muted/60 leading-relaxed">{card.desc}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      </div>
    </ToolContainer>
  );
}

