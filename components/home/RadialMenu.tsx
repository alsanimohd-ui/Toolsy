"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import { 
  ArrowUpRight, 
  Braces, 
  FileCode, 
  Table2, 
  ShieldCheck, 
  Key, 
  FileSearch, 
  Terminal, 
  Filter, 
  Bug 
} from "lucide-react";

interface RadialMenuProps {
  activeSegment?: string | null;
}

const segments = [
  {
    id: "data",
    label: "DATA",
    color: "#3b82f6",
    startAngle: -150,
    endAngle: -40,
    clockwise: true,
    tools: [
      { name: "JSON Lego", route: "https://jsonlego.app", icon: Braces, isExternal: true, gradient: "from-blue-400 to-cyan-400" },
      { name: "Paste → Code", route: "/tools/paste-to-code", icon: FileCode, gradient: "from-blue-500 to-indigo-500" },
      { name: "CSV Tool", route: "/tools/csv-tool", icon: Table2, gradient: "from-cyan-500 to-blue-500" },
    ],
  },
  {
    id: "security",
    label: "SECURITY",
    color: "#ef4444",
    startAngle: -30,
    endAngle: 80,
    clockwise: true,
    tools: [
      { name: "SSL Toolkit", route: "/tools/ssl-toolkit", icon: ShieldCheck, gradient: "from-red-400 to-orange-400" },
      { name: "PFX Gen", route: "/tools/pfx-generator", icon: Key, gradient: "from-red-500 to-rose-500" },
      { name: "Decoder", route: "/tools/decoder", icon: FileSearch, gradient: "from-rose-500 to-red-500" },
    ],
  },
  {
    id: "logs",
    label: "LOGS",
    color: "#a855f7",
    startAngle: 200,
    endAngle: 90,
    clockwise: false,
    tools: [
      { name: "Analyzer", route: "/tools/log-analyzer", icon: Terminal, gradient: "from-purple-400 to-fuchsia-400" },
      { name: "Filter", route: "/tools/log-filter", icon: Filter, gradient: "from-purple-500 to-violet-500" },
      { name: "Errors", route: "/tools/error-finder", icon: Bug, gradient: "from-fuchsia-500 to-purple-500" },
    ],
  },
];

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number, clockwise: boolean = true) {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";
  const sweepFlag = clockwise ? "1" : "0";
  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, sweepFlag, end.x, end.y].join(" ");
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

export default function RadialMenu({ activeSegment }: RadialMenuProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const cx = 450;
  const cy = 450;
  const mainRadius = 300;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
      <svg 
        viewBox="0 0 900 900" 
        className="w-full h-full pointer-events-auto overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {segments.map((s) => (
            <filter key={`glow-${s.id}`} id={`glow-${s.id}`}>
              <feGaussianBlur stdDeviation="12" result="blur" />
              <feComposite in="SourceGraphic" operator="over" />
            </filter>
          ))}
          {segments.map((s) => (
            <path
              key={`path-${s.id}`}
              id={`path-${s.id}`}
              d={describeArc(cx, cy, mainRadius, s.startAngle, s.endAngle, s.clockwise)}
            />
          ))}
        </defs>

        <circle
          cx={cx}
          cy={cy}
          r="410"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="6 48"
          className="opacity-10 dark:opacity-[0.05] text-slate-400 dark:text-white"
        />

        {segments.map((s) => {
          const isHovered = hoveredSegment === s.id;
          const isActive = activeSegment === s.id;
          const isSelected = isHovered || isActive;
          
          const visualArc = describeArc(cx, cy, mainRadius, s.clockwise ? s.startAngle : s.endAngle, s.clockwise ? s.endAngle : s.startAngle, true);
          const midAngle = (s.startAngle + s.endAngle) / 2;

          return (
            <g
              key={s.id}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredSegment(s.id)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {/* Vibrant Arc Segment - Higher opacity in light mode */}
              <motion.path
                d={visualArc}
                fill="none"
                stroke={s.color}
                strokeWidth={54}
                strokeLinecap="round"
                initial={{ opacity: 0, pathLength: 0 }}
                animate={{ 
                  pathLength: 1,
                  opacity: isSelected ? 0.95 : 0.15, // Increased base opacity
                  strokeWidth: isSelected ? 60 : 54,
                }}
                transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                style={{ 
                  filter: isSelected ? `drop-shadow(0 0 25px ${s.color}66)` : "none"
                }}
              />

              {/* Upright Label - High contrast for light mode */}
              <text className="pointer-events-none select-none uppercase tracking-[0.5em] font-black text-[13px]">
                <textPath
                  href={`#path-${s.id}`}
                  startOffset="50%"
                  textAnchor="middle"
                  className="fill-slate-900 dark:fill-white" // DARK in light mode
                  style={{ 
                    opacity: isSelected ? 1 : 0.4, // Increased base opacity
                    transition: "opacity 0.3s ease"
                  }}
                >
                  {s.label}
                </textPath>
              </text>

              {/* Tool Cards */}
              <AnimatePresence>
                {isSelected && (
                  <g>
                    {s.tools.map((tool, idx) => {
                      const angleOffset = (idx - 1) * 26;
                      const toolPos = polarToCartesian(cx, cy, mainRadius + 110, midAngle + angleOffset);
                      const Icon = tool.icon;
                      
                      return (
                        <foreignObject
                          key={tool.name}
                          x={toolPos.x - 70}
                          y={toolPos.y - 35}
                          width="140"
                          height="70"
                          className="overflow-visible"
                        >
                          <Link
                            href={tool.route}
                            target={tool.isExternal ? "_blank" : undefined}
                          >
                            <motion.div
                              initial={{ opacity: 0, y: 15, scale: 0.8 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.8 }}
                              transition={{ 
                                type: "spring",
                                stiffness: 300,
                                damping: 20,
                                delay: idx * 0.05 
                              }}
                              className="flex items-center gap-3 p-3 rounded-2xl 
                                bg-white/60 dark:bg-black/40 backdrop-blur-3xl 
                                border border-slate-200 dark:border-white/10 
                                hover:bg-white/80 dark:hover:bg-black/60 transition-all group shadow-2xl"
                            >
                              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.gradient} 
                                flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                  {tool.name}
                                </span>
                                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <span className="text-[8px] font-bold uppercase tracking-tighter text-slate-500 dark:text-white/40">Open</span>
                                  <ArrowUpRight className="w-2 h-2 text-slate-500 dark:text-white/40" />
                                </div>
                              </div>
                            </motion.div>
                          </Link>
                        </foreignObject>
                      );
                    })}
                  </g>
                )}
              </AnimatePresence>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
