"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { MapModel, MapPeer, MapSegment } from "@/lib/netconfig";

const CARD_W = 230;
const GAP_X = 90;
const GAP_Y = 14;
const ROW_H = 18;
const PAD = 12;
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

const KIND_LABEL: Record<string, string> = {
  zone: "ZONE",
  vlan: "VLAN",
  subnet: "NETWORK",
  loopback: "LOOPBACK",
  trunk: "TRUNK",
  "next-hop": "NEXT HOP",
  bgp: "NEIGHBOR",
  vpn: "VPN",
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

interface Card {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  rows: { text: string; sub?: string }[];
  extra: number;
  via?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function cardHeight(c: { subtitle?: string; rows: unknown[]; extra: number }): number {
  return 34 + (c.subtitle ? 14 : 0) + c.rows.length * ROW_H + (c.extra ? ROW_H : 0) + PAD - 4;
}

function stack(items: (MapSegment | MapPeer)[], x: number): { cards: Card[]; height: number } {
  let y = 0;
  const cards: Card[] = items.map((it) => {
    const rows = "rows" in it && it.rows.length && typeof it.rows[0] === "string"
      ? (it.rows as string[]).map((t) => ({ text: t }))
      : (it.rows as { text: string; sub?: string }[]);
    const h = cardHeight({ subtitle: it.subtitle, rows, extra: it.extra });
    const card: Card = { id: it.id, kind: it.kind, title: it.title, subtitle: it.subtitle, rows, extra: it.extra, via: "via" in it ? it.via : undefined, x, y, w: CARD_W, h };
    y += h + GAP_Y;
    return card;
  });
  return { cards, height: Math.max(0, y - GAP_Y) };
}

interface Layout {
  left: Card[];
  right: Card[];
  device: Card;
  width: number;
  height: number;
  notes: { x: number; y: number; text: string }[];
}

function layout(m: MapModel): Layout {
  const deviceX = CARD_W + GAP_X;
  const rightX = deviceX + CARD_W + GAP_X;
  const L = stack(m.segments, 0);
  const R = stack(m.peers, rightX);
  const colH = Math.max(L.height, R.height, 160);
  const offL = (colH - L.height) / 2;
  const offR = (colH - R.height) / 2;
  L.cards.forEach((c) => (c.y += offL));
  R.cards.forEach((c) => (c.y += offR));
  const dh = Math.min(Math.max(150, colH * 0.45), 320);
  const device: Card = {
    id: "device",
    kind: "device",
    title: m.title,
    subtitle: m.subtitle,
    rows: [],
    extra: 0,
    x: deviceX,
    y: (colH - dh) / 2,
    w: CARD_W,
    h: dh,
  };
  const notes: Layout["notes"] = [];
  if (m.hiddenSegments) notes.push({ x: 0, y: colH + 22, text: `+${m.hiddenSegments} more on the left — see the tables` });
  if (m.hiddenPeers) notes.push({ x: rightX, y: colH + 22, text: `+${m.hiddenPeers} more on the right — see the tables` });
  return { left: L.cards, right: R.cards, device, width: rightX + CARD_W, height: colH + (notes.length ? 30 : 0), notes };
}

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) / 2;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

export default function TopoMap({ model, fileName }: { model: MapModel; fileName: string }) {
  const lay = useMemo(() => layout(model), [model]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const pad = 24;
    const fitK = Math.min((w - pad * 2) / lay.width, (h - pad * 2) / lay.height, 1.2);
    // on narrow screens keep the text readable and let the user pan instead
    const k = Math.max(fitK, 0.55);
    setView({ k, x: Math.max(pad, (w - lay.width * k) / 2), y: Math.max(pad, (h - lay.height * k) / 2) });
  }, [lay]);

  useLayoutEffect(() => {
    fit();
  }, [fit]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  // wheel zoom needs a non-passive listener to stop the page from scrolling
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      setView((v) => {
        const k = Math.min(3, Math.max(0.15, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        const s = k / v.k;
        return { k, x: px - (px - v.x) * s, y: py - (py - v.y) * s };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (f: number) =>
    setView((v) => {
      const el = wrapRef.current;
      const cx = (el?.clientWidth ?? 0) / 2;
      const cy = (el?.clientHeight ?? 0) / 2;
      const k = Math.min(3, Math.max(0.15, v.k * f));
      const s = k / v.k;
      return { k, x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s };
    });

  const exportSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const g = clone.querySelector<SVGGElement>("g[data-viewport]");
    if (g) g.setAttribute("transform", "translate(24,24)");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(lay.width + 48));
    clone.setAttribute("height", String(lay.height + 48));
    clone.setAttribute("viewBox", `0 0 ${lay.width + 48} ${lay.height + 48}`);
    clone.removeAttribute("style");
    let out = new XMLSerializer().serializeToString(clone);
    const cs = getComputedStyle(document.documentElement);
    out = out.replace(/var\((--[\w-]+)\)/g, (_, name: string) => cs.getPropertyValue(name).trim() || "#888");
    const blob = new Blob([out], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName || "topology"}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const dev = lay.device;
  const spread = (n: number, i: number) => dev.y + 22 + ((dev.h - 44) * (n === 1 ? 0.5 : i / (n - 1)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted">Scroll to zoom, drag to move. Ports are grouped, the full list is in the Interfaces tab.</p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => zoomBy(1.2)} className="toolsy-button-secondary p-2 rounded-lg" aria-label="Zoom in"><ZoomIn className="size-4" /></button>
          <button type="button" onClick={() => zoomBy(1 / 1.2)} className="toolsy-button-secondary p-2 rounded-lg" aria-label="Zoom out"><ZoomOut className="size-4" /></button>
          <button type="button" onClick={fit} className="toolsy-button-secondary p-2 rounded-lg" aria-label="Fit to view"><Maximize2 className="size-4" /></button>
          <button type="button" onClick={exportSvg} className="toolsy-button-secondary px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"><Download className="size-4" /> SVG</button>
        </div>
      </div>
      <div ref={wrapRef} className="relative overflow-hidden rounded-xl border border-border bg-surface max-h-[70svh]" style={{ height: Math.min(620, Math.max(300, lay.height + 70)) }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="touch-none cursor-grab active:cursor-grabbing select-none"
          role="img"
          aria-label={`Network map of ${model.title}`}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY };
            (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            drag.current = { x: e.clientX, y: e.clientY };
            setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <g data-viewport transform={`translate(${view.x},${view.y}) scale(${view.k})`} fontFamily={FONT}>
            {/* edges */}
            {lay.left.map((c, i) => (
              <path key={`el-${c.id}`} d={edgePath(c.x + c.w, c.y + c.h / 2, dev.x, spread(lay.left.length, i))} fill="none" stroke="var(--accent)" strokeOpacity={hover && hover !== c.id ? 0.12 : 0.55} strokeWidth={1.5} />
            ))}
            {lay.right.map((c, i) => (
              <g key={`er-${c.id}`}>
                <path d={edgePath(dev.x + dev.w, spread(lay.right.length, i), c.x, c.y + c.h / 2)} fill="none" stroke="var(--accent)" strokeOpacity={hover && hover !== c.id ? 0.12 : 0.55} strokeWidth={1.5} strokeDasharray={c.kind === "vpn" ? "5 4" : undefined} />
              </g>
            ))}

            {/* device */}
            <g>
              <rect x={dev.x} y={dev.y} width={dev.w} height={dev.h} rx={12} fill="var(--surface-raised)" stroke="var(--accent)" strokeWidth={2} />
              <text x={dev.x + dev.w / 2} y={dev.y + dev.h / 2 - 4} textAnchor="middle" fontSize={17} fontWeight={700} fill="var(--foreground)">{clip(dev.title, 24)}</text>
              {dev.subtitle && (
                <text x={dev.x + dev.w / 2} y={dev.y + dev.h / 2 + 16} textAnchor="middle" fontSize={11} fill="var(--muted)">{clip(dev.subtitle, 38)}</text>
              )}
            </g>

            {[...lay.left, ...lay.right].map((c) => (
              <g key={c.id} onPointerEnter={() => setHover(c.id)} onPointerLeave={() => setHover(null)} opacity={hover && hover !== c.id ? 0.55 : 1}>
                <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={10} fill="var(--surface-raised)" stroke="var(--border)" strokeWidth={1} />
                <text x={c.x + PAD} y={c.y + 15} fontSize={8.5} fontWeight={700} letterSpacing="0.12em" fill="var(--accent)">{KIND_LABEL[c.kind] ?? c.kind.toUpperCase()}</text>
                <text x={c.x + PAD} y={c.y + 31} fontSize={13} fontWeight={600} fill="var(--foreground)">{clip(c.title, 30)}</text>
                {c.subtitle && <text x={c.x + PAD} y={c.y + 45} fontSize={10.5} fill="var(--muted)">{clip(c.subtitle, 40)}</text>}
                {c.rows.map((r, i) => {
                  const ry = c.y + 34 + (c.subtitle ? 14 : 0) + 14 + i * ROW_H;
                  return (
                    <g key={i}>
                      <text x={c.x + PAD} y={ry} fontSize={11} fill="var(--foreground)">{clip(r.text, r.sub ? 17 : 36)}</text>
                      {r.sub && <text x={c.x + c.w - PAD} y={ry} fontSize={10.5} textAnchor="end" fill="var(--muted)" fontFamily="ui-monospace, Consolas, monospace">{clip(r.sub, 24)}</text>}
                    </g>
                  );
                })}
                {c.extra > 0 && (
                  <text x={c.x + PAD} y={c.y + 34 + (c.subtitle ? 14 : 0) + 14 + c.rows.length * ROW_H} fontSize={10.5} fill="var(--muted)">+{c.extra} more</text>
                )}
              </g>
            ))}

            {lay.notes.map((n, i) => (
              <text key={i} x={n.x} y={n.y} fontSize={11} fill="var(--muted)">{n.text}</text>
            ))}
          </g>
        </svg>
        {lay.left.length === 0 && lay.right.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">Nothing to draw yet. No networks, VLANs or peers were found.</div>
        )}
      </div>
    </div>
  );
}
