"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ToolContainer, ToolHeader } from "@/components/tools";
import { 
  Send,
  Settings2,
  ListTree,
  Lock,
  Braces,
  Globe,
  Copy,
  CheckCircle2,
  ChevronDown,
  Trash2,
  Plus,
  ShieldAlert,
  FileCode,
  Zap,
  Webhook,
  Variable,
  Terminal,
  Play,
  Wifi,
  WifiOff
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
type RequestMode = "rest" | "graphql" | "websocket";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

/* ─────────────────────────────────────────────
   Env Var Helpers
  ───────────────────────────────────────────── */

const ENV_VARS_KEY = "toolsy-api-lab-env-vars";

function loadEnvVars(): KeyValuePair[] {
  if (typeof window === "undefined") return [{ id: "1", key: "", value: "", enabled: true }];
  try {
    const stored = localStorage.getItem(ENV_VARS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [{ id: "1", key: "", value: "", enabled: true }];
}

function saveEnvVars(vars: KeyValuePair[]) {
  try {
    localStorage.setItem(ENV_VARS_KEY, JSON.stringify(vars));
  } catch { /* ignore */ }
}

function substituteVars(text: string, vars: KeyValuePair[]): string {
  const active = vars.filter(v => v.enabled && v.key);
  let result = text;
  for (const v of active) {
    try {
      result = result.replace(new RegExp(`\\{\\{\\s*${escapeRegex(v.key)}\\s*\\}\\}`, "g"), v.value);
    } catch { /* ignore invalid patterns */ }
  }
  return result;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
    <div className="relative min-w-[160px] z-[60] !overflow-visible">
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
  
  // 4. Execution Mode
  const [executionMode, setExecutionMode] = useState<"local" | "remote">("remote");
  const [ignoreSsl, setIgnoreSsl] = useState(false);

  // 5. Response Data
  const [response, setResponse] = useState<ApiResponse | null>(null);

  // 6. Request Mode
  const [requestMode, setRequestMode] = useState<RequestMode>("rest");

  // 7. GraphQL
  const [gqlQuery, setGqlQuery] = useState("");
  const [gqlVariables, setGqlVariables] = useState("{\n  \n}");

  // 8. WebSocket
  const [wsInput, setWsInput] = useState("");
  const [wsMessages, setWsMessages] = useState<Array<{ type: "sent" | "received" | "info" | "error"; text: string; timestamp: string }>>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wsLogRef = useRef<HTMLDivElement>(null);

  // 9. Environment Variables
  const [envVars, setEnvVars] = useState<KeyValuePair[]>(loadEnvVars);
  const [envSubstitution, setEnvSubstitution] = useState(true);

  /* ─────────────────────────────────────────────
     Effects
    ───────────────────────────────────────────── */

  useEffect(() => {
    saveEnvVars(envVars);
  }, [envVars]);

  useEffect(() => {
    if (wsLogRef.current) {
      wsLogRef.current.scrollTop = wsLogRef.current.scrollHeight;
    }
  }, [wsMessages]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

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

  const applyEnvSubstitution = useCallback((targetUrl: string, targetMethod: string, targetBody: string | undefined, targetHeaders: Record<string, string>) => {
    if (!envSubstitution) return { url: targetUrl, body: targetBody, headers: targetHeaders };
    const substituted: Record<string, string> = {};
    for (const [k, v] of Object.entries(targetHeaders)) {
      substituted[k] = substituteVars(v, envVars);
    }
    return {
      url: substituteVars(targetUrl, envVars),
      body: targetBody ? substituteVars(targetBody, envVars) : targetBody,
      headers: substituted,
    };
  }, [envSubstitution, envVars]);

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

      let finalBody: string | undefined = undefined;
      let finalMethod = method;

      if (requestMode === "graphql") {
        finalMethod = "POST";
        finalHeaders["Content-Type"] = "application/json";
        const payload: Record<string, unknown> = { query: gqlQuery };
        if (gqlVariables.trim()) {
          try { payload.variables = JSON.parse(gqlVariables); } catch { payload.variables = gqlVariables; }
        }
        finalBody = JSON.stringify(payload);
      } else {
        // Body Handling for REST
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
      }

      let finalUrl = url;
      const activeParams = params.filter(p => p.enabled && p.key);
      if (activeParams.length > 0 && requestMode !== "graphql") {
        try {
          const urlObj = new URL(url);
          activeParams.forEach(p => urlObj.searchParams.append(p.key, p.value));
          finalUrl = urlObj.toString();
        } catch { 
          const separator = url.includes('?') ? '&' : '?';
          const query = activeParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
          finalUrl = `${url}${separator}${query}`;
        }
      }

      // Env Var Substitution
      const substituted = applyEnvSubstitution(finalUrl, finalMethod, finalBody, finalHeaders);
      finalUrl = substituted.url;
      finalBody = substituted.body;

      let data;
      if (executionMode === "remote") {
        const res = await fetch("/api/network/api-lab", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: finalUrl,
            method: finalMethod,
            headers: substituted.headers,
            body: finalBody,
            ignoreSsl
          })
        });
        data = await res.json();
      } else {
        const startTime = performance.now();
        const res = await fetch(finalUrl, {
          method: finalMethod,
          headers: substituted.headers,
          body: finalBody
        });
        const endTime = performance.now();
        const bodyText = await res.text();
        let bodyJson;
        try { bodyJson = JSON.parse(bodyText); } catch { bodyJson = null; }
        
        const resHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => { resHeaders[k] = v; });

        data = {
          status: res.status,
          statusText: res.statusText,
          headers: resHeaders,
          body: bodyJson,
          rawBody: bodyText,
          timing: Math.round(endTime - startTime),
          size: bodyText.length
        };
      }
      setResponse(data);
    } catch (err: unknown) {
      setResponse({ error: (err as Error).message || "Connection failed. Check CORS or URL." });
    } finally {
      setIsLoading(false);
    }
  };

  /* ─────────────────────────────────────────────
     WebSocket Handlers
    ───────────────────────────────────────────── */

  const wsConnect = useCallback(() => {
    if (!url || wsConnected) return;
    try {
      const wsUrl = url.replace(/^http/, "ws");
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
        setWsMessages(prev => [...prev, { type: "info", text: "WebSocket connection established", timestamp: new Date().toLocaleTimeString() }]);
      };

      socket.onmessage = (event) => {
        setWsMessages(prev => [...prev, { type: "received", text: event.data, timestamp: new Date().toLocaleTimeString() }]);
      };

      socket.onerror = () => {
        setWsMessages(prev => [...prev, { type: "error", text: "WebSocket error occurred", timestamp: new Date().toLocaleTimeString() }]);
      };

      socket.onclose = (event) => {
        setWsConnected(false);
        setWsMessages(prev => [...prev, { type: "info", text: `WebSocket closed (code: ${event.code})`, timestamp: new Date().toLocaleTimeString() }]);
        wsRef.current = null;
      };
    } catch (err) {
      setWsMessages(prev => [...prev, { type: "error", text: `Connection failed: ${(err as Error).message}`, timestamp: new Date().toLocaleTimeString() }]);
    }
  }, [url, wsConnected]);

  const wsDisconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  }, []);

  const wsSendMessage = useCallback(() => {
    if (!wsRef.current || !wsInput.trim()) return;
    wsRef.current.send(wsInput);
    setWsMessages(prev => [...prev, { type: "sent", text: wsInput, timestamp: new Date().toLocaleTimeString() }]);
    setWsInput("");
  }, [wsInput]);

  const wsClearLog = useCallback(() => {
    setWsMessages([]);
  }, []);

  const getStatusColor = (status: number | undefined) => {
    if (!status) return "text-muted";
    if (status < 300) return "text-emerald-400";
    if (status < 400) return "text-blue-400";
    if (status < 500) return "text-amber-400";
    return "text-red-400";
  };

  const showTabs = requestMode !== "websocket";

  return (
    <ToolContainer categoryId="dev-automation">
      <ToolHeader
        title="API Request Lab"
        description="High-fidelity HTTP Request Builder for advanced API engineering and debugging."
        categoryId="dev-automation"
      />

      <div className="flex flex-col gap-10 max-w-[96rem] mx-auto w-full pb-32">
        
        {/* UPPER SECTION: CONFIGURE TARGET */}
        <section className="relative z-30 flex flex-col gap-6">
          {/* MODE SELECTOR */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-accent/70">
            <Globe className="size-4" /> 01. Configure Target
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Request Mode */}
            <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
              {[
                { id: "rest", label: "REST", icon: Zap },
                { id: "graphql", label: "GraphQL", icon: Terminal },
                { id: "websocket", label: "WebSocket", icon: Webhook },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setRequestMode(m.id as RequestMode);
                    setResponse(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                    ${requestMode === m.id 
                      ? "bg-accent text-white shadow-lg shadow-accent/20" 
                      : "text-muted hover:text-foreground hover:bg-white/5"}`}
                >
                  <m.icon className="size-3" /> {m.label}
                </button>
              ))}
            </div>
            {/* Execution Mode */}
            <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
              {[
                { id: "local", label: "Local (Browser)", icon: Zap },
                { id: "remote", label: "Remote (Proxy)", icon: Globe }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setExecutionMode(m.id as "local" | "remote")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                    ${executionMode === m.id 
                      ? "bg-accent text-white shadow-lg shadow-accent/20" 
                      : "text-muted hover:text-foreground hover:bg-white/5"}`}
                >
                  <m.icon className="size-3" /> {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* URL BAR (REST & GraphQL only) */}
        {requestMode !== "websocket" && (
          <GlassCard className="!overflow-visible p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4 border-l-4 border-l-accent bg-accent/[0.02]">
            <div className="relative flex items-center gap-0 w-full z-10 !overflow-visible">
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
                <span className="flex items-center gap-2"><Send className="size-4" /> Send</span>
              )}
            </button>
          </GlassCard>
        )}

        {/* WEBSOCKET PANEL */}
        {requestMode === "websocket" && (
          <div className="flex flex-col gap-6">
            <GlassCard className="p-4 flex items-center gap-4 border-l-4 border-l-accent bg-accent/[0.02]">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="wss://echo.websocket.org"
                  className="toolsy-input w-full bg-black/40 border-2 border-white/5 rounded-2xl py-5 px-6 font-mono text-sm shadow-inner transition-all focus:border-accent/40 focus:bg-black/60"
                  spellCheck={false}
                  onKeyDown={e => e.key === 'Enter' && !wsConnected && wsConnect()}
                />
              </div>
              <button
                onClick={wsConnected ? wsDisconnect : wsConnect}
                disabled={!url || isLoading}
                className={`flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm transition-all shrink-0 active:scale-[0.98] ${
                  wsConnected
                    ? "bg-red-500 text-white hover:opacity-90 shadow-[0_0_30px_rgba(239,68,68,0.3)]"
                    : "bg-accent text-accent-foreground hover:opacity-90 shadow-[0_0_30px_rgba(var(--accent-rgb),0.3)]"
                }`}
              >
                {wsConnected ? <><WifiOff className="size-4" /> Disconnect</> : <><Wifi className="size-4" /> Connect</>}
              </button>
            </GlassCard>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <GlassCard className="xl:col-span-8 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between p-4 bg-white/[0.04] border-b border-white/5">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted/60">
                    <Webhook className="size-4" /> Message Log
                    <span className={`ml-2 size-2 rounded-full ${wsConnected ? "bg-emerald-400 animate-pulse" : "bg-muted/40"}`} />
                  </div>
                  <button onClick={wsClearLog} disabled={wsMessages.length === 0} className="text-[9px] font-black uppercase tracking-widest text-muted/40 hover:text-red-400 disabled:opacity-30 transition-colors" aria-label="Clear WebSocket message log">
                    Clear Log
                  </button>
                </div>
                <div ref={wsLogRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-2 bg-black/40">
                  {wsMessages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center opacity-20 text-[10px] font-black uppercase tracking-widest">Awaiting Messages</div>
                  ) : (
                    wsMessages.map((msg, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border text-xs font-mono ${
                        msg.type === "sent" ? "bg-accent/5 border-accent/10" :
                        msg.type === "received" ? "bg-emerald-500/5 border-emerald-500/10" :
                        msg.type === "error" ? "bg-red-500/5 border-red-500/10" :
                        "bg-white/5 border-white/5"
                      }`}>
                        <span className="text-[9px] font-black text-muted/40 shrink-0 w-16">{msg.timestamp}</span>
                        <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider ${
                          msg.type === "sent" ? "text-accent" :
                          msg.type === "received" ? "text-emerald-400" :
                          msg.type === "error" ? "text-red-400" : "text-muted"
                        }`}>
                          {msg.type === "sent" ? "→ SENT" : msg.type === "received" ? "← RECV" : msg.type === "error" ? "⚠ ERR" : "ℹ INFO"}
                        </span>
                        <span className="text-foreground/80 break-all whitespace-pre-wrap flex-1 min-w-0">{msg.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>

              <GlassCard className="xl:col-span-4 flex flex-col">
                <div className="p-4 bg-white/[0.04] border-b border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted/60">Message Composer</span>
                </div>
                <div className="flex-1 p-4 flex flex-col gap-4">
                  <textarea
                    value={wsInput}
                    onChange={e => setWsInput(e.target.value)}
                    placeholder="Type your message..."
                    className="toolsy-input flex-1 w-full min-h-[120px] bg-black/60 border border-white/5 rounded-2xl p-4 font-mono text-sm resize-none focus:border-accent/40"
                    spellCheck={false}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); wsSendMessage(); } }}
                  />
                  <button
                    onClick={wsSendMessage}
                    disabled={!wsConnected || !wsInput.trim()}
                    className="w-full py-4 bg-accent text-accent-foreground rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:opacity-90 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
                  >
                    <Play className="size-4" /> Transmit
                  </button>
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </section>

        {/* CONFIGURATION SECTION */}
        {showTabs && (
          <section className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-muted/40 ml-2">
              <Settings2 className="size-4" /> 02. Configuration
            </div>
            <GlassCard className="flex flex-col overflow-hidden min-h-[400px] shadow-2xl">
              {/* Tabs */}
              <div className="flex items-center gap-2 p-3 bg-white/[0.03] border-b border-white/5 overflow-x-auto custom-scrollbar">
                {[
                  { id: "params", label: "Params", icon: ListTree },
                  { id: "auth", label: "Auth", icon: Lock },
                  { id: "headers", label: "Headers", icon: Globe },
                  { id: "body", label: "Body", icon: Braces },
                  { id: "graphql", label: "GraphQL", icon: Terminal },
                  { id: "variables", label: "Variables", icon: Variable },
                ].map(t => {
                  const Icon = t.icon;
                  const isActive = activeReqTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveReqTab(t.id)}
                      className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all whitespace-nowrap border
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
              <div className="p-6 flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-black/20">
                
                {/* PARAMS / HEADERS / FORM-DATA (row editor) */}
                {(activeReqTab === "params" || activeReqTab === "headers" || (activeReqTab === "body" && bodyType === "form-data")) && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-[30px_1fr_1fr_30px] gap-4 mb-2 px-2">
                      <div className="w-[30px]"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted/30">Key</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted/30">Value</span>
                      <div className="w-[30px]"></div>
                    </div>
                    
                    {(activeReqTab === "params" ? params : activeReqTab === "headers" ? headers : formData).map((row) => (
                      <motion.div key={row.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-[30px_1fr_1fr_30px] gap-4 items-center group">
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
                          className="toolsy-input bg-black/60 border border-white/5 rounded-xl px-4 py-2.5 font-mono text-xs focus:border-accent/40 transition-all placeholder:opacity-20"
                        />
                        <input 
                          type="text" 
                          value={row.value}
                          onChange={(e) => updateRow(
                            activeReqTab === "params" ? setParams : activeReqTab === "headers" ? setHeaders : setFormData, 
                            row.id, "value", e.target.value
                          )}
                          placeholder="e.g. 100"
                          className="toolsy-input bg-black/60 border border-white/5 rounded-xl px-4 py-2.5 font-mono text-xs focus:border-accent/40 transition-all placeholder:opacity-20"
                        />
                        <button 
                          onClick={() => removeRow(
                            activeReqTab === "params" ? setParams : activeReqTab === "headers" ? setHeaders : setFormData, 
                            row.id
                          )}
                          className="size-8 flex items-center justify-center rounded-lg text-muted/40 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                          aria-label={`Delete ${activeReqTab === "params" ? "parameter" : activeReqTab === "headers" ? "header" : "form field"} row`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </motion.div>
                    ))}
                    
                    <button onClick={() => addRow(activeReqTab === "params" ? setParams : activeReqTab === "headers" ? setHeaders : setFormData)} className="mt-4 flex items-center gap-2 self-start text-[9px] font-black uppercase tracking-[0.2em] text-accent hover:text-accent/80 transition-all bg-accent/5 px-4 py-2 rounded-xl border border-accent/20">
                      <Plus className="size-3.5" /> Add Row
                    </button>
                  </div>
                )}

                {/* AUTH */}
                {activeReqTab === "auth" && (
                  <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                        <Lock className="size-3" /> Authorization Type
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(["none", "bearer", "basic"] as AuthType[]).map(type => (
                          <button key={type} onClick={() => setAuthType(type)} className={`px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${authType === type ? "bg-accent/10 border-accent/40 text-accent shadow-lg shadow-accent/10" : "bg-black/40 border-white/5 text-muted hover:border-white/20"}`}>
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <AnimatePresence mode="wait">
                      {authType === "bearer" && (
                        <motion.div key="bearer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted/60">Token</label>
                          <textarea value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} placeholder="eyJhbGciOiJIUzI1Ni..." className="toolsy-input w-full min-h-[100px] bg-black/60 border border-white/5 rounded-2xl p-6 font-mono text-xs resize-none focus:border-accent/40 shadow-inner" spellCheck={false} />
                        </motion.div>
                      )}
                      {authType === "basic" && (
                        <motion.div key="basic" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted/60">Username</label>
                            <input type="text" value={basicUser} onChange={e => setBasicUser(e.target.value)} className="toolsy-input bg-black/60 border border-white/5 rounded-2xl px-5 py-3 font-mono text-xs focus:border-accent/40" />
                          </div>
                          <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted/60">Password</label>
                            <input type="password" value={basicPass} onChange={e => setBasicPass(e.target.value)} className="toolsy-input bg-black/60 border border-white/5 rounded-2xl px-5 py-3 font-mono text-xs focus:border-accent/40" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* BODY */}
                {activeReqTab === "body" && (
                  <div className="flex flex-col gap-6 flex-1">
                    <div className="flex items-center gap-3">
                      {(["none", "json", "form-data", "raw"] as BodyType[]).map(type => (
                        <button key={type} onClick={() => setBodyType(type)} className={`flex-1 px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${bodyType === type ? "bg-white/10 border-white/20 text-foreground" : "bg-black/20 border-white/5 text-muted hover:bg-white/5"}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                    <AnimatePresence mode="wait">
                      {bodyType !== "none" && bodyType !== "form-data" && (
                        <motion.div key="text-body" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col gap-4">
                          <textarea value={reqBody} onChange={(e) => setReqBody(e.target.value)} placeholder={bodyType === "json" ? '{ "id": 1, "name": "Toolsy" }' : "Enter raw payload..."} className="toolsy-input flex-1 w-full min-h-[200px] bg-black/60 border border-white/5 rounded-2xl p-6 font-mono text-sm leading-relaxed resize-none focus:border-accent/40 custom-scrollbar shadow-inner" spellCheck={false} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* GRAPHQL */}
                {activeReqTab === "graphql" && (
                  <div className="flex flex-col gap-6 flex-1">
                    <div className="flex flex-col gap-3 flex-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                        <Terminal className="size-3" /> Query
                      </label>
                      <textarea
                        value={gqlQuery}
                        onChange={(e) => setGqlQuery(e.target.value)}
                        placeholder={`query {\n  users {\n    id\n    name\n    email\n  }\n}`}
                        className="toolsy-input flex-1 w-full min-h-[250px] bg-black/60 border border-white/5 rounded-2xl p-6 font-mono text-sm leading-relaxed resize-none focus:border-accent/40 custom-scrollbar shadow-inner"
                        spellCheck={false}
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                        <Braces className="size-3" /> Variables (JSON)
                      </label>
                      <textarea
                        value={gqlVariables}
                        onChange={(e) => setGqlVariables(e.target.value)}
                        placeholder='{ "id": 1 }'
                        className="toolsy-input w-full min-h-[100px] bg-black/60 border border-white/5 rounded-2xl p-6 font-mono text-sm leading-relaxed resize-none focus:border-accent/40 custom-scrollbar shadow-inner"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                )}

                {/* VARIABLES (Environment Variables) */}
                {activeReqTab === "variables" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Variable className="size-4 text-accent" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted/60">Environment Variables</span>
                      </div>
                      <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted cursor-pointer hover:text-foreground transition-colors">
                        <input type="checkbox" checked={envSubstitution} onChange={e => setEnvSubstitution(e.target.checked)} className="size-4 accent-accent rounded" />
                        Auto-substitute
                      </label>
                    </div>
                    <p className="text-[9px] font-medium text-muted/60 leading-relaxed">
                      Define variables and reference them as <code className="text-accent font-mono text-[10px]">{`{{variableName}}`}</code> in URL, headers, and body fields.
                    </p>
                    <div className="grid grid-cols-[30px_1fr_1fr_30px] gap-4 mb-2 px-2 mt-4">
                      <div className="w-[30px]"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted/30">Variable Name</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted/30">Value</span>
                      <div className="w-[30px]"></div>
                    </div>
                    {envVars.map((row) => (
                      <motion.div key={row.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-[30px_1fr_1fr_30px] gap-4 items-center group">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(e) => updateRow(setEnvVars, row.id, "enabled", e.target.checked)}
                          className="size-5 rounded-lg border-white/10 bg-black/60 accent-accent cursor-pointer transition-all hover:scale-110"
                        />
                        <input
                          type="text"
                          value={row.key}
                          onChange={(e) => updateRow(setEnvVars, row.id, "key", e.target.value)}
                          placeholder="e.g. BASE_URL"
                          className="toolsy-input bg-black/60 border border-white/5 rounded-xl px-4 py-2.5 font-mono text-xs focus:border-accent/40 transition-all placeholder:opacity-20"
                        />
                        <input
                          type="text"
                          value={row.value}
                          onChange={(e) => updateRow(setEnvVars, row.id, "value", e.target.value)}
                          placeholder="e.g. https://api.example.com"
                          className="toolsy-input bg-black/60 border border-white/5 rounded-xl px-4 py-2.5 font-mono text-xs focus:border-accent/40 transition-all placeholder:opacity-20"
                        />
                        <button
                          onClick={() => removeRow(setEnvVars, row.id)}
                          className="size-8 flex items-center justify-center rounded-lg text-muted/40 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                          aria-label="Delete environment variable row"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </motion.div>
                    ))}
                    <button onClick={() => addRow(setEnvVars)} className="mt-4 flex items-center gap-2 self-start text-[9px] font-black uppercase tracking-[0.2em] text-accent hover:text-accent/80 transition-all bg-accent/5 px-4 py-2 rounded-xl border border-accent/20">
                      <Plus className="size-3.5" /> Add Variable
                    </button>
                  </div>
                )}
              </div>

              {/* Advanced Settings Footer */}
              <div className="p-4 bg-white/[0.01] border-t border-white/5">
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted/60 hover:text-foreground transition-colors">
                  <Settings2 className="size-3.5" /> Advanced Settings
                  <ChevronDown className={`size-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="pt-4 flex flex-col gap-4">
                        <label className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5 cursor-pointer group hover:border-white/10 transition-all">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Ignore SSL Certificates</span>
                            <span className="text-[9px] font-bold text-muted/40 uppercase">Enable for self-signed development servers (Remote Only)</span>
                          </div>
                          <input type="checkbox" checked={ignoreSsl} onChange={e => setIgnoreSsl(e.target.checked)} className="size-6 rounded-lg accent-accent" />
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </GlassCard>
          </section>
        )}

        {/* RESPONSE SECTION */}
        {showTabs && (
          <section className="flex flex-col gap-6">
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-muted/40 ml-2">
              <Zap className="size-4" /> 03. Response Inspector
            </div>
            <GlassCard className="flex flex-col overflow-hidden min-h-[500px]">
              {/* Meta Stats Bar */}
              <div className="flex flex-wrap items-center justify-between p-4 bg-white/[0.04] border-b border-white/5 gap-4 shadow-xl relative z-10">
                <div className="flex items-center gap-8">
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
              <div className="flex items-center gap-1 p-2 bg-white/[0.02] border-b border-white/5">
                {[
                  { id: "body", label: "Formatted Body", icon: FileCode },
                  { id: "headers", label: "Headers", icon: ListTree },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveResTab(t.id)}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all
                      ${activeResTab === t.id ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground/80 hover:bg-white/5"}`}
                  >
                    <t.icon className="size-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              {/* Response Content Area */}
              <div className="flex-1 flex flex-col relative overflow-hidden bg-black/60 min-h-[400px]">
                {!response ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 opacity-20">
                     <Globe className="size-16 text-muted" />
                     <span className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground">Radio Silence</span>
                  </div>
                ) : response.error ? (
                  <div className="p-12 flex flex-col items-center justify-center text-center gap-6">
                    <ShieldAlert className="size-12 text-red-500 animate-pulse" />
                    <div className="flex flex-col gap-2">
                      <h4 className="text-lg font-black uppercase tracking-tighter text-red-400">Transmission Failed</h4>
                      <p className="text-xs font-mono text-red-300/60 uppercase max-w-md mx-auto">{response.error}</p>
                    </div>
                  </div>
                ) : activeResTab === "body" ? (
                  <div className="flex-1 overflow-auto p-8 custom-scrollbar font-mono text-[13px] leading-[1.8] whitespace-pre-wrap">
                    {typeof response.body === 'object' ? JSON.stringify(response.body, null, 2) : response.rawBody}
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto p-6 custom-scrollbar flex flex-col gap-2">
                    {Object.entries(response.headers || {}).map(([k, v], i) => (
                      <div key={i} className="flex gap-6 p-4 hover:bg-white/[0.04] rounded-2xl transition-all border-b border-white/[0.03] last:border-0 group">
                        <span className="text-[10px] font-black uppercase tracking-widest text-accent/50 w-1/3 shrink-0 break-all">{k}</span>
                        <span className="text-xs font-mono font-medium text-foreground/70 break-all">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </section>
        )}

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
