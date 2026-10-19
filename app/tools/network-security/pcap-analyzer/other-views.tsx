"use client";

import React, { useMemo, useState } from "react";
import { Copy, Download, GitMerge, X } from "lucide-react";
import { followStream, toPrintable, type Capture, type Host, type Ioc, type Stream } from "@/lib/pcap";
import { ToolButton } from "@/components/tools";
import { copyText, downloadBlob, endpoint, formatBytes, formatDuration } from "./format";

const ROW_CAP = 500;
const FOLLOW_CAP = 64 * 1024;

const wrap = "overflow-x-auto rounded-xl border border-border bg-[var(--card-bg)]";
const head = "border-b border-border bg-surface px-3 py-2 text-xs font-medium text-muted";
const cell = "px-3 py-2 text-xs";
const rowCls = "border-b border-border-subtle hover:bg-surface";

function CapNote({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null;
  return <p className="px-3 py-2 text-xs text-muted">Showing the first {shown} of {total.toLocaleString()}. Use the search box to narrow down.</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-12 text-center text-sm text-muted">{children}</div>;
}

/* --------------------------------- Streams -------------------------------- */

type StreamSort = "id" | "packets" | "bytes" | "duration";

const STATE_LABEL: Record<NonNullable<Stream["state"]>, string> = {
  open: "Open",
  closed: "Closed",
  reset: "Reset",
  partial: "Partial",
};

export function StreamsView({
  capture,
  search,
  onOpen,
  onFollow,
}: {
  capture: Capture;
  search: string;
  onOpen: (id: number) => void;
  onFollow: (id: number) => void;
}) {
  const [sort, setSort] = useState<StreamSort>("id");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? capture.streams.filter((s) =>
          `${s.a}:${s.aPort ?? ""} ${s.b}:${s.bPort ?? ""} ${s.app} ${s.protocol} ${s.names.join(" ")}`.toLowerCase().includes(q)
        )
      : capture.streams;
    return sort === "id" ? list : [...list].sort((x, y) => y[sort] - x[sort]);
  }, [capture.streams, search, sort]);

  const th = (key: StreamSort, label: string, right = false) => (
    <button
      type="button"
      onClick={() => setSort(key)}
      className={`${right ? "text-right" : "text-left"} hover:text-foreground ${sort === key ? "text-accent" : ""}`}
    >
      {label}
    </button>
  );

  return (
    <div className={wrap}>
      <div className="min-w-[900px]">
        <div className={`${head} grid grid-cols-[48px_72px_minmax(180px,1fr)_minmax(180px,1fr)_80px_90px_90px_72px_120px] items-center gap-3`}>
          {th("id", "#")}
          <span>Protocol</span>
          <span>Initiator</span>
          <span>Responder</span>
          {th("packets", "Packets", true)}
          {th("bytes", "Bytes", true)}
          {th("duration", "Duration", true)}
          <span>State</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <Empty>No streams found.</Empty>
        ) : (
          rows.slice(0, ROW_CAP).map((s) => (
            <div
              key={s.id}
              onClick={() => onOpen(s.id)}
              className={`${rowCls} ${cell} grid cursor-pointer grid-cols-[48px_72px_minmax(180px,1fr)_minmax(180px,1fr)_80px_90px_90px_72px_120px] items-center gap-3`}
            >
              <span className="text-muted tabular-nums">{s.id}</span>
              <span className={s.app !== s.protocol ? "font-semibold text-accent" : ""}>{s.app}</span>
              <span className="truncate font-mono">{endpoint(s.a, s.aPort)}</span>
              <span className="truncate font-mono">
                {endpoint(s.b, s.bPort)}
                {s.names[0] && <span className="ml-2 font-sans text-muted">{s.names[0]}</span>}
              </span>
              <span className="text-right tabular-nums">{s.packets.toLocaleString()}</span>
              <span className="text-right tabular-nums">{formatBytes(s.bytes)}</span>
              <span className="text-right tabular-nums">{formatDuration(s.duration)}</span>
              <span className={s.state === "reset" ? "text-red-500 dark:text-red-400" : "text-muted"}>
                {s.state ? STATE_LABEL[s.state] : ""}
              </span>
              <span className="text-right">
                {s.protocol === "TCP" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFollow(s.id);
                    }}
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    <GitMerge className="size-3.5" /> Follow
                  </button>
                )}
              </span>
            </div>
          ))
        )}
        <CapNote shown={ROW_CAP} total={rows.length} />
      </div>
    </div>
  );
}

