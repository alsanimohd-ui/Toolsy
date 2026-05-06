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
    startAngle: -150, // Perfectly balanced 110 deg
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
    startAngle: 200, // Balanced bottom segment
    endAngle: 90,   // Flipped for upright text (counter-clockwise)
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

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const cx = 450;
  const cy = 450;
  const mainRadius = 310;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
      <svg 
        viewBox="0 0 900 900" 
        className="w-[900px] h-[900px] pointer-events-auto overflow-visible"
      >
        <defs>
          {segments.map((s) => (
            <filter key={`glow-${s.id}`} id={`glow-${s.id}`}>
              <feGaussianBlur stdDeviation="15" result="blur" />
              <feComposite in="SourceGraphic" operator="over" />
            </filter>
          ))}
          {/* Paths for text labels - Perfectly centered in arc */}
          {segments.map((s) => (
            <path
              key={`path-${s.id}`}
              id={`path-${s.id}`}
              d={describeArc(cx, cy, mainRadius, s.startAngle, s.endAngle, s.clockwise)}
            />
          ))}
        </defs>

        {/* Subtle background guide ring */}
        <circle
          cx={cx}
          cy={cy}
          r={mainRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="opacity-[0.05] text-foreground dark:text-white"
        />

        {segments.map((s) => {
          const isHovered = hoveredSegment === s.id;
          const isActive = activeSegment === s.id;
          const isSelected = isHovered || isActive;
          
          // Use a fixed clockwise path for the visual arc to avoid "flipping" animation
          const visualArc = describeArc(cx, cy, mainRadius, s.clockwise ? s.startAngle : s.endAngle, s.clockwise ? s.endAngle : s.startAngle, true);
          
          const midAngle = (s.startAngle + s.endAngle) / 2;

          return (
            <g
              key={s.id}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredSegment(s.id)}
              onMouseLeave={() => setHoveredSegment(null)}
              onClick={() => scrollToSection(s.id)}
            >
              {/* Vibrant Arc Segment */}
              <motion.path
                d={visualArc}
                fill="none"
                stroke={s.color}
                strokeWidth={56}
                strokeLinecap="round"
                initial={{ opacity: 0, pathLength: 0 }}
                animate={{ 
                  pathLength: 1,
                  opacity: isSelected ? 0.95 : 0.1,
                  strokeWidth: isSelected ? 62 : 56,
                }}
                transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
                style={{ 
                  filter: isSelected ? `drop-shadow(0 0 30px ${s.color}66)` : "none"
                }}
              />

              {/* Upright Label */}
              <text className="pointer-events-none select-none uppercase tracking-[0.5em] font-black text-[14px]">
                <textPath
                  href={`#path-${s.id}`}
                  startOffset="50%"
                  textAnchor="middle"
                  className="fill-white dark:fill-white"
                  style={{ 
                    opacity: isSelected ? 1 : 0.3,
                    transition: "opacity 0.3s ease",
                    filter: isSelected ? "drop-shadow(0 0 10px rgba(255,255,255,0.5))" : "none"
                  }}
                >
                  {s.label}
                </textPath>
              </text>

              {/* Rich Tool Cards */}
              <AnimatePresence>
                {isSelected && (
                  <g>
                    {s.tools.map((tool, idx) => {
                      const angleOffset = (idx - 1) * 28;
                      const toolPos = polarToCartesian(cx, cy, mainRadius + 115, midAngle + angleOffset);
                      const Icon = tool.icon;
                      
                      return (
                        <foreignObject
                          key={tool.name}
                          x={toolPos.x - 75}
                          y={toolPos.y - 40}
                          width="150"
                          height="80"
                          className="overflow-visible"
                        >
                          <Link
                            href={tool.route}
                            target={tool.isExternal ? "_blank" : undefined}
                          >
                            <motion.div
                              initial={{ opacity: 0, y: 20, scale: 0.8, rotateX: -20 }}
                              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                              exit={{ opacity: 0, y: 10, scale: 0.8 }}
                              transition={{ 
                                type: "spring",
                                stiffness: 260,
                                damping: 20,
                                delay: idx * 0.05 
                              }}
                              className="flex items-center gap-4 p-4 rounded-3xl 
                                bg-white/30 dark:bg-black/60 backdrop-blur-3xl 
                                border border-white/40 dark:border-white/10 
                                hover:bg-white/40 dark:hover:bg-black/80 transition-all group shadow-2xl"
                            >
                              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tool.gradient} 
                                flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:rotate-6 transition-transform`}>
                                <Icon className="w-6 h-6 text-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-black text-foreground dark:text-white uppercase tracking-tight">
                                  {tool.name}
                                </span>
                                <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <span className="text-[9px] font-bold uppercase tracking-tighter">Launch</span>
                                  <ArrowUpRight className="w-3 h-3" />
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
