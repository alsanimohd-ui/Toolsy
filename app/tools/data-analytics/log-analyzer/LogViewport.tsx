"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Level, Row } from "@/lib/log-store";

const ROW_H = 22;
const BLOCK = 200;
/** Browsers cap element height (~33M px), so very long views are scaled onto this height. */
const MAX_HEIGHT = 15_000_000;

export interface RowsResponse {
  version: number;
  start: number;
  rows: Row[];
}

interface LogViewportProps {
  total: number;
  version: number;
  fetchRows: (start: number, end: number) => Promise<RowsResponse>;
  highlight: RegExp | null;
  /** Scrolls so this row is near the top whenever `nonce` changes. */
  jump: { row: number; nonce: number } | null;
  selected: number;
  onSelect: (row: number) => void;
  height?: number;
}

const LEVEL_TEXT: Record<Level, string> = {
  CRITICAL: "text-red-500 font-semibold",
  ERROR: "text-red-400",
  WARN: "text-amber-400",
  INFO: "text-foreground/80",
  DEBUG: "text-muted",
};
const LEVEL_BAR: Record<Level, string> = {
  CRITICAL: "bg-red-500",
  ERROR: "bg-red-400",
  WARN: "bg-amber-400",
  INFO: "bg-transparent",
  DEBUG: "bg-transparent",
};

function renderText(text: string, re: RegExp | null) {
  if (!re) return text;
  const parts: (string | JSX.Element)[] = [];
  re.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0] === "") {
      re.lastIndex++;
      continue;
    }
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <mark key={m.index} className="rounded-sm bg-accent/30 px-0.5 text-foreground">
        {m[0]}
      </mark>
    );
    last = m.index + m[0].length;
  }
  if (last === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function LogViewport({ total, version, fetchRows, highlight, jump, selected, onSelect, height = 560 }: LogViewportProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<number, Row[]>());
  const inflight = useRef(new Set<number>());
  const versionRef = useRef(version);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientH, setClientH] = useState(height);
  const [, setRevision] = useState(0);

  // New query result: drop everything cached for the old view.
  useLayoutEffect(() => {
    versionRef.current = version;
    cache.current.clear();
    inflight.current.clear();
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    setScrollTop(0);
    setRevision((r) => r + 1);
  }, [version]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => setClientH(el.clientHeight || height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const fullHeight = total * ROW_H;
  const scaled = fullHeight > MAX_HEIGHT;
  const innerHeight = Math.max(Math.min(fullHeight, MAX_HEIGHT), 1);
  const visibleRows = clientH / ROW_H;
  const maxScroll = Math.max(innerHeight - clientH, 0);

  const firstRow = useMemo(() => {
    if (total <= visibleRows || maxScroll === 0) return 0;
    return Math.max(0, Math.min(total - 1, Math.floor((scrollTop / maxScroll) * (total - visibleRows))));
  }, [scrollTop, maxScroll, total, visibleRows]);
  const offsetPx = scaled || total <= visibleRows ? 0 : scrollTop - firstRow * ROW_H;
  const count = Math.min(Math.ceil(visibleRows) + 1, total - firstRow);

  // Fetch the blocks around the window. A layout effect so it does not wait for a paint.
  useLayoutEffect(() => {
    if (total === 0) return;
    const lo = Math.max(0, firstRow - Math.ceil(visibleRows));
    const hi = Math.min(total - 1, firstRow + Math.ceil(visibleRows) * 2);
    for (let b = Math.floor(lo / BLOCK); b <= Math.floor(hi / BLOCK); b++) {
      if (cache.current.has(b) || inflight.current.has(b)) continue;
      inflight.current.add(b);
      const requestedVersion = versionRef.current;
      fetchRows(b * BLOCK, (b + 1) * BLOCK).then((res) => {
        inflight.current.delete(b);
        if (res.version !== versionRef.current || requestedVersion !== versionRef.current) return;
        cache.current.set(b, res.rows);
        setRevision((r) => r + 1);
      });
    }
  }, [firstRow, visibleRows, total, version, fetchRows]);

  const scrollToRow = useCallback(
    (row: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const target = Math.max(0, row - 3);
      const denom = total - visibleRows;
      el.scrollTop = denom <= 0 || maxScroll === 0 ? 0 : (target / denom) * maxScroll;
    },
    [total, visibleRows, maxScroll]
  );

  useEffect(() => {
    if (jump && jump.row >= 0) scrollToRow(jump.row);
    // Only react to a new jump request, not to resizes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.nonce]);

  const rows: (Row | undefined)[] = [];
  for (let r = firstRow; r < firstRow + count; r++) {
    rows.push(cache.current.get(Math.floor(r / BLOCK))?.[r % BLOCK]);
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="relative overflow-auto rounded-xl border border-border bg-background font-mono text-[12px]"
      style={{ height }}
      role="log"
      aria-label="Log lines"
      tabIndex={0}
    >
      <div style={{ height: innerHeight }}>
        <div className="sticky top-0 w-max min-w-full" style={{ height: clientH, overflowY: "hidden" }}>
          <div style={{ transform: `translateY(${-offsetPx}px)` }}>
            {rows.map((row, i) => {
              const r = firstRow + i;
              if (!row) return <div key={r} style={{ height: ROW_H }} />;
              const dim = !row.match;
              return (
                <div
                  key={r}
                  onClick={() => onSelect(r)}
                  className={`flex cursor-default items-center whitespace-pre hover:bg-surface ${r === selected ? "bg-accent/10" : ""} ${dim ? "opacity-50" : ""}`}
                  style={{ height: ROW_H, lineHeight: `${ROW_H}px` }}
                >
                  <span className={`sticky left-0 z-10 flex h-full shrink-0 items-center bg-background ${r === selected ? "bg-accent/10" : ""}`}>
                    <span className={`h-full w-[3px] ${LEVEL_BAR[row.level]}`} />
                    <span className="w-[72px] select-none pr-3 text-right text-[11px] text-muted/70">{row.line + 1}</span>
                  </span>
                  <span className={`${LEVEL_TEXT[row.level]} ${row.stack ? "pl-6 italic opacity-70" : ""}`}>
                    {renderText(row.text, row.match ? highlight : null)}
                  </span>
                  {row.rep > 1 && (
                    <span className="ml-3 shrink-0 rounded border border-accent/30 bg-accent/10 px-1.5 text-[10px] font-semibold text-accent">
                      ×{row.rep}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