/* ---------------------------------- Hosts --------------------------------- */

export function HostsView({
  hosts,
  search,
  onOpen,
}: {
  hosts: Host[];
  search: string;
  onOpen: (address: string) => void;
}) {
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? hosts.filter((h) => `${h.address} ${h.names.join(" ")} ${h.scope}`.toLowerCase().includes(q)) : hosts;
  }, [hosts, search]);

  const grid = "grid grid-cols-[minmax(160px,1fr)_80px_minmax(180px,2fr)_110px_110px_110px_110px] items-center gap-3";

  return (
    <div className={wrap}>
      <div className="min-w-[900px]">
        <div className={`${head} ${grid}`}>
          <span>Address</span>
          <span>Scope</span>
          <span>Names</span>
          <span className="text-right">Packets out</span>
          <span className="text-right">Packets in</span>
          <span className="text-right">Bytes out</span>
          <span className="text-right">Bytes in</span>
        </div>
        {rows.length === 0 ? (
          <Empty>No hosts found.</Empty>
        ) : (
          rows.slice(0, ROW_CAP).map((h) => (
            <div key={h.address} onClick={() => onOpen(h.address)} className={`${rowCls} ${cell} ${grid} cursor-pointer`}>
              <span className="truncate font-mono">{h.address}</span>
              <span className="text-muted">{h.scope === "public" ? "Public" : h.scope === "private" ? "Private" : "Special"}</span>
              <span className="truncate text-muted">{h.names.join(", ")}</span>
              <span className="text-right tabular-nums">{h.packetsSent.toLocaleString()}</span>
              <span className="text-right tabular-nums">{h.packetsReceived.toLocaleString()}</span>
              <span className="text-right tabular-nums">{formatBytes(h.bytesSent)}</span>
              <span className="text-right tabular-nums">{formatBytes(h.bytesReceived)}</span>
            </div>
          ))
        )}
        <CapNote shown={ROW_CAP} total={rows.length} />
      </div>
    </div>
  );
}

/* -------------------------------- Indicators ------------------------------ */

type IocFilter = "ALL" | Ioc["type"];

export function IndicatorsView({
  iocs,
  search,
  onOpen,
}: {
  iocs: Ioc[];
  search: string;
  onOpen: (ioc: Ioc) => void;
}) {
  const [type, setType] = useState<IocFilter>("ALL");
  const [publicOnly, setPublicOnly] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return iocs.filter(
      (i) =>
        (type === "ALL" || i.type === type) &&
        (!publicOnly || i.type !== "IP" || i.scope === "public") &&
        (!q || i.value.toLowerCase().includes(q))
    );
  }, [iocs, search, type, publicOnly]);

  const counts = useMemo(() => {
    const c = { ALL: iocs.length, IP: 0, DOMAIN: 0, URL: 0 };
    for (const i of iocs) c[i.type]++;
    return c;
  }, [iocs]);

  const tabs: { id: IocFilter; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "DOMAIN", label: "Domains" },
    { id: "IP", label: "IP addresses" },
    { id: "URL", label: "URLs" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              type === t.id ? "border-accent/40 bg-accent/15 text-accent" : "border-border text-muted hover:text-foreground"
            }`}
          >
            {t.label} <span className="tabular-nums opacity-70">{counts[t.id]}</span>
          </button>
        ))}
        <label className="ml-2 flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={publicOnly} onChange={(e) => setPublicOnly(e.target.checked)} className="accent-[var(--accent)]" />
          Public IPs only
        </label>
        <ToolButton
          size="sm"
          variant="secondary"
          className="ml-auto"
          disabled={rows.length === 0}
          iconLeft={<Copy className="size-3.5" />}
          onClick={() => copyText(rows.map((r) => r.value).join("\n"))}
        >
          Copy {rows.length.toLocaleString()} shown
        </ToolButton>
      </div>

      <div className={wrap}>
        <div className="min-w-[560px]">
          <div className={`${head} grid grid-cols-[88px_minmax(200px,1fr)_72px_48px] items-center gap-3`}>
            <span>Type</span>
            <span>Value</span>
            <span className="text-right">Seen</span>
            <span />
          </div>
          {rows.length === 0 ? (
            <Empty>No indicators found.</Empty>
          ) : (
            rows.slice(0, ROW_CAP).map((i) => (
              <div
                key={`${i.type}|${i.value}`}
                onClick={() => onOpen(i)}
                className={`${rowCls} ${cell} grid cursor-pointer grid-cols-[88px_minmax(200px,1fr)_72px_48px] items-center gap-3`}
              >
                <span className="text-muted">
                  {i.type === "IP" ? "IP" : i.type === "DOMAIN" ? "Domain" : "URL"}
                  {i.scope && i.scope !== "public" ? ` (${i.scope})` : ""}
                </span>
                <span className="truncate font-mono">{i.value}</span>
                <span className="text-right tabular-nums">{i.count.toLocaleString()}</span>
                <span className="text-right">
                  <button
                    type="button"
                    aria-label={`Copy ${i.value}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      copyText(i.value);
                    }}
                    className="text-muted hover:text-accent"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </span>
              </div>
            ))
          )}
          <CapNote shown={ROW_CAP} total={rows.length} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Follow stream ----------------------------- */

