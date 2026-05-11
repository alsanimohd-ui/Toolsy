"use client";

import React, { useState } from "react";
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
  AlertTriangle
} from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

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

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

export default function ApiRequestLabClient() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/posts/1");
  const [isLoading, setIsLoading] = useState(false);
  
  const [activeReqTab, setActiveReqTab] = useState("headers");
  const [activeResTab, setActiveResTab] = useState("body");

  const [headers, setHeaders] = useState<KeyValuePair[]>([
    { id: "1", key: "Content-Type", value: "application/json", enabled: true }
  ]);
  const [params, setParams] = useState<KeyValuePair[]>([
    { id: "1", key: "", value: "", enabled: true }
  ]);
  
  const [authType, setAuthType] = useState("none");
  const [bearerToken, setBearerToken] = useState("");
  const [reqBody, setReqBody] = useState("");

  const [response, setResponse] = useState<ApiResponse | null>(null);

  const addRow = (setter: unknown) => {
    (setter as React.Dispatch<React.SetStateAction<KeyValuePair[]>>)(prev => [...prev, { id: Math.random().toString(36).substring(7), key: "", value: "", enabled: true }]);
  };

  const updateRow = (setter: unknown, id: string, field: "key" | "value" | "enabled", val: unknown) => {
    (setter as React.Dispatch<React.SetStateAction<KeyValuePair[]>>)(prev => prev.map(row => row.id === id ? { ...row, [field]: val as never } : row));
  };

  const removeRow = (setter: unknown, id: string) => {
    (setter as React.Dispatch<React.SetStateAction<KeyValuePair[]>>)(prev => prev.filter(row => row.id !== id));
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

      if (authType === "bearer" && bearerToken) {
        finalHeaders["Authorization"] = `Bearer ${bearerToken}`;
      }

      let finalUrl = url;
      const activeParams = params.filter(p => p.enabled && p.key);
      if (activeParams.length > 0) {
        try {
          const urlObj = new URL(url);
          activeParams.forEach(p => urlObj.searchParams.append(p.key, p.value));
          finalUrl = urlObj.toString();
        } catch { }
      }

      const res = await fetch("/api/network/api-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: finalUrl,
          method,
          headers: finalHeaders,
          body: reqBody || undefined
        })
      });

      const data = await res.json();
      setResponse(data);
    } catch (err: unknown) {
      setResponse({ error: (err as Error).message || "Failed to reach proxy." });
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
        description="Cinematic next-generation API engineering workstation. Test, debug, and analyze RESTful endpoints."
        categoryId="dev-automation"
      />

      <div className="flex flex-col gap-8">
        
        {/* TOP BAR */}
        <GlassCard className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="flex items-center gap-0 w-full">
            <select 
              value={method}
              onChange={e => setMethod(e.target.value)}
              className={`toolsy-input bg-black/60 border-y-2 border-l-2 border-r-0 border-white/5 rounded-l-xl rounded-r-none pl-4 pr-8 py-4 font-black uppercase tracking-widest text-sm appearance-none outline-none cursor-pointer
                ${method === 'GET' ? 'text-blue-400' : method === 'POST' ? 'text-emerald-400' : method === 'DELETE' ? 'text-red-400' : 'text-amber-400'}`}
            >
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input 
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://api.example.com/v1/users"
              className="toolsy-input flex-1 bg-black/40 border-2 border-white/5 rounded-r-xl py-4 px-4 font-mono text-sm shadow-inner transition-colors focus:border-accent/40"
              spellCheck={false}
            />
          </div>
          <button 
            onClick={handleSend}
            disabled={isLoading || !url}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-accent text-accent-foreground rounded-xl font-black uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 transition-all shrink-0 shadow-[0_0_20px_rgba(var(--accent),0.3)]"
          >
            {isLoading ? (
              <span className="size-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
            ) : (
              <span className="flex items-center gap-2"><Send className="size-4" /> Send</span>
            )}
          </button>
        </GlassCard>

        {/* WORKSPACE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT PANEL: REQUEST CONFIG */}
          <GlassCard className="flex flex-col overflow-hidden min-h-[500px]">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-2 bg-white/[0.02] border-b border-white/5 overflow-x-auto custom-scrollbar">
              {[
                { id: "params", label: "Params", icon: Settings2 },
                { id: "headers", label: "Headers", icon: ListTree },
                { id: "auth", label: "Auth", icon: Lock },
                { id: "body", label: "Body", icon: Braces },
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveReqTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                      ${activeReqTab === t.id ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground/80 hover:bg-white/5"}`}
                  >
                    <Icon className="size-3" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="p-6 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
              
              {/* Headers / Params Editor */}
              {(activeReqTab === "headers" || activeReqTab === "params") && (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 mb-2 px-2">
                    <div className="w-6"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted/60">Key</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted/60">Value</span>
                    <div className="w-6"></div>
                  </div>
                  
                  {(activeReqTab === "headers" ? headers : params).map((row) => (
                    <div key={row.id} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
                      <input 
                        type="checkbox" 
                        checked={row.enabled}
                        onChange={(e) => updateRow(activeReqTab === "headers" ? setHeaders : setParams, row.id, "enabled", e.target.checked)}
                        className="size-4 rounded border-white/10 bg-black/40 accent-accent cursor-pointer"
                      />
                      <input 
                        type="text" 
                        value={row.key}
                        onChange={(e) => updateRow(activeReqTab === "headers" ? setHeaders : setParams, row.id, "key", e.target.value)}
                        placeholder="Key"
                        className="toolsy-input bg-black/40 border border-white/5 rounded-lg px-3 py-2 font-mono text-xs focus:border-accent/40 transition-colors"
                      />
                      <input 
                        type="text" 
                        value={row.value}
                        onChange={(e) => updateRow(activeReqTab === "headers" ? setHeaders : setParams, row.id, "value", e.target.value)}
                        placeholder="Value"
                        className="toolsy-input bg-black/40 border border-white/5 rounded-lg px-3 py-2 font-mono text-xs focus:border-accent/40 transition-colors"
                      />
                      <button 
                        onClick={() => removeRow(activeReqTab === "headers" ? setHeaders : setParams, row.id)}
                        className="p-2 text-muted hover:text-red-400 transition-colors"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => addRow(activeReqTab === "headers" ? setHeaders : setParams)}
                    className="mt-2 self-start text-[10px] font-black uppercase tracking-widest text-accent hover:text-accent/80 transition-colors px-2"
                  >
                    + Add Row
                  </button>
                </div>
              )}

              {/* Auth Editor */}
              {activeReqTab === "auth" && (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted/60">Type</label>
                    <select 
                      value={authType}
                      onChange={(e) => setAuthType(e.target.value)}
                      className="toolsy-input bg-black/40 border border-white/5 rounded-xl px-4 py-3 font-bold text-xs uppercase tracking-widest cursor-pointer"
                    >
                      <option value="none">No Auth</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                  </div>

                  {authType === "bearer" && (
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted/60">Token</label>
                      <textarea 
                        value={bearerToken}
                        onChange={(e) => setBearerToken(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="toolsy-input w-full min-h-[100px] bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-xs resize-none focus:border-accent/40"
                        spellCheck={false}
                      />
                    </div>
                  )}

                  {authType === "basic" && (
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-3 text-muted text-xs font-medium">
                      <AlertTriangle className="size-4 text-amber-400" />
                      Basic auth support requires custom headers. Use the Headers tab for now.
                    </div>
                  )}
                </div>
              )}

              {/* Body Editor */}
              {activeReqTab === "body" && (
                <div className="flex flex-col gap-4 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted/60">Raw JSON / Text</span>
                    <button 
                      onClick={() => {
                        try {
                          setReqBody(JSON.stringify(JSON.parse(reqBody), null, 2));
                        } catch {}
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-accent hover:underline"
                    >
                      Beautify JSON
                    </button>
                  </div>
                  <textarea 
                    value={reqBody}
                    onChange={(e) => setReqBody(e.target.value)}
                    placeholder='{ "key": "value" }'
                    className="toolsy-input flex-1 w-full bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-sm leading-relaxed resize-none focus:border-accent/40 custom-scrollbar"
                    spellCheck={false}
                  />
                </div>
              )}

            </div>
          </GlassCard>

          {/* RIGHT PANEL: RESPONSE INSPECTOR */}
          <GlassCard className="flex flex-col overflow-hidden min-h-[500px]">
            {/* Meta Bar */}
            <div className="flex flex-wrap items-center justify-between p-4 bg-white/[0.02] border-b border-white/5 gap-4">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2">
                  Status: 
                  <span className={`px-2 py-0.5 rounded border ${getStatusColor(response?.status)}`}>
                    {response?.status || "---"} {response?.statusText || ""}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2">
                  <Clock className="size-3" /> {response?.timing ? `${response.timing}ms` : "---"}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2">
                  <HardDrive className="size-3" /> {response?.size ? `${(response.size / 1024).toFixed(2)} KB` : "---"}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-2 bg-white/[0.02] border-b border-white/5">
              {[
                { id: "body", label: "Body", icon: Braces },
                { id: "headers", label: "Headers", icon: ListTree },
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveResTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                      ${activeResTab === t.id ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground/80 hover:bg-white/5"}`}
                  >
                    <Icon className="size-3" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Response Content */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0A0A0A]">
              {!response ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-30">
                  <Globe className="size-12" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Awaiting Request</span>
                </div>
              ) : response.error ? (
                <div className="p-6 flex flex-col gap-4">
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="size-5 text-red-400 shrink-0" />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-red-400">Request Failed</span>
                      <span className="text-xs font-mono text-red-300/70">{response.error}</span>
                    </div>
                  </div>
                </div>
              ) : activeResTab === "body" ? (
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                  <pre className="font-mono text-xs text-foreground/80 leading-relaxed word-break whitespace-pre-wrap">
                    {typeof response.body === 'object' 
                      ? JSON.stringify(response.body, null, 2) 
                      : response.rawBody}
                  </pre>
                </div>
              ) : (
                <div className="flex-1 overflow-auto p-4 custom-scrollbar flex flex-col gap-1">
                  {Object.entries(response.headers || {}).map(([k, v], i) => (
                    <div key={i} className="flex gap-4 p-2 hover:bg-white/[0.02] rounded-lg transition-colors border-b border-white/[0.02] last:border-0 font-mono text-xs">
                      <span className="text-accent opacity-60 w-1/3 shrink-0 break-all">{k}</span>
                      <span className="text-foreground/80 break-all">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>

        </div>

        {/* Cinematic Documentation Section */}
        <section className="mt-8 pt-12 border-t border-white/5 flex flex-col gap-12">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-foreground">API Operations Manual</h3>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Methods, Headers & Architecture</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard className="flex flex-col gap-5 p-6 bg-blue-500/[0.02] border-blue-500/10 hover:border-blue-500/30 transition-colors">
              <div className="flex items-center gap-3 text-blue-400">
                <Send className="size-5" />
                <h4 className="text-[11px] font-black uppercase tracking-wider">HTTP Methods</h4>
              </div>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                Use <strong className="text-foreground">GET</strong> for retrieving data, <strong className="text-foreground">POST</strong> to create new resources, <strong className="text-foreground">PUT/PATCH</strong> for updates, and <strong className="text-foreground">DELETE</strong> to remove records. API Request Lab automatically omits the payload body for GET requests according to standard REST protocols.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col gap-5 p-6 bg-amber-500/[0.02] border-amber-500/10 hover:border-amber-500/30 transition-colors">
              <div className="flex items-center gap-3 text-amber-400">
                <Lock className="size-5" />
                <h4 className="text-[11px] font-black uppercase tracking-wider">Authentication</h4>
              </div>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                Modern endpoints usually require a Bearer token or API Key. Navigate to the Auth tab to securely inject Bearer tokens directly into your request headers. Your keys are processed locally and never stored in Toolsy databases.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col gap-5 p-6 bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/30 transition-colors">
              <div className="flex items-center gap-3 text-emerald-400">
                <Braces className="size-5" />
                <h4 className="text-[11px] font-black uppercase tracking-wider">Payload Validation</h4>
              </div>
              <p className="text-[11px] font-medium text-muted/70 leading-relaxed">
                When posting JSON, ensure your headers include <code className="bg-white/10 px-1 py-0.5 rounded text-foreground">Content-Type: application/json</code>. You can use the &quot;Beautify JSON&quot; shortcut in the Body editor to validate and format your payload structure before sending.
              </p>
            </GlassCard>
          </div>
        </section>
      </div>
    </ToolContainer>
  );
}
