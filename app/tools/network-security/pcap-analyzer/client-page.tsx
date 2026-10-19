"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, FileSpreadsheet, FolderOpen, HelpCircle, Loader2, Search, Upload, X } from "lucide-react";
import { ToolContainer, ToolHeader, ToolButton } from "@/components/tools";
import { compileFilter, parseCapture, type Capture, type Ioc, type Packet } from "@/lib/pcap";
import PacketList from "./packet-list";
import PacketDetails from "./packet-details";
import { FollowStream, HostsView, IndicatorsView, StreamsView } from "./other-views";
import { downloadBlob, formatBytes, formatDuration } from "./format";

type Tab = "packets" | "streams" | "hosts" | "indicators";

const MAX_FILE_BYTES = 256 * 1024 * 1024;

const FILTER_EXAMPLES: { query: string; hint: string }[] = [
  { query: "ip:10.0.0.0/8", hint: "Address, prefix (10.1.) or CIDR block" },
  { query: "src:192.168.1.5", hint: "Only traffic from this address" },
  { query: "dst:8.8.8.8", hint: "Only traffic to this address" },
  { query: "port:443", hint: "Source or destination port (sport: / dport:)" },
  { query: "proto:dns", hint: "Protocol. A bare word like dns works too" },
  { query: "syn !ack", hint: "TCP flags. Start a term with ! or - to exclude it" },
  { query: "host:example.com", hint: "DNS, HTTP Host and TLS server names" },
  { query: 'data:"password"', hint: "Search inside packet payloads" },
  { query: "len:>1000", hint: "Length. Use >, <, >=, <=" },
  { query: "stream:3", hint: "One TCP/UDP stream by its number" },
];

