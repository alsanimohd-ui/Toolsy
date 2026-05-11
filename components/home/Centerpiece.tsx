"use client";

import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { CategoryId } from "@/lib/tools";
import { toolCategories } from "@/lib/tools";
import { ShieldCheck, Database, Code2, Sparkles } from "lucide-react";

interface CenterpieceProps {
  activeSegment?: CategoryId | null;
}

// Apple-inspired spring physics
const SPRING_CRISP = { type: "spring" as const, stiffness: 340, damping: 28, mass: 0.6 };
const SPRING_SOFT = { type: "spring" as const, stiffness: 180, damping: 22, mass: 0.8 };
const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const categoryIcons: Record<CategoryId, React.ElementType> = {
  "network-security": ShieldCheck,
  "data-analytics": Database,
  "dev-automation": Code2,
};

// Orbital ring definitions — layered depth
const ORBITAL_RINGS = [
  { inset: "-52%", duration: 38, reverse: false, dashArray: "2 7", opacity: 0.18 },
  { inset: "-38%", duration: 52, reverse: true, dashArray: "1 14", opacity: 0.12 },
  { inset: "-24%", duration: 29, reverse: false, dashArray: "3 5", opacity: 0.22 },
  { inset: "-14%", duration: 18, reverse: true, dashArray: "2 9", opacity: 0.16 },
];

