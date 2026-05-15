"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Database, Code2, QrCode, Lock, Globe, ScanSearch, Activity, FileJson, Braces, Terminal, Wrench, Fingerprint } from "lucide-react";
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
  "qr-generator": QrCode,
  "ssl-toolkit": Lock,
  "threat-inspector": ScanSearch,
  "port-checker": Globe,
  "pcap-analyzer": Activity,
  "jsonlego": FileJson,
  "log-analyzer": Braces,
  "paste-to-code": Code2,
  "regex-studio": Terminal,
  "api-request-lab": Wrench,
  "core-encoder": Fingerprint,
};

const defaultCategoryIcons: Record<string, React.ElementType> = {
  "network-security": ShieldCheck,
  "data-analytics": Database,
  "dev-automation": Code2,
};

// ─────────────────────────────────────────────────────────────
// SVG GEOMETRY — thicker arcs with gaps
// ─────────────────────────────────────────────────────────────

const CX = 500;
const CY = 500;
const ARC_R = 330;          // arc center-line radius
const ARC_WIDTH = 54;       // Arc thickness (depth)
const ARC_OUTER = ARC_R + ARC_WIDTH / 2;
const NODE_R = ARC_OUTER + 50; // Outer orbit for icons
const LABEL_R = ARC_R;
const GAP_DEG = 15;         // gap between segments

const SPRING = { type: "spring" as const, stiffness: 350, damping: 25, mass: 0.8 };
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

function arcLen(r: number, deg: number) {
  return (deg / 360) * 2 * Math.PI * r;
}

const segments = categoryList.map((cat) => {
  const s = cat.radialStartAngle + GAP_DEG;
  const e = cat.radialEndAngle - GAP_DEG;
  const midDeg = (s + e) / 2;
  const labelFlip = midDeg > 90 && midDeg < 270;

  const catTools = tools
    .filter((t) => t.categoryId === cat.id)
    .map((t) => ({ name: t.name, route: t.route, categoryId: t.categoryId, slug: t.slug }));

  return {
    id: cat.id,
    label: cat.label.toUpperCase(),
    color: cat.color,
    glowColor: cat.glowColor,
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
// TOOL NODE — circular orbit icon
// ─────────────────────────────────────────────────────────────

interface ToolNodeProps {
  tool: { name: string; route: string; categoryId: string; slug: string };
  color: string;
  isVisible: boolean;
  pos: { x: number; y: number; angle: number };
  idx: number;
}

function ToolNode({ tool, color, isVisible, pos, idx }: ToolNodeProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const ToolIcon = toolIcons[tool.slug] || defaultCategoryIcons[tool.categoryId] || Code2;

  const R = 22;

  return (
    <motion.g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => isVisible && router.push(tool.route)}
      initial={false}
      animate={{
        opacity: isVisible ? 1 : 0,
        scale: isVisible ? 1 : 0.6,
        rotate: isVisible ? 0 : -20,
      }}
      transition={{
        ...SPRING,
        delay: isVisible ? idx * 0.08 : 0,
      }}
      style={{ pointerEvents: isVisible ? "auto" : "none", cursor: "pointer" }}
    >
      {/* Invisible larger hit area for the node itself */}
      <circle cx={pos.x} cy={pos.y} r={R + 25} fill="transparent" />

      {/* Glow behind icon */}
      <motion.circle
        cx={pos.x}
        cy={pos.y}
        r={R + 6}
        fill={color}
        animate={{ opacity: hovered ? 0.3 : 0 }}
        style={{ filter: "blur(12px)" }}
      />
      
      {/* Connector line from arc to node */}
      <motion.path
        d={`M ${polar(CX, CY, ARC_OUTER + 10, pos.angle).x} ${polar(CX, CY, ARC_OUTER + 10, pos.angle).y} L ${pos.x} ${pos.y}`}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="2 4"
        animate={{ 
          opacity: isVisible ? (hovered ? 0.8 : 0.2) : 0,
          pathLength: isVisible ? 1 : 0
        }}
      />

      {/* Node Circle */}
      <circle cx={pos.x} cy={pos.y} r={R} fill="rgba(10,10,15,0.95)" />
      <motion.circle
        cx={pos.x}
        cy={pos.y}
        r={R}
        fill="none"
        stroke={color}
        strokeWidth={hovered ? 2.5 : 1}
        animate={{ 
          filter: hovered ? `drop-shadow(0 0 8px ${color})` : "none",
          scale: hovered ? 1.1 : 1
        }}
        transition={SPRING}
      />

      {/* Icon */}
      <foreignObject x={pos.x - R} y={pos.y - R} width={R * 2} height={R * 2} className="pointer-events-none">
        <div className="flex h-full w-full items-center justify-center">
          <ToolIcon size={20} color={hovered ? "#fff" : color} strokeWidth={1.5} className="transition-colors" />
        </div>
      </foreignObject>

      {/* Tool Name Label - Accompanying the icon */}
      <foreignObject 
        x={pos.x - 60} 
        y={pos.y + R + 6} 
        width={120} 
        height={30} 
        className="overflow-visible pointer-events-none"
      >
        <div className="flex flex-col items-center justify-start w-full">
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: isVisible ? (hovered ? 1 : 0.5) : 0,
              y: hovered ? 2 : 0 
            }}
            className="text-[9px] font-black text-white uppercase tracking-wider text-center leading-tight drop-shadow-md"
            style={{ textShadow: hovered ? `0 0 10px ${color}` : "none" }}
          >
            {tool.name}
          </motion.span>
        </div>
      </foreignObject>
    </motion.g>
  );
}