export default function PcapAnalyzerClient() {
  const [capture, setCapture] = useState<Capture | null>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [loadingName, setLoadingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [tab, setTab] = useState<Tab>("packets");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [protos, setProtos] = useState<Set<string>>(new Set());
  const [showHelp, setShowHelp] = useState(false);
  const [selected, setSelected] = useState<Packet | null>(null);
  const [followId, setFollowId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    if (f.size > MAX_FILE_BYTES) {
      setError(`${f.name} is ${formatBytes(f.size)}. Files above ${formatBytes(MAX_FILE_BYTES)} are too large to analyse in the browser. Trim it first, for example with editcap or tcpdump -r in.pcap -c 500000 -w out.pcap.`);
      return;
    }
    setLoadingName(f.name);
    try {
      // Let the loading state paint before the synchronous parse blocks the thread.
      await new Promise((r) => setTimeout(r, 30));
      const parsed = parseCapture(await f.arrayBuffer());
      setCapture(parsed);
      setFile({ name: f.name, size: f.size });
      setTab("packets");
      setQuery("");
      setSearch("");
      setProtos(new Set());
      setSelected(null);
      setFollowId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const predicate = useMemo(() => compileFilter(query), [query]);

  const filteredPackets = useMemo(() => {
    if (!capture) return [];
    if (!query.trim() && protos.size === 0) return capture.packets;
    return capture.packets.filter((p) => (protos.size === 0 || protos.has(p.protocol)) && predicate(p));
  }, [capture, query, protos, predicate]);

  const protocolList = useMemo(
    () => (capture ? Object.entries(capture.stats.protocols).sort((a, b) => b[1] - a[1]).slice(0, 10) : []),
    [capture]
  );

  const showPackets = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
    setProtos(new Set());
    setFollowId(null);
    setTab("packets");
  }, []);

  const addTerm = useCallback((term: string) => {
    setQuery((q) => (q.split(/\s+/).includes(term) ? q : `${q} ${term}`.trim()));
  }, []);

  const toggleProto = (p: string) => {
    setProtos((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const openIoc = (ioc: Ioc) => {
    if (ioc.type === "IP") showPackets(`ip:${ioc.value}`);
    else if (ioc.type === "DOMAIN") showPackets(`host:${ioc.value}`);
    else {
      const path = ioc.value.replace(/^http:\/\/[^/]*/, "");
      showPackets(`data:"${path}"`);
    }
  };

  const exportCsv = () => {
    if (!capture || filteredPackets.length === 0) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ["No.", "Time", "Source", "Source port", "Destination", "Destination port", "Protocol", "Length", "Flags", "Info"];
    const rows = filteredPackets.map((p) =>
      [p.id, (p.ts - capture.stats.start).toFixed(6), p.src, p.srcPort ?? "", p.dst, p.dstPort ?? "", p.protocol, p.len, p.flags?.join(" ") ?? "", p.info].map(esc).join(",")
    );
    downloadBlob([header.map(esc).join(","), ...rows].join("\n"), `${file?.name ?? "capture"}.csv`, "text/csv;charset=utf-8");
  };

  const closeCapture = () => {
    setCapture(null);
    setFile(null);
    setSelected(null);
    setFollowId(null);
    setError(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFile(e.dataTransfer.files[0]);
  };

  const tabs: { id: Tab; label: string; count: number }[] = capture
    ? [
        { id: "packets", label: "Packets", count: capture.packets.length },
        { id: "streams", label: "Streams", count: capture.streams.length },
        { id: "hosts", label: "Hosts", count: capture.hosts.length },
        { id: "indicators", label: "Indicators", count: capture.iocs.length },
      ]
    : [];

  const isPacketTab = tab === "packets";
  const filterActive = query.trim() !== "" || protos.size > 0;

  return (
    <ToolContainer categoryId="network-security">
      <ToolHeader
        title="PCAP Analyzer"
        description="Open a .pcap or .pcapng file to browse its packets, streams, hosts and indicators. The file is read in your browser and never uploaded."
        categoryId="network-security"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".pcap,.pcapng,.cap"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setError(null)} className="ml-auto shrink-0">
            <X className="size-4" />
          </button>
        </div>
      )}

      {loadingName && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-[var(--card-bg)] px-5 py-10 text-sm text-muted" role="status">
          <Loader2 className="size-5 animate-spin text-accent" />
          Analysing {loadingName}…
        </div>
      )}

      {/* Empty state */}
      {!capture && !loadingName && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-16 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
            isDragging ? "border-accent bg-accent/10" : "border-border bg-[var(--card-bg)] hover:border-accent/50"
          }`}
        >
          <Upload className="size-8 text-accent" />
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold">Drop a capture file here, or click to choose one</p>
            <p className="text-sm text-muted">.pcap, .pcapng and .cap, up to {formatBytes(MAX_FILE_BYTES)}</p>
          </div>
          <p className="max-w-xl text-xs text-muted">
            Decodes Ethernet, VLAN, IPv4, IPv6, ARP, TCP, UDP, ICMP, DNS, HTTP, TLS (server name) and DHCP. Packets are grouped into real
            streams, and domains, IPs and URLs are collected for you.
          </p>
        </div>
      )}

      {/* Workspace */}
      {capture && !loadingName && (
        <div className="flex flex-col gap-4" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          {/* File summary */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-[var(--card-bg)] px-4 py-3">
            <div className="min-w-0 mr-auto">
              <p className="truncate text-sm font-semibold">{file?.name}</p>
              <p className="text-xs text-muted">
                {capture.format === "pcapng" ? "pcapng" : "pcap"} · {file ? formatBytes(file.size) : ""} ·{" "}
                {capture.stats.totalPackets.toLocaleString()} packets · {formatDuration(capture.stats.duration)} ·{" "}
                {capture.streams.length.toLocaleString()} streams · {capture.hosts.length.toLocaleString()} hosts
                {capture.stats.start > 0 && <> · {new Date(capture.stats.start * 1000).toLocaleString()}</>}
              </p>
            </div>
            <ToolButton size="sm" variant="secondary" iconLeft={<FolderOpen className="size-3.5" />} onClick={() => fileInputRef.current?.click()}>
              Open another
            </ToolButton>
            <ToolButton size="sm" variant="ghost" iconLeft={<X className="size-3.5" />} onClick={closeCapture}>
              Close
            </ToolButton>
          </div>

          {capture.warnings.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" />
              <div className="flex flex-col gap-1">
                {capture.warnings.map((w, i) => (
                  <span key={i}>{w}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  setFollowId(null);
                }}
                className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm transition-colors ${
                  tab === t.id ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {t.label} <span className="ml-1 text-xs tabular-nums text-muted">{t.count.toLocaleString()}</span>
              </button>
            ))}
          </div>

          {/* Search / filter bar */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={isPacketTab ? query : search}
                  onChange={(e) => (isPacketTab ? setQuery(e.target.value) : setSearch(e.target.value))}
                  placeholder={isPacketTab ? "Filter packets, e.g. ip:10.0.0.5 port:443 dns" : `Search ${tab}`}
                  aria-label={isPacketTab ? "Packet filter" : `Search ${tab}`}
                  spellCheck={false}
                  className="h-10 w-full rounded-xl border border-border bg-[var(--input-bg)] pl-9 pr-9 font-mono text-sm outline-none transition-colors focus:border-accent focus:bg-[var(--input-focus-bg)]"
                />
                {(isPacketTab ? query : search) && (
                  <button
                    type="button"
                    aria-label="Clear"
                    onClick={() => (isPacketTab ? setQuery("") : setSearch(""))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {isPacketTab && (
                <>
                  <ToolButton size="sm" variant="secondary" iconLeft={<HelpCircle className="size-3.5" />} onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>
                    Filter syntax
                  </ToolButton>
                  <ToolButton size="sm" variant="secondary" iconLeft={<FileSpreadsheet className="size-3.5" />} onClick={exportCsv} disabled={filteredPackets.length === 0}>
                    Export CSV
                  </ToolButton>
                </>
              )}
            </div>

            {isPacketTab && showHelp && (
              <div className="grid gap-x-6 gap-y-1 rounded-xl border border-border bg-surface p-4 text-xs sm:grid-cols-2">
                <p className="text-muted sm:col-span-2">Terms are combined with AND. Click an example to use it.</p>
                {FILTER_EXAMPLES.map((ex) => (
                  <button
                    key={ex.query}
                    type="button"
                    onClick={() => addTerm(ex.query)}
                    className="flex items-baseline gap-3 rounded-md px-2 py-1 text-left hover:bg-accent/10"
                  >
                    <code className="shrink-0 font-mono text-accent">{ex.query}</code>
                    <span className="text-muted">{ex.hint}</span>
                  </button>
                ))}
              </div>
            )}

            {isPacketTab && (
              <div className="flex flex-wrap items-center gap-2">
                {protocolList.map(([name, count]) => {
                  const active = protos.has(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleProto(name)}
                      className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                        active ? "border-accent/40 bg-accent/15 text-accent" : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {name} <span className="tabular-nums opacity-70">{count.toLocaleString()}</span>
                    </button>
                  );
                })}
                <span className="ml-auto text-xs text-muted">
                  {filterActive
                    ? `${filteredPackets.length.toLocaleString()} of ${capture.packets.length.toLocaleString()} packets`
                    : `${capture.packets.length.toLocaleString()} packets`}
                  {filterActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setProtos(new Set());
                      }}
                      className="ml-3 text-accent hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          {followId !== null ? (
            <FollowStream
              capture={capture}
              streamId={followId}
              onClose={() => setFollowId(null)}
              onShowPackets={() => showPackets(`stream:${followId}`)}
            />
          ) : (
            <>
              {tab === "packets" && (
                <div className="flex flex-col gap-4">
                  <PacketList packets={filteredPackets} start={capture.stats.start} selectedId={selected?.id ?? null} onSelect={setSelected} />
                  <PacketDetails packet={selected} onFilter={addTerm} onFollow={setFollowId} />
                </div>
              )}
              {tab === "streams" && (
                <StreamsView capture={capture} search={search} onOpen={(id) => showPackets(`stream:${id}`)} onFollow={setFollowId} />
              )}
              {tab === "hosts" && <HostsView hosts={capture.hosts} search={search} onOpen={(addr) => showPackets(`ip:${addr}`)} />}
              {tab === "indicators" && <IndicatorsView iocs={capture.iocs} search={search} onOpen={openIoc} />}
            </>
          )}
        </div>
      )}
    </ToolContainer>
  );
}
