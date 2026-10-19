"use client";

import React, { memo, useCallback, useEffect, useRef } from "react";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";
import type { Packet } from "@/lib/pcap";
import { endpoint } from "./format";

const ROW_HEIGHT = 28;
const MAX_HEIGHT = 360;
const APP_PROTOCOLS = new Set(["HTTP", "TLS", "DNS", "DHCP"]);

const COLUMNS =
  "grid grid-cols-[56px_92px_minmax(150px,1fr)_minmax(150px,1fr)_76px_60px_minmax(220px,2fr)] gap-3 items-center px-3";

interface RowData {
  packets: Packet[];
  start: number;
  selectedId: number | null;
  onSelect: (p: Packet) => void;
}

const Row = memo(function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const p = data.packets[index];
  const selected = p.id === data.selectedId;
  const reset = p.flags?.includes("RST");
  return (
    <div
      style={style}
      role="row"
      aria-selected={selected}
      onClick={() => data.onSelect(p)}
      className={`${COLUMNS} cursor-pointer border-b border-border-subtle font-mono text-xs ${
        selected ? "bg-accent/15 text-foreground" : "hover:bg-surface"
      } ${reset && !selected ? "text-red-500 dark:text-red-400" : ""}`}
    >
      <span className="tabular-nums text-muted">{p.id}</span>
      <span className="tabular-nums text-muted">{(p.ts - data.start).toFixed(6)}</span>
      <span className="truncate">{endpoint(p.src, p.srcPort)}</span>
      <span className="truncate">{endpoint(p.dst, p.dstPort)}</span>
      <span className={APP_PROTOCOLS.has(p.protocol) ? "font-semibold text-accent" : ""}>{p.protocol}</span>
      <span className="text-right tabular-nums text-muted">{p.len}</span>
      <span className="truncate font-sans">{p.info}</span>
    </div>
  );
});

interface PacketListProps {
  packets: Packet[];
  start: number;
  selectedId: number | null;
  onSelect: (p: Packet) => void;
}

/** Index of the packet with this id in an id-ascending list, or -1. */
function indexOfId(packets: Packet[], id: number | null): number {
  if (id === null) return -1;
  let lo = 0;
  let hi = packets.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = packets[mid].id;
    if (v === id) return mid;
    if (v < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

export default function PacketList({ packets, start, selectedId, onSelect }: PacketListProps) {
  const listRef = useRef<List<RowData>>(null);

  // Keep the selection visible when it changes (keyboard, filter jump).
  useEffect(() => {
    const i = indexOfId(packets, selectedId);
    if (i >= 0) listRef.current?.scrollToItem(i, "smart");
  }, [packets, selectedId]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (packets.length === 0) return;
      const cur = indexOfId(packets, selectedId);
      const page = Math.floor(MAX_HEIGHT / ROW_HEIGHT);
      let next: number | null = null;
      if (e.key === "ArrowDown") next = Math.min(packets.length - 1, cur + 1);
      else if (e.key === "ArrowUp") next = Math.max(0, cur < 0 ? 0 : cur - 1);
      else if (e.key === "PageDown") next = Math.min(packets.length - 1, cur + page);
      else if (e.key === "PageUp") next = Math.max(0, cur - page);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = packets.length - 1;
      if (next === null) return;
      e.preventDefault();
      onSelect(packets[next]);
    },
    [packets, selectedId, onSelect]
  );

  const height = Math.min(Math.max(packets.length, 1) * ROW_HEIGHT, MAX_HEIGHT);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-[var(--card-bg)]">
      <div className="min-w-[860px]">
        <div role="row" className={`${COLUMNS} border-b border-border bg-surface py-2 text-xs font-medium text-muted`}>
          <span>No.</span>
          <span>Time (s)</span>
          <span>Source</span>
          <span>Destination</span>
          <span>Protocol</span>
          <span className="text-right">Length</span>
          <span>Info</span>
        </div>
        {packets.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No packets match the current filter.</div>
        ) : (
          <div
            role="grid"
            tabIndex={0}
            onKeyDown={onKeyDown}
            aria-label="Packets"
            className="outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <List
              ref={listRef}
              height={height}
              width="100%"
              itemCount={packets.length}
              itemSize={ROW_HEIGHT}
              itemData={{ packets, start, selectedId, onSelect }}
              overscanCount={20}
            >
              {Row}
            </List>
          </div>
        )}
      </div>
    </div>
  );
}
