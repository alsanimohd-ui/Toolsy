"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Terminal, FileCode } from "lucide-react";
import { categoryList, tools } from "@/lib/tools";

interface RadialMenuProps {
  activeSegment?: string | null;
}

// ─────────────────────────────────────────────────────────────
// CATEGORY SEGMENTS — premium thick arcs with integrated labels
// ─────────────────────────────────────────────────────────────
const toolIcons = {
  "network-security": ShieldCheck,
  "data-analytics": Terminal,
  "dev-automation": FileCode,
};

const segments = categoryList.map((category) => ({
  id: category.id,
  label: category.label.toUpperCase(),
  shortLabel: category.shortLabel.toUpperCase(),
  color: category.color,
  glowColor: category.glowColor,
  gradientStart: category.gradientStart,
  gradientMid: category.gradientMid,
  gradientEnd: category.gradientEnd,
  startAngle: category.radialStartAngle,
  endAngle: category.radialEndAngle,
  tools: tools
    .filter((tool) => tool.categoryId === category.id)
    .map((tool) => ({
      name: tool.name,
      route: tool.route,
      icon: toolIcons[tool.categoryId],
    })),
}));

// ─────────────────────────────────────────────────────────────
// SVG CONSTANTS — cinematic proportions
// ─────────────────────────────────────────────────────────────
const CX = 450;
const CY = 450;
const ARC_RADIUS = 296;      // centerline radius
const ARC_WIDTH = 64;         // premium weight with clean segment breathing room
const ARC_INNER = ARC_RADIUS - ARC_WIDTH / 2;
const ARC_OUTER = ARC_RADIUS + ARC_WIDTH / 2;
const NODE_RADIUS = ARC_OUTER + 64; // contextual tool node distance
const LABEL_RADIUS = ARC_RADIUS - 4;     // label rides INSIDE arc
const SEGMENT_CAP_GAP = 14;

// ─────────────────────────────────────────────────────────────
// GEOMETRY HELPERS
// ─────────────────────────────────────────────────────────────
function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToCartesian(cx, cy, r, startDeg);
  const e = polarToCartesian(cx, cy, r, endDeg);
  const span = Math.abs(endDeg - startDeg);
  const large = span > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function arcLength(r: number, spanDeg: number) {
  return (spanDeg / 360) * 2 * Math.PI * r;
}

function insetSegment(startDeg: number, endDeg: number) {
  return {
    start: startDeg + SEGMENT_CAP_GAP,
    end: endDeg - SEGMENT_CAP_GAP,
  };
}