export default function Centerpiece({ activeSegment }: CenterpieceProps) {
  const activeCategory = activeSegment ? toolCategories[activeSegment] : null;
  const activeColor = activeCategory?.color ?? "#7c6aff";
  const activeGlow = activeCategory?.glowColor ?? "rgba(124,106,255,0.5)";
  const CategoryIcon = activeSegment ? categoryIcons[activeSegment] : Sparkles;

  // Mouse parallax for depth effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 18 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 18 });
  const innerX = useTransform(springX, (v) => v * 0.4);
  const innerY = useTransform(springY, (v) => v * 0.4);

  return (
    <Link
      href="/tools"
      aria-label="Enter Toolsy — the AI tools operating system"
      className="group/core block h-full w-full rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set(((e.clientX - rect.left) / rect.width - 0.5) * 28);
        mouseY.set(((e.clientY - rect.top) / rect.height - 0.5) * 28);
      }}
      onMouseLeave={() => {
        mouseX.set(0);
        mouseY.set(0);
      }}
    >
      <motion.div
        className="relative flex h-full w-full items-center justify-center"
        whileHover="hover"
        initial="rest"
        animate={activeSegment ? "active" : "rest"}
      >

        {/* ── ATMOSPHERIC OUTER GLOW — ambient light bloom ── */}
        <motion.div
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{ inset: "-45%" }}
          variants={{
            rest:   { opacity: 0.18, scale: 0.97 },
            active: { opacity: 0.42, scale: 1.06 },
            hover:  { opacity: 0.55, scale: 1.12 },
          }}
          transition={SPRING_SOFT}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${activeColor}44 0%, ${activeColor}18 40%, transparent 70%)`,
              filter: "blur(40px)",
            }}
          />
        </motion.div>

        {/* ── ORBITAL RINGS — planetary depth system ── */}
        {ORBITAL_RINGS.map((ring, i) => (
          <motion.div
            key={i}
            aria-hidden
            className="absolute rounded-full pointer-events-none"
            style={{ inset: ring.inset }}
            animate={{ rotate: ring.reverse ? -360 : 360 }}
            transition={{ duration: ring.duration, repeat: Infinity, ease: "linear" }}
          >
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              fill="none"
            >
              <circle
                cx="50"
                cy="50"
                r="48"
                stroke={i === 0 ? activeColor : "var(--cp-ring-base)"}
                strokeWidth={i === 0 ? "0.4" : "0.25"}
                strokeDasharray={ring.dashArray}
                strokeOpacity={ring.opacity}
              />
            </svg>
          </motion.div>
        ))}

        {/* ── CONIC SWEEP RING — active state accent ── */}
        <motion.div
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{ inset: "-28%" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, ${activeColor}28 45deg, transparent 90deg, transparent 360deg)`,
            }}
          />
        </motion.div>

        {/* ── GLASS SPHERE — the main body ── */}
        <motion.div
          className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full cursor-pointer"
          style={{
            background: "var(--cp-glass-bg)",
            backdropFilter: "blur(32px) saturate(180%)",
            WebkitBackdropFilter: "blur(32px) saturate(180%)",
            boxShadow: "var(--cp-glass-shadow)",
          }}
          variants={{
            rest:   { scale: 1 },
            active: { scale: 1.025 },
            hover:  { scale: 1.04 },
          }}
          transition={SPRING_CRISP}
        >

          {/* Interior glass refraction — premium depth fill */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `
                var(--cp-glass-refract),
                radial-gradient(ellipse 55% 40% at 68% 78%, ${activeColor}14 0%, transparent 55%),
                radial-gradient(circle at 50% 50%, ${activeColor}18 0%, transparent 50%)
              `,
            }}
          />

          {/* Rotating mesh interior — subtle sci-fi texture */}
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full pointer-events-none opacity-[0.07]"
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
            style={{
              backgroundImage: `
                linear-gradient(var(--cp-mesh-color) 0.5px, transparent 0.5px),
                linear-gradient(90deg, var(--cp-mesh-color) 0.5px, transparent 0.5px)
              `,
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(circle, black 0%, transparent 72%)",
              WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 72%)",
            }}
          />

          {/* Parallax inner sanctum — reacts to mouse */}
          <motion.div
            aria-hidden
            className="absolute inset-[22%] rounded-full pointer-events-none"
            style={{ x: innerX, y: innerY }}
          >
            {/* Inner glow pulse — the "heart" */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: `radial-gradient(circle, ${activeColor}55 0%, transparent 65%)` }}
              animate={{
                scale: activeSegment ? [0.85, 1.1, 0.85] : [0.9, 1.05, 0.9],
                opacity: activeSegment ? [0.5, 0.85, 0.5] : [0.3, 0.55, 0.3],
              }}
              transition={{ duration: activeSegment ? 2.8 : 4.2, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Inner ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: `1px solid ${activeColor}40`,
                boxShadow: `inset 0 0 20px ${activeColor}20`,
              }}
            />
          </motion.div>

          {/* ── CENTER CONTENT — hero typography ── */}
          <motion.div
            className="relative z-20 flex w-full flex-col items-center justify-center px-[10%] text-center select-none"
            style={{ x: springX, y: springY }}
          >

            {/* Status chip — Dynamic Island inspired */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSegment ?? "default"}
                initial={{ opacity: 0, scale: 0.85, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: -4 }}
                transition={{ ...SPRING_CRISP, delay: 0.05 }}
                className="mb-[0.6em] flex items-center gap-[0.4em] rounded-full px-[0.8em] py-[0.25em]"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <motion.span
                  className="flex-shrink-0 rounded-full"
                  style={{
                    width: "0.5em",
                    height: "0.5em",
                    background: activeColor,
                    boxShadow: `0 0 8px ${activeGlow}`,
                  }}
                  animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
                <span
                  className="font-black uppercase tracking-[0.36em] text-white/75"
                  style={{ fontSize: "clamp(4.5px, 0.6vw, 7.5px)" }}
                >
                  {activeCategory ? activeCategory.shortLabel : "AI Core"}
                </span>
              </motion.div>
            </AnimatePresence>

            {/* Main wordmark */}
            <motion.h1
              className="font-black tracking-[-0.02em] text-white"
              style={{
                fontSize: "clamp(1.65rem, 4.4vw, 3.2rem)",
                lineHeight: 0.95,
                textShadow: `0 0 30px ${activeGlow}`,
                letterSpacing: "-0.025em",
              }}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.9, ease: EASE_EXPO }}
            >
              Toolsy
            </motion.h1>

            {/* Hairline separator */}
            <motion.div
              className="my-[0.55em] flex w-[72%] items-center gap-[0.4em]"
              initial={{ opacity: 0, scaleX: 0.6 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.3, duration: 0.7, ease: EASE_EXPO }}
            >
              <div
                className="h-px flex-1"
                style={{ background: `linear-gradient(90deg, transparent, ${activeColor}88, transparent)` }}
              />
              <motion.div
                className="rounded-full flex-shrink-0"
                style={{
                  width: "0.32em",
                  height: "0.32em",
                  background: `${activeColor}`,
                  boxShadow: `0 0 8px ${activeGlow}`,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
              <div
                className="h-px flex-1"
                style={{ background: `linear-gradient(90deg, transparent, ${activeColor}88, transparent)` }}
              />
            </motion.div>

            {/* Active category icon + CTA */}
            <AnimatePresence mode="wait">
              {activeCategory ? (
                <motion.div
                  key={`icon-${activeSegment}`}
                  className="flex flex-col items-center gap-[0.3em]"
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.92 }}
                  transition={SPRING_CRISP}
                >
                  <CategoryIcon
                    strokeWidth={1.8}
                    style={{
                      color: activeColor,
                      width: "clamp(14px, 1.8vw, 22px)",
                      height: "clamp(14px, 1.8vw, 22px)",
                      filter: `drop-shadow(0 0 10px ${activeGlow})`,
                    }}
                  />
                  <span
                    className="font-black uppercase tracking-[0.22em] text-white/55"
                    style={{ fontSize: "clamp(4px, 0.52vw, 6.5px)" }}
                  >
                    Explore
                  </span>
                </motion.div>
              ) : (
                <motion.p
                  key="cta"
                  className="font-black uppercase tracking-[0.3em] text-white/50 transition-colors group-hover/core:text-white/80"
                  style={{ fontSize: "clamp(4.5px, 0.6vw, 7.5px)" }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ delay: 0.45, duration: 0.7, ease: EASE_EXPO }}
                >
                  Enter Portal
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bottom specular highlight */}
          <div
            aria-hidden
            className="absolute bottom-0 left-[15%] right-[15%] h-px pointer-events-none"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            }}
          />
        </motion.div>

        {/* ── ENERGY PARTICLES — orbiting micro-dots ── */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const angle = (i / 8) * 360;
          const orbitRadius = 54; // % of container
          const x = Math.cos(((angle - 90) * Math.PI) / 180) * orbitRadius;
          const y = Math.sin(((angle - 90) * Math.PI) / 180) * orbitRadius;
          return (
            <motion.div
              key={i}
              aria-hidden
              className="absolute rounded-full pointer-events-none"
              style={{
                width: "clamp(1.5px, 0.22vw, 3px)",
                height: "clamp(1.5px, 0.22vw, 3px)",
                left: `calc(50% + ${x}%)`,
                top: `calc(50% + ${y}%)`,
                background: i % 3 === 0 ? activeColor : "white",
                boxShadow: `0 0 8px ${i % 3 === 0 ? activeGlow : "rgba(255,255,255,0.6)"}`,
                translateX: "-50%",
                translateY: "-50%",
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: [0, 0.7, 0],
                scale: [0.5, 1.2, 0.5],
              }}
              transition={{
                duration: 3.2 + i * 0.38,
                delay: i * 0.42,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </motion.div>
    </Link>
  );
}
