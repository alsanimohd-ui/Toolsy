"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, Database, Code2 } from "lucide-react";
import { categoryList, tools } from "@/lib/tools";
import type { CategoryId } from "@/lib/tools";

// ─────────────────────────────────────────────────────────────
// TYPES & ICONS
// ─────────────────────────────────────────────────────────────

interface RadialMenuProps {
  activeSegment?: CategoryId | null;
  onActiveSegmentChange?: (segment: CategoryId | null) => void;
}

const toolIcons: Record<string, React.ElementType> = {
  "network-security": ShieldCheck,
  "data-analytics": Database,
  "dev-automation": Code2,
};

// ─────────────────────────────────────────────────────────────
// SVG GEOMETRY — clean constants
// ─────────────────────────────────────────────────────────────

const CX = 500;
const CY = 500;
const ARC_R = 320;          // arc center-line radius
const ARC_HALF = 18;        // half-width — Apple Watch ring proportions
const ARC_INNER = ARC_R - ARC_HALF;
const ARC_OUTER = ARC_R + ARC_HALF;
const NODE_R = ARC_OUTER + 108;
const LABEL_R = ARC_R;
const GAP_DEG = 10;         // gap between segments

// ─────────────────────────────────────────────────────────────
// SPRING & EASING
// ─────────────────────────────────────────────────────────────