// ─────────────────────────────────────────────────────────────
// EASING FUNCTIONS — premium motion feel
// ─────────────────────────────────────────────────────────────
const PREMIUM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];     // expo out
const SNAPPY_EASE: [number, number, number, number] = [0.68, -0.55, 0.27, 1.55]; // magnetic snap

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function RadialMenu({ activeSegment: propActiveSegment }: RadialMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div className="absolute inset-0" />;

  const active = propActiveSegment ?? hoveredSegment;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 2, ease: PREMIUM_EASE }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
    >
      <svg
        ref={svgRef}
        viewBox="0 0 900 900"
        className="h-full w-full pointer-events-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* ── Per-segment premium gradients ── */}
          {segments.map((s) => (
            <linearGradient
              key={`grad-${s.id}`}
              id={`grad-${s.id}`}
              x1="0%" y1="0%" x2="100%" y2="100%"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={s.gradientStart} />
              <stop offset="50%" stopColor={s.gradientMid} />
              <stop offset="100%" stopColor={s.gradientEnd} />
            </linearGradient>
          ))}

          {/* ── Deep inner glow gradient ── */}
          {segments.map((s) => (
            <linearGradient
              key={`grad-inner-${s.id}`}
              id={`grad-inner-${s.id}`}
              x1="0%" y1="100%" x2="100%" y2="0%"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={s.gradientEnd} stopOpacity="0.9" />
              <stop offset="100%" stopColor={s.gradientStart} stopOpacity="0.3" />
            </linearGradient>
          ))}

          {/* ── Label path (arc centerline for text) ── */}
          {segments.map((s) => (
            <path
              key={`label-path-${s.id}`}
              id={`label-path-${s.id}`}
              d={arcPath(CX, CY, LABEL_RADIUS, insetSegment(s.startAngle, s.endAngle).start + 8, insetSegment(s.startAngle, s.endAngle).end - 8)}
              fill="none"
            />
          ))}

          {/* ── Outer edge highlight path ── */}
          {segments.map((s) => (
            <path
              key={`edge-path-${s.id}`}
              id={`edge-path-${s.id}`}
              d={arcPath(CX, CY, ARC_OUTER - 2, insetSegment(s.startAngle, s.endAngle).start, insetSegment(s.startAngle, s.endAngle).end)}
              fill="none"
            />
          ))}

          {/* ── Deep glow filter ── */}
          {segments.map((s) => (
            <filter key={`glow-deep-${s.id}`} id={`glow-deep-${s.id}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}

          {/* ── Soft ambient glow ── */}
          {segments.map((s) => (
            <filter key={`glow-soft-${s.id}`} id={`glow-soft-${s.id}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}

          {/* ── Atmospheric radial glow ── */}
          <radialGradient id="core-atmosphere" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* ── Glassmorphism ambient ── */}
          <radialGradient id="ambient-pulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.01)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* ── Deep space atmosphere ───────────────────────────── */}
        <circle cx={CX} cy={CY} r={ARC_RADIUS * 1.9} fill="url(#ambient-pulse)" />

        {/* ── Structural precision rings ──────────────────────── */}
        <circle
          cx={CX} cy={CY}
          r={ARC_INNER - 12}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="2 12"
          className="opacity-[0.05] dark:opacity-[0.06]"
        />
        <circle
          cx={CX} cy={CY}
          r={ARC_OUTER + 12}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="2 12"
          className="opacity-[0.04] dark:opacity-[0.05]"
        />

        {/* ── Segment Arcs ────────────────────────────────────── */}
        {segments.map((s, sIdx) => {
          const isActive = active === s.id;
          const segment = insetSegment(s.startAngle, s.endAngle);
          const spanDeg = segment.end - segment.start;
          const totalLen = arcLength(ARC_RADIUS, spanDeg);
          const d = arcPath(CX, CY, ARC_RADIUS, segment.start, segment.end);

          return (
            <g
              key={s.id}
              onMouseEnter={() => setHoveredSegment(s.id)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {/* ── Thick invisible hit zone ── */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={ARC_WIDTH + 80}
                className="cursor-pointer"
              />

              {/* ── Deep shadow layer ── */}
              <motion.path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={ARC_WIDTH + 8}
                strokeLinecap="round"
                initial={{ opacity: 0.04, strokeWidth: ARC_WIDTH + 5 }}
                animate={{
                  opacity: isActive ? 0.15 : 0.04,
                  strokeWidth: isActive ? ARC_WIDTH + 10 : ARC_WIDTH + 5,
                }}
                transition={{ duration: 0.9, ease: PREMIUM_EASE }}
              />

              {/* ── Track (dim base) ── */}
              <motion.path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={ARC_WIDTH}
                strokeLinecap="round"
                initial={{ opacity: 0.05 }}
                animate={{ opacity: isActive ? 0.12 : 0.05 }}
                transition={{ duration: 0.8 }}
              />

              {/* ── MAIN ARC — cinematic reveal animation ── */}
              <motion.path
                id={`arc-${s.id}`}
                d={d}
                fill="none"
                stroke={`url(#grad-${s.id})`}
                strokeWidth={ARC_WIDTH}
                strokeLinecap="round"
                initial={{
                  strokeDasharray: `${totalLen} 0`,
                  strokeDashoffset: 0,
                  opacity: 0,
                  rotate: -20,
                }}
                animate={{
                  strokeDashoffset: 0,
                  opacity: isActive ? 1 : 0.88,
                  strokeWidth: isActive ? ARC_WIDTH + 3 : ARC_WIDTH,
                  rotate: 0,
                }}
                transition={{
                  strokeDashoffset: { duration: 1.4 + sIdx * 0.15, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.6, delay: 0.2 },
                  strokeWidth: { duration: 0.8, ease: PREMIUM_EASE },
                  rotate: { duration: 2, ease: [0.16, 1, 0.3, 1] },
                }}
                style={{ transformOrigin: `${CX}px ${CY}px` }}
                filter={isActive ? `url(#glow-deep-${s.id})` : undefined}
              />

              {/* ── Inner depth highlight ── */}
              <motion.path
                d={arcPath(CX, CY, ARC_INNER + 6, segment.start + 2, segment.end - 2)}
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ opacity: 0.08 }}
                animate={{ opacity: isActive ? 0.3 : 0.08 }}
                transition={{ duration: 0.7 }}
              />

              {/* ── Outer glow edge ── */}
              <motion.path
                d={arcPath(CX, CY, ARC_OUTER - 5, segment.start + 2, segment.end - 2)}
                fill="none"
                stroke={s.color}
                strokeWidth="1.5"
                strokeLinecap="round"
                initial={{ opacity: 0.12 }}
                animate={{ opacity: isActive ? 0.5 : 0.12 }}
                transition={{ duration: 0.7 }}
              />

              {/* ── Label text INSIDE arc ── */}
              <motion.g
                initial={{ opacity: 0.72 }}
                animate={{ opacity: isActive ? 1 : 0.72 }}
                transition={{ duration: 0.7 }}
              >
                {/* Text shadow layer for depth */}
                <text
                  style={{
                    userSelect: "none",
                    fontSize: "12px",
                    fontWeight: 900,
                    letterSpacing: "0.24em",
                    fill: "none",
                    paintOrder: "stroke",
                    stroke: "rgba(0,0,0,0.72)",
                    strokeWidth: "6px",
                    strokeLinejoin: "round",
                    filter: `blur(2px)`,
                  }}
                >
                  <textPath
                    href={`#label-path-${s.id}`}
                    startOffset="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {s.label}
                  </textPath>
                </text>
                {/* Soft text shadow */}
                <text
                  style={{
                    userSelect: "none",
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.24em",
                    fill: "rgba(255,255,255,0.82)",
                    textTransform: "uppercase",
                    filter: `drop-shadow(0 0 6px ${s.glowColor})`,
                  }}
                >
                  <textPath
                    href={`#label-path-${s.id}`}
                    startOffset="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {s.label}
                  </textPath>
                </text>
              </motion.g>

              {/* ── Tool Nodes ─────────────────────────────────── */}
              {s.tools.map((tool, idx) => {
                const mid = s.startAngle + (s.endAngle - s.startAngle) / (s.tools.length + 1) * (idx + 1);
                const hiddenPos = polarToCartesian(CX, CY, ARC_OUTER + 16, mid);
                const pos = polarToCartesian(CX, CY, NODE_RADIUS, mid);
                const ToolIcon = tool.icon;
                const isHovered = hoveredTool === tool.name;
                const shouldReveal = isActive;

                return (
                  <Link key={tool.name} href={tool.route}>
                    <motion.g
                      onMouseEnter={() => setHoveredTool(tool.name)}
                      onMouseLeave={() => setHoveredTool(null)}
                      initial={false}
                      animate={{
                        opacity: shouldReveal ? 1 : 0,
                        scale: shouldReveal ? 1 : 0.82,
                        x: shouldReveal ? 0 : hiddenPos.x - pos.x,
                        y: shouldReveal ? 0 : hiddenPos.y - pos.y,
                      }}
                      transition={{ duration: 0.45, ease: PREMIUM_EASE }}
                      style={{
                        pointerEvents: shouldReveal ? "auto" : "none",
                        transformOrigin: `${pos.x}px ${pos.y}px`,
                      }}
                    >
                      {/* ── Magnetic field pulse ── */}
                      <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isActive ? 32 : 28}
                        fill="none"
                        stroke={s.color}
                        strokeWidth="0.5"
                        initial={{ opacity: 0.08, rotate: 0 }}
                        animate={{
                          opacity: isHovered ? [0.16, 0.34, 0.16] : 0.08,
                          rotate: isHovered ? 360 : 0,
                        }}
                        transition={{
                          opacity: { duration: 2, repeat: Infinity },
                          rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                        }}
                      />

                      {/* ── Node outer glow ── */}
                      <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r={20}
                        fill={s.color}
                        initial={{ opacity: 0.07, scale: 1 }}
                        animate={{
                          opacity: isHovered ? 0.12 : 0.07,
                          scale: isHovered ? 1.3 : 1,
                        }}
                        transition={{ duration: 0.5, ease: PREMIUM_EASE }}
                        style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                      />

                      {/* ── Node shell ── */}
                      <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r={18}
                        fill="rgba(8,10,18,0.9)"
                        stroke={s.color}
                        strokeWidth="2"
                        initial={{ opacity: 1, scale: 1, strokeWidth: 1.5 }}
                        animate={{
                          opacity: 1,
                          scale: isHovered ? 1.1 : 1,
                          strokeWidth: isHovered ? 2.5 : 1.5,
                        }}
                        transition={{ duration: 0.4, ease: SNAPPY_EASE }}
                        style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                        filter={isHovered ? `url(#glow-soft-${s.id})` : undefined}
                      />
                      {/* Inner highlight ring */}
                      <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r={12}
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="0.75"
                        initial={{ opacity: 0.1 }}
                        animate={{ opacity: isHovered ? 0.4 : 0.1 }}
                        transition={{ duration: 0.4 }}
                        style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                      />

                      {/* ── Icon ── */}
                      <motion.g
                        initial={{ scale: 1, rotate: 0 }}
                        animate={{
                          scale: isHovered ? 1.15 : 1,
                          rotate: isHovered ? [0, 5, -5, 0] : 0,
                        }}
                        transition={{
                          scale: { duration: 0.4, ease: SNAPPY_EASE },
                          rotate: { duration: 0.6, ease: PREMIUM_EASE },
                        }}
                        style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                      >
                        <foreignObject
                          x={pos.x - 9}
                          y={pos.y - 9}
                          width={18}
                          height={18}
                          className="overflow-visible"
                        >
                          <div className="flex items-center justify-center w-full h-full">
                            <ToolIcon
                              size={14}
                              strokeWidth={2}
                              style={{ color: s.color }}
                              className="drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]"
                            />
                          </div>
                        </foreignObject>
                      </motion.g>

                      {/* ── Premium tooltip ── */}
                      <motion.g
                        initial={{ opacity: 0, y: 4 }}
                        animate={{
                          opacity: isHovered ? 1 : 0,
                          y: isHovered ? 0 : 4,
                          scale: isHovered ? 1 : 0.95,
                        }}
                        transition={{ duration: 0.35, ease: PREMIUM_EASE }}
                        style={{ pointerEvents: "none" }}
                      >
                        {/* Tooltip background */}
                        <rect
                          x={pos.x - 42}
                          y={pos.y - 42}
                          width={84}
                          height={24}
                          rx={6}
                          fill="rgba(10,12,20,0.92)"
                          stroke={s.color}
                          strokeWidth="0.75"
                        />
                        {/* Tooltip text */}
                        <text
                          x={pos.x}
                          y={pos.y - 31}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{
                            fontSize: "8px",
                            fontWeight: 700,
                            letterSpacing: "0.2em",
                            fill: "rgba(255,255,255,0.9)",
                            textTransform: "uppercase",
                          }}
                        >
                          {tool.name}
                        </text>
                      </motion.g>
                    </motion.g>
                  </Link>
                );
              })}
            </g>
          );
        })}

        {/* ── Orbital guide dots ──────────────────────────────── */}
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = i * 10;
          const pos = polarToCartesian(CX, CY, ARC_RADIUS, angle);
          return (
              <motion.circle
                key={i}
                cx={pos.x}
                cy={pos.y}
                r={0.8}
                fill="currentColor"
                initial={{ opacity: 0.1 }}
                animate={{
                  opacity: [0.1, 0.3, 0.1],
                }}
                transition={{
                  duration: 3 + (i % 5) * 0.5,
                  delay: i * 0.08,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="opacity-[0.08] dark:opacity-[0.1]"
              />
          );
        })}
      </svg>
    </motion.div>
  );
}