// ─────────────────────────────────────────────────────────────
// RADIAL MENU
// ─────────────────────────────────────────────────────────────

export default function RadialMenu({ activeSegment, onActiveSegmentChange }: RadialMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredArc, setHoveredArc] = useState<CategoryId | null>(null);

  useEffect(() => setMounted(true), []);

  const active = activeSegment || hoveredArc;

  if (!mounted) return <div className="absolute inset-0" />;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.5, ease: EASE_EXPO }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible"
    >
      <svg viewBox="0 0 1000 1000" className="h-full w-full pointer-events-auto overflow-visible">
        <defs>
          {segments.map((s) => {
            const lPath = s.labelFlip ? arc(CX, CY, LABEL_R, s.e - 5, s.s + 5, 0) : arc(CX, CY, LABEL_R, s.s + 5, s.e - 5);
            return <path key={`lp-${s.id}`} id={`lp-${s.id}`} d={lPath} fill="none" />;
          })}
          <radialGradient id="halo-glow" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="white" stopOpacity={1} />
            <stop offset="100%" stopColor="white" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Outer Orbit Track */}
        <circle cx={CX} cy={CY} r={NODE_R} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={1} strokeDasharray="4 8" />

        {segments.map((s, sIdx) => {
          const isActive = active === s.id;
          const isFaded = active && active !== s.id;
          const dArc = arc(CX, CY, ARC_R, s.s, s.e);
          const totalLen = arcLen(ARC_R, s.e - s.s);

          return (
            <g 
              key={s.id} 
              onMouseEnter={() => {
                setHoveredArc(s.id as CategoryId);
                onActiveSegmentChange?.(s.id as CategoryId);
              }} 
              onMouseLeave={() => {
                setHoveredArc(null);
                onActiveSegmentChange?.(null);
              }}
            >
              
              {/* Glow Filter Base Track */}
              <motion.path
                d={dArc}
                fill="none"
                stroke={s.color}
                strokeWidth={ARC_WIDTH}
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: isActive ? 0.3 : 0.05 }}
                style={{ filter: "blur(20px)" }}
              />

              {/* Base Track */}
              <motion.path
                d={dArc}
                fill="none"
                stroke="rgba(255,255,255,0.02)"
                strokeWidth={ARC_WIDTH}
                strokeLinecap="round"
                animate={{ opacity: isFaded ? 0.4 : 1 }}
              />

              {/* Slider Track (Sliding in animation) */}
              <motion.path
                d={dArc}
                fill="none"
                stroke={s.color}
                strokeWidth={ARC_WIDTH}
                strokeLinecap="round"
                strokeDasharray={totalLen}
                initial={{ strokeDashoffset: totalLen }}
                animate={{ 
                  strokeDashoffset: 0,
                  opacity: isActive ? 0.8 : 0.3,
                  strokeWidth: isActive ? ARC_WIDTH + 4 : ARC_WIDTH
                }}
                transition={{
                  strokeDashoffset: { duration: 1.5, ease: EASE_EXPO, delay: sIdx * 0.1 },
                  opacity: { duration: 0.4 },
                  strokeWidth: { type: "spring", stiffness: 300, damping: 20 }
                }}
                style={{ filter: isActive ? `drop-shadow(0 0 10px ${s.color})` : "none" }}
              />

              {/* Inner Highlighting (Bevel effect) */}
              <motion.path
                d={dArc}
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={2}
                strokeLinecap="round"
                animate={{ opacity: isActive ? 0.8 : 0.1 }}
                style={{ mixBlendMode: "overlay" }}
              />

              {/* Label */}
              <motion.g animate={{ opacity: isActive ? 1 : 0.6 }}>
                <text
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    letterSpacing: "0.25em",
                    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                    fill: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                  }}
                >
                  <textPath href={`#lp-${s.id}`} startOffset="50%" textAnchor="middle" dominantBaseline="middle">
                    {s.label}
                  </textPath>
                </text>
              </motion.g>

              {/* Invisible Hit Area (Extremely thick to cover nodes and avoid gaps) */}
              <path 
                d={dArc} 
                fill="none" 
                stroke="transparent" 
                strokeWidth={ARC_WIDTH + 240} 
                className="cursor-pointer" 
                style={{ pointerEvents: "auto" }}
              />

              {/* Tool Nodes */}
              {s.tools.map((tool, idx) => {
                const frac = (idx + 1) / (s.tools.length + 1);
                const toolDeg = s.s + (s.e - s.s) * frac;
                const nodePos = { ...polar(CX, CY, NODE_R, toolDeg), angle: toolDeg };

                return (
                  <ToolNode
                    key={tool.name}
                    tool={tool}
                    color={s.color}
                    isVisible={isActive}
                    pos={nodePos}
                    idx={idx}
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