export function FollowStream({
  capture,
  streamId,
  onClose,
  onShowPackets,
}: {
  capture: Capture;
  streamId: number;
  onClose: () => void;
  onShowPackets: () => void;
}) {
  const stream = capture.streams[streamId];
  const segments = useMemo(() => followStream(capture, streamId), [capture, streamId]);
  if (!stream) return null;

  const total = segments.reduce((n, s) => n + s.data.length, 0);
  const text = segments.map((s) => toPrintable(s.data));
  const aBytes = segments.filter((s) => s.dir === "a→b").reduce((n, s) => n + s.data.length, 0);

  let budget = FOLLOW_CAP;
  const shown = text.map((t) => {
    const slice = t.slice(0, Math.max(0, budget));
    budget -= slice.length;
    return slice;
  });

  const download = () => {
    const parts = segments.map((s) => s.data as BlobPart);
    downloadBlob(new Blob(parts), `stream-${streamId}.bin`, "application/octet-stream");
  };

  return (
    <div className="rounded-xl border border-border bg-[var(--card-bg)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="mr-auto min-w-0">
          <h2 className="text-sm font-semibold">Stream {streamId}</h2>
          <p className="truncate font-mono text-xs text-muted">
            {endpoint(stream.a, stream.aPort)} → {endpoint(stream.b, stream.bPort)}
            {" · "}
            {formatBytes(aBytes)} sent, {formatBytes(total - aBytes)} received
          </p>
        </div>
        <ToolButton size="sm" variant="secondary" onClick={onShowPackets}>
          Show packets
        </ToolButton>
        <ToolButton size="sm" variant="secondary" iconLeft={<Copy className="size-3.5" />} disabled={total === 0} onClick={() => copyText(text.join(""))}>
          Copy text
        </ToolButton>
        <ToolButton size="sm" variant="secondary" iconLeft={<Download className="size-3.5" />} disabled={total === 0} onClick={download}>
          Download
        </ToolButton>
        <ToolButton size="sm" variant="ghost" iconLeft={<X className="size-3.5" />} onClick={onClose}>
          Close
        </ToolButton>
      </div>

      <div className="flex max-h-[520px] flex-col gap-2 overflow-auto p-4">
        {segments.length === 0 ? (
          <Empty>This stream carries no application data.</Empty>
        ) : (
          segments.map((s, i) => (
            <pre
              key={i}
              className={`whitespace-pre-wrap break-all rounded-lg border-l-2 px-3 py-2 font-mono text-xs ${
                s.dir === "a→b" ? "border-accent bg-accent/10" : "border-border bg-surface"
              }`}
            >
              {shown[i]}
              {shown[i].length < text[i].length && <span className="text-muted">{"\n"}… truncated, download for the full data</span>}
            </pre>
          ))
        )}
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-muted">
        Teal blocks are sent by the initiator, grey blocks by the responder. Encrypted (TLS) streams show as unreadable bytes.
      </p>
    </div>
  );
}