const SPRING: { type: "spring"; stiffness: number; damping: number; mass: number } = {
  type: "spring",
  stiffness: 380,
  damping: 28,
  mass: 0.7,
};

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ─────────────────────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, start: number, end: number, sweep = 1) {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = Math.abs(end - start) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} ${sweep} ${e.x} ${e.y}`;
}

// Closed donut-slice path with ROUNDED end caps (capsule-style).
// Each end gets a semicircle whose radius = half the band width.
function annularPath(
  cx: number, cy: number,
  innerR: number, outerR: number,
  startDeg: number, endDeg: number
) {
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const capR = (outerR - innerR) / 2;

  const so = polar(cx, cy, outerR, startDeg);
  const eo = polar(cx, cy, outerR, endDeg);
  const ei = polar(cx, cy, innerR, endDeg);
  const si = polar(cx, cy, innerR, startDeg);

  return [
    // Start at outer-start corner
    `M ${so.x} ${so.y}`,
    // Outer arc → outer-end corner
    `A ${outerR} ${outerR} 0 ${large} 1 ${eo.x} ${eo.y}`,
    // End cap semicircle (outer-end → inner-end, clockwise around cap centre)
    `A ${capR} ${capR} 0 0 1 ${ei.x} ${ei.y}`,
    // Inner arc back (inner-end → inner-start, reverse sweep)
    `A ${innerR} ${innerR} 0 ${large} 0 ${si.x} ${si.y}`,
    // Start cap semicircle (inner-start → outer-start)
    `A ${capR} ${capR} 0 0 1 ${so.x} ${so.y}`,
    `Z`,
  ].join(" ");
}

function arcLen(r: number, deg: number) {
  return (deg / 360) * 2 * Math.PI * r;
}

function segBounds(startDeg: number, endDeg: number) {
  return { s: startDeg + GAP_DEG, e: endDeg - GAP_DEG };
}

// ─────────────────────────────────────────────────────────────
// BUILD SEGMENTS FROM DATA
// ─────────────────────────────────────────────────────────────

const segments = categoryList.map((cat) => {
  const { s, e } = segBounds(cat.radialStartAngle, cat.radialEndAngle);
  const midDeg = (s + e) / 2;
  const labelFlip = midDeg > 90 && midDeg < 270;

  const catTools = tools
    .filter((t) => t.categoryId === cat.id)
    .map((t) => ({ name: t.name, route: t.route, categoryId: t.categoryId }));

  return {
    id: cat.id,
    label: cat.label.toUpperCase(),
    shortLabel: cat.shortLabel.toUpperCase(),
    color: cat.color,
    glowColor: cat.glowColor,
    gradientStart: cat.gradientStart,
    gradientMid: cat.gradientMid,
    gradientEnd: cat.gradientEnd,
    route: cat.route,
    startDeg: cat.radialStartAngle,
    endDeg: cat.radialEndAngle,
    s, e,
    midDeg,
    labelFlip,
    tools: catTools,
  };
});

// ─────────────────────────────────────────────────────────────
// TOOL NODE COMPONENT — premium glass control
// ─────────────────────────────────────────────────────────────

function ToolNode({
  tool,
  color,
  glowColor,
  isVisible,
  pos,
  hiddenPos,
  idx,
  onKeepActive,
}: {
  tool: { name: string; route: string; categoryId: string };
  color: string;
  glowColor: string;
  isVisible: boolean;
  pos: { x: number; y: number };
  hiddenPos: { x: number; y: number };
  idx: number;
  onKeepActive: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const ToolIcon = toolIcons[tool.categoryId] ?? Code2;

  // ── Dynamic pill geometry ──────────────────────────────────────
  // Character width estimate for ui-sans-serif 7.5px / weight-600 / letter-spacing 0.14em:
  //   glyph ≈ 5.5px  +  spacing ≈ 7.5 × 0.14 ≈ 1.05px  →  ~6.4px per char
  // Layout zones:  [padding-l: 8] [icon: 17] [divider gap: 5] [text] [padding-r: 12]
  const CHAR_W   = 6.4;
  const ICON_ZONE = 30;   // left padding + icon circle + gap to divider
  const PAD_R    = 14;    // right padding after text
  const label    = tool.name.toUpperCase();
  const textW    = label.length * CHAR_W;
  const pillW    = Math.max(88, Math.ceil(ICON_ZONE + textW + PAD_R));
  const pillH    = 34;
  const iconR    = 13;

  return (
    <motion.g
      role="button"
      aria-label={`Open ${tool.name}`}
      onMouseEnter={() => {
        onKeepActive();
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      initial={false}
      animate={{
        opacity: isVisible ? 1 : 0,
        x: isVisible ? 0 : (hiddenPos.x - pos.x) * 0.6,
        y: isVisible ? 0 : (hiddenPos.y - pos.y) * 0.6,
        scale: isVisible ? 1 : 0.6,
      }}
      transition={{
        ...SPRING,
        delay: isVisible ? idx * 0.07 : idx * 0.02,
        opacity: { duration: isVisible ? 0.35 : 0.15 },
      }}
      style={{
        pointerEvents: isVisible ? "auto" : "none",
        cursor: "pointer",
      }}
    >
      <Link href={tool.route} aria-label={`Open ${tool.name}`} tabIndex={isVisible ? 0 : -1}>

        {/* ── Connecting accent line arc → node ── */}
        <motion.line
          x1={hiddenPos.x}
          y1={hiddenPos.y}
          x2={pos.x - pillW / 2}
          y2={pos.y}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray="2 5"
          animate={{
            opacity: isVisible ? (hovered ? 0.5 : 0.15) : 0,
            strokeWidth: hovered ? 1.0 : 0.5,
          }}
          transition={{ duration: 0.3 }}
        />

        {/* ── Ambient glow bloom behind pill ── */}
        <motion.ellipse
          cx={pos.x}
          cy={pos.y}
          rx={pillW * 0.6}
          ry={pillH * 0.9}
          fill={color}
          animate={{ opacity: hovered ? 0.14 : 0 }}
          transition={SPRING}
          style={{ filter: "blur(10px)" }}
        />

        {/* ── Pill base: always-dark glass body ── */}
        <rect
          x={pos.x - pillW / 2}
          y={pos.y - pillH / 2}
          width={pillW}
          height={pillH}
          rx={pillH / 2}
          fill="rgba(6,8,22,0.88)"
        />

        {/* ── Pill border: animated opacity ── */}
        <motion.rect
          x={pos.x - pillW / 2}
          y={pos.y - pillH / 2}
          width={pillW}
          height={pillH}
          rx={pillH / 2}
          fill="none"
          stroke={color}
          strokeWidth={1}
          animate={{ opacity: hovered ? 0.9 : 0.38 }}
          transition={SPRING}
          style={{
            filter: hovered
              ? `drop-shadow(0 0 8px ${glowColor}) drop-shadow(0 0 18px ${glowColor}50)`
              : undefined,
          }}
        />

        {/* ── Top specular edge ── */}
        <rect
          x={pos.x - pillW / 2 + 10}
          y={pos.y - pillH / 2 + 1}
          width={pillW - 20}
          height={0.8}
          rx={0.4}
          fill="rgba(255,255,255,0.16)"
        />

        {/* ── Icon zone fill ── */}
        <motion.circle
          cx={pos.x - pillW / 2 + 17}
          cy={pos.y}
          r={iconR}
          fill={color}
          animate={{ opacity: hovered ? 0.26 : 0.14 }}
          transition={SPRING}
        />

        {/* ── Icon ── */}
        <foreignObject
          x={pos.x - pillW / 2 + 17 - 8}
          y={pos.y - 8}
          width={16}
          height={16}
          className="overflow-visible pointer-events-none"
        >
          <div className="flex h-full w-full items-center justify-center">
            <ToolIcon
              size={12}
              strokeWidth={2.2}
              style={{
                color: hovered ? "#fff" : color,
                filter: hovered ? `drop-shadow(0 0 5px ${glowColor})` : undefined,
                transition: "color 0.2s, filter 0.2s",
              }}
            />
          </div>
        </foreignObject>

        {/* ── Divider between icon and text ── */}
        <line
          x1={pos.x - pillW / 2 + 30}
          y1={pos.y - pillH / 2 + 7}
          x2={pos.x - pillW / 2 + 30}
          y2={pos.y + pillH / 2 - 7}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={0.6}
        />

        {/* ── Name label ── */}
        <motion.text
          x={pos.x - pillW / 2 + 39}
          y={pos.y + 0.5}
          dominantBaseline="middle"
          style={{
            fontSize: "7.5px",
            fontWeight: 600,
            letterSpacing: "0.14em",
            fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          }}
          animate={{ fill: hovered ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.72)" }}
          transition={{ duration: 0.2 }}
        >
          {label}
        </motion.text>

        {/* ── Invisible hit target ── */}
        <rect
          x={pos.x - pillW / 2 - 8}
          y={pos.y - pillH / 2 - 8}
          width={pillW + 16}
          height={pillH + 16}
          rx={(pillH + 16) / 2}
          fill="transparent"
        />
      </Link>
    </motion.g>
  );
}

// ─────────────────────────────────────────────────────────────
// RADIAL MENU — main export
// ─────────────────────────────────────────────────────────────

export default function RadialMenu({
  activeSegment: propActive,
  onActiveSegmentChange,
}: RadialMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<CategoryId | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const active = propActive ?? hovered;

  // Debounced setter — clears any pending leave timer
  const keepActive = (seg: CategoryId) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setHovered(seg);
    onActiveSegmentChange?.(seg);
  };

  const setActive = (seg: CategoryId | null) => {
    if (seg !== null) {
      keepActive(seg);
    } else {
      // Delay clearing so mouse can travel from arc → nodes
      leaveTimerRef.current = setTimeout(() => {
        setHovered(null);
        onActiveSegmentChange?.(null);
        leaveTimerRef.current = null;
      }, 260);
    }
  };

  useEffect(() => () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
  }, []);

  // Pre-compute particle ring positions
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, i) => ({
        angle: i * 9,
        r: ARC_INNER - 32 + (i % 3) * 16,
        size: 0.7 + (i % 4) * 0.22,
        dur: 3.5 + (i % 7) * 0.4,
        delay: i * 0.045,
      })),
    []
  );

  if (!mounted) return <div className="absolute inset-0" />;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.5, ease: EASE_EXPO }}
      className="absolute inset-0 flex items-center justify-center overflow-visible pointer-events-none"
    >
      <svg
        viewBox="0 0 1000 1000"
        className="h-full w-full pointer-events-auto overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        aria-label="Toolsy category orbital menu"
      >
        <defs>
          {/* Per-segment gradient fills */}
          {segments.map((s) => (
            <linearGradient
              key={`fill-${s.id}`}
              id={`fill-${s.id}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={s.gradientStart} />
              <stop offset="50%" stopColor={s.gradientMid} />
              <stop offset="100%" stopColor={s.gradientEnd} />
            </linearGradient>
          ))}

          {/* Light sweep shimmer */}
          {segments.map((s) => (
            <linearGradient key={`sweep-${s.id}`} id={`sweep-${s.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="40%" stopColor="rgba(255,255,255,0.9)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          ))}

          {/* Label arc paths */}
          {segments.map((s) => {
            const lPath = s.labelFlip
              ? arc(CX, CY, LABEL_R, s.e - 10, s.s + 10, 0)
              : arc(CX, CY, LABEL_R, s.s + 10, s.e - 10);
            return (
              <path key={`lp-${s.id}`} id={`lp-${s.id}`} d={lPath} fill="none" />
            );
          })}

          {/* Soft glow filter */}
          {segments.map((s) => (
            <filter key={`gf-${s.id}`} id={`gf-${s.id}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}

          {/* Soft portal depth */}
          <radialGradient id="portal-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.035)" />
            <stop offset="70%" stopColor="rgba(255,255,255,0.01)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Clip to ring band for connector dots */}
          <clipPath id="ring-band">
            <circle cx={CX} cy={CY} r={ARC_OUTER + 16} />
          </clipPath>
        </defs>

        {/* Subtle portal background glow disc */}
        <circle cx={CX} cy={CY} r={440} fill="url(#portal-bg)" />

        {/* ── BACKGROUND STRUCTURE RINGS ── */}
        {/* Inner boundary */}
        <motion.circle
          cx={CX}
          cy={CY}
          r={ARC_INNER - 20}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={0.6}
          strokeDasharray="1.5 10"
          animate={{ rotate: 360 }}
          transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
        {/* Outer boundary */}
        <motion.circle
          cx={CX}
          cy={CY}
          r={ARC_OUTER + 20}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={0.6}
          strokeDasharray="2 14"
          animate={{ rotate: -360 }}
          transition={{ duration: 140, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
        {/* Node orbit ring */}
        <circle
          cx={CX}
          cy={CY}
          r={NODE_R}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={0.5}
          strokeDasharray="1 20"
        />

        {/* ── AMBIENT PARTICLE RING ── */}
        {particles.map((p, i) => {
          const pos = polar(CX, CY, p.r, p.angle);
          return (
            <motion.circle
              key={i}
              cx={pos.x}
              cy={pos.y}
              r={p.size}
              fill="rgba(255,255,255,0.5)"
              animate={{
                opacity: active
                  ? [0.07, 0.28, 0.07]
                  : [0.03, 0.12, 0.03],
                scale: active ? [1, 1.7, 1] : [1, 1.2, 1],
              }}
              transition={{
                duration: p.dur,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}

        {/* ── SEGMENTS ── */}
        {segments.map((s, sIdx) => {
          const isActive = active === s.id;
          const spanDeg = s.e - s.s;
          const totalLen = arcLen(ARC_R, spanDeg);
          const dInnerEdge = arc(CX, CY, ARC_INNER + 4, s.s + 2, s.e - 2);
          const dOuterEdge = arc(CX, CY, ARC_OUTER - 4, s.s + 2, s.e - 2);
          const dSweep = arc(CX, CY, ARC_R, s.s + 6, s.e - 6);
          const halfLen = arcLen(ARC_R, (spanDeg) / 2);

          // Filled donut-slice shapes for crisp rendering
          const dFill    = annularPath(CX, CY, ARC_INNER, ARC_OUTER, s.s, s.e);
          const dFillHit = annularPath(CX, CY, ARC_INNER - 32, ARC_OUTER + 32, s.s - 4, s.e + 4);

          return (
            <g
              key={s.id}
              onMouseEnter={() => setActive(s.id as CategoryId)}
              onMouseLeave={() => setActive(null)}
            >
              {/* Large invisible hit area — filled shape */}
              <Link href={s.route} aria-label={`Open ${s.label} tools`}>
                <path
                  d={dFillHit}
                  fill="transparent"
                  stroke="none"
                  className="cursor-pointer"
                />
              </Link>

              {/* ── GLOW HALO — filled shape matching rounded arc, blurred outward ── */}
              <motion.path
                d={annularPath(CX, CY, ARC_INNER - ARC_HALF * 0.6, ARC_OUTER + ARC_HALF * 0.6, s.s, s.e)}
                fill={s.color}
                stroke="none"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: isActive ? 0.45 : 0.06,
                }}
                transition={{ duration: 0.5, ease: EASE_EXPO }}
                style={{
                  filter: isActive ? `blur(${ARC_HALF * 1.2}px)` : `blur(${ARC_HALF * 0.8}px)`,
                }}
              />

              {/* ── BASE TRACK — dark frosted substrate ── */}
              <path
                d={dFill}
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={0.8}
              />

              {/* ── MAIN FILL — filled annular shape with gradient ── */}
              <motion.path
                d={dFill}
                fill={`url(#fill-${s.id})`}
                stroke="none"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: isActive ? 1 : 0.84,
                  scale: isActive ? 1.012 : 1,
                }}
                transition={{
                  opacity: { delay: sIdx * 0.12, duration: 1.2, ease: EASE_EXPO },
                  scale: SPRING,
                }}
                style={{ transformOrigin: `${CX}px ${CY}px` }}
              />

              {/* ── LIGHT SWEEP — shimmer stroke on center line ── */}
              <motion.path
                d={dSweep}
                fill="none"
                stroke={`url(#sweep-${s.id})`}
                strokeLinecap="butt"
                strokeDasharray={`${halfLen * 0.28} ${totalLen}`}
                animate={{
                  strokeDashoffset: isActive ? [-totalLen, 0] : [-totalLen, -totalLen * 0.4],
                  opacity: isActive ? 0.65 : 0.16,
                  strokeWidth: isActive ? ARC_HALF * 2 - 4 : ARC_HALF * 2 - 8,
                }}
                transition={{
                  strokeDashoffset: {
                    duration: isActive ? 2.8 : 6,
                    repeat: Infinity,
                    ease: "linear",
                  },
                  opacity: { duration: 0.35 },
                  strokeWidth: { duration: 0.35 },
                }}
              />

              {/* ── EDGE LINES — precision inner/outer borders ── */}
              {/* Inner edge */}
              <motion.path
                d={dInnerEdge}
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeLinecap="round"
                animate={{
                  strokeWidth: isActive ? 1.8 : 0.8,
                  opacity: isActive ? 0.4 : 0.14,
                }}
                transition={{ duration: 0.3 }}
              />
              {/* Outer edge — accent tinted */}
              <motion.path
                d={dOuterEdge}
                fill="none"
                stroke={s.gradientStart}
                strokeLinecap="round"
                animate={{
                  strokeWidth: isActive ? 2 : 0.8,
                  opacity: isActive ? 0.55 : 0.18,
                }}
                transition={{ duration: 0.3 }}
              />

              {/* ── LABEL SYSTEM ── */}
              <motion.g
                animate={{ opacity: isActive ? 1 : 0.92 }}
                transition={{ duration: 0.25 }}
              >

                {/* Label text — crisp shadow for legibility (aria-hidden) */}
                <text
                  aria-hidden="true"
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    letterSpacing: "0.22em",
                    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
                    fill: "none",
                    paintOrder: "stroke",
                    stroke: "rgba(0,0,0,0.75)",
                    strokeWidth: "3.5px",
                    strokeLinejoin: "round",
                  }}
                >
                  <textPath
                    href={`#lp-${s.id}`}
                    startOffset="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {s.label}
                  </textPath>
                </text>

                {/* Label text — main, premium refined style */}
                <motion.text
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    letterSpacing: "0.22em",
                    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
                  }}
                  animate={{
                    fill: isActive ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.72)",
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <textPath
                    href={`#lp-${s.id}`}
                    startOffset="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      filter: isActive
                        ? `drop-shadow(0 0 8px ${s.glowColor}) drop-shadow(0 0 16px ${s.glowColor})`
                        : `drop-shadow(0 0 3px ${s.glowColor})`,
                    }}
                  >
                    {s.label}
                  </textPath>
                </motion.text>
              </motion.g>

              {/* ── CONNECTOR DOTS — mid-point accent ── */}
              {[s.s, s.e].map((deg, di) => {
                const dotPos = polar(CX, CY, ARC_R, deg + (di === 0 ? GAP_DEG * 0.4 : -GAP_DEG * 0.4));
                return (
                  <motion.circle
                    key={di}
                    cx={dotPos.x}
                    cy={dotPos.y}
                    r={2.5}
                    fill={s.color}
                    animate={{
                      opacity: isActive ? 0.9 : 0.3,
                      r: isActive ? 3.5 : 2,
                    }}
                    transition={{ duration: 0.3 }}
                    style={{ filter: isActive ? `drop-shadow(0 0 6px ${s.glowColor})` : undefined }}
                  />
                );
              })}

              {/* ── TOOL NODES ── */}
              {s.tools.map((tool, idx) => {
                const frac = (idx + 1) / (s.tools.length + 1);
                const toolDeg = s.startDeg + (s.endDeg - s.startDeg) * frac;
                const nodePos = polar(CX, CY, NODE_R, toolDeg);
                const hiddenPos = polar(CX, CY, ARC_OUTER + 14, toolDeg);

                return (
                  <ToolNode
                    key={tool.name}
                    tool={tool}
                    color={s.color}
                    glowColor={s.glowColor}
                    isVisible={isActive}
                    pos={nodePos}
                    hiddenPos={hiddenPos}
                    idx={idx}
                    onKeepActive={() => keepActive(s.id as CategoryId)}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </motion.div>
  );
}
