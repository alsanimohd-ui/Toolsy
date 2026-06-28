"use client";

import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { CategoryId } from "@/lib/tools";
import { toolCategories } from "@/lib/tools";
import { ShieldCheck, Database, Code2, Sparkles } from "lucide-react";

interface CenterpieceProps {
  activeSegment?: CategoryId | null;
}

const SPRING_CRISP = { type: "spring" as const, stiffness: 340, damping: 28, mass: 0.6 };
const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const categoryIcons: Record<CategoryId, React.ElementType> = {
  "network-security": ShieldCheck,
  "data-analytics": Database,
  "dev-automation": Code2,
};

const ORBITAL_RINGS = [
  { inset: "-52%", duration: 38, reverse: false, dashArray: "2 7", opacity: 0.18 },
  { inset: "-38%", duration: 52, reverse: true, dashArray: "1 14", opacity: 0.12 },
];

export default function Centerpiece({ activeSegment }: CenterpieceProps) {
  const activeCategory = activeSegment ? toolCategories[activeSegment] : null;
  const activeColor = activeCategory?.color ?? "var(--accent)";
  const activeGlow = activeCategory?.glowColor ?? "var(--accent-glow)";
  const CategoryIcon = activeSegment ? categoryIcons[activeSegment] : Sparkles;

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 18 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 18 });
  const innerX = useTransform(springX, (v) => v * 0.4);
  const innerY = useTransform(springY, (v) => v * 0.4);

  return (
    <Link
      href="/tools"
      aria-label="Enter Mi"
      className="group/core block h-full w-full rounded-full focus:outline-none"
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
        {/* Outer ambient glow */}
        <motion.div
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{ inset: "-45%" }}
          variants={{
            rest:   { opacity: 0.25, scale: 0.97 },
            active: { opacity: 0.5, scale: 1.06 },
            hover:  { opacity: 0.6, scale: 1.12 },
          }}
          transition={SPRING_CRISP}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${activeColor} 30%, transparent) 0%, color-mix(in srgb, ${activeColor} 10%, transparent) 40%, transparent 70%)`,
              filter: "blur(40px)",
            }}
          />
        </motion.div>

        {/* Orbital rings */}
        {ORBITAL_RINGS.map((ring, i) => (
          <motion.div
            key={i}
            aria-hidden
            className="absolute rounded-full pointer-events-none"
            style={{ inset: ring.inset }}
            animate={{ rotate: ring.reverse ? -360 : 360 }}
            transition={{ duration: ring.duration, repeat: Infinity, ease: "linear" }}
          >
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" fill="none" aria-hidden="true">
              <circle
                cx="50" cy="50" r="48"
                stroke={i === 0 ? activeColor : "var(--cp-ring-base)"}
                strokeWidth={i === 0 ? "0.6" : "0.3"}
                strokeDasharray={ring.dashArray}
                strokeOpacity={ring.opacity}
              />
            </svg>
          </motion.div>
        ))}

        {/* Holographic Core Glass Sphere */}
        <motion.div
          className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full cursor-pointer"
          style={{
            background: "var(--cp-glass-bg)",
            boxShadow: "var(--cp-glass-shadow)",
            border: `1px solid color-mix(in srgb, ${activeColor} 25%, transparent)`,
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
          }}
          variants={{
            rest:   { scale: 1 },
            active: { scale: 1.03 },
            hover:  { scale: 1.05 },
          }}
          transition={SPRING_CRISP}
        >
          {/* Core pulsing energy */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${activeColor}66 0%, transparent 60%)` }}
            animate={{
              scale: activeSegment ? [0.8, 1.1, 0.8] : [0.9, 1.05, 0.9],
              opacity: activeSegment ? [0.6, 1, 0.6] : [0.4, 0.7, 0.4],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Rotating wireframe globe */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ x: innerX, y: innerY }}
          >
            <motion.svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full opacity-50"
              animate={{ rotate: -360 }}
              transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
              aria-hidden="true"
            >
              <g stroke={activeColor} strokeWidth="0.5" fill="none">
                <ellipse cx="50" cy="50" rx="46" ry="46" />
                <ellipse cx="50" cy="50" rx="46" ry="32" />
                <ellipse cx="50" cy="50" rx="46" ry="16" />
                <ellipse cx="50" cy="50" rx="32" ry="46" />
                <ellipse cx="50" cy="50" rx="16" ry="46" />
                <line x1="50" y1="4" x2="50" y2="96" />
                <line x1="4" y1="50" x2="96" y2="50" />
              </g>
            </motion.svg>
          </motion.div>

          {/* Refraction highlight */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none opacity-30 dark:opacity-20"
            style={{ background: "var(--cp-glass-refract)" }}
          />

          {/* Hero Typography */}
          <motion.div
            className="relative z-20 flex w-full flex-col items-center justify-center px-[10%] text-center select-none"
            style={{ x: springX, y: springY }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSegment ?? "default"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ ...SPRING_CRISP, delay: 0.05 }}
                className="mb-2 flex items-center gap-2 rounded-full px-3 py-1 bg-white/5 border border-white/10 backdrop-blur-md"
              >
                <motion.span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: `color-mix(in srgb, ${activeColor} 100%, transparent)`, boxShadow: `0 0 10px ${activeGlow}` }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="font-bold uppercase tracking-[0.3em] text-[var(--content-secondary)] text-[13px]">
                  {activeCategory ? activeCategory.shortLabel : "ENTER"}
                </span>
              </motion.div>
            </AnimatePresence>

            <motion.h1
              className="font-black text-[var(--content-primary)]"
              style={{
                fontSize: "clamp(2rem, 5vw, 4rem)",
                lineHeight: 1,
                textShadow: `0 0 40px ${activeGlow}, 0 0 15px ${activeColor}`,
                letterSpacing: "-0.03em",
              }}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.9, ease: EASE_EXPO }}
            >
              Mi
            </motion.h1>

            <motion.div
              className="my-3 w-12 h-1 rounded-full"
              style={{ background: `color-mix(in srgb, ${activeColor} 100%, transparent)`, boxShadow: `0 0 10px ${activeGlow}` }}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.3, duration: 0.7 }}
            />

            <AnimatePresence mode="wait">
              {activeCategory ? (
                <motion.div
                  key={`icon-${activeSegment}`}
                  className="flex flex-col items-center gap-1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                >
                  <CategoryIcon size={24} color={activeColor} style={{ filter: `drop-shadow(0 0 10px ${activeGlow})` }} />
                </motion.div>
              ) : (
                <motion.p
                  key="cta"
                  className="font-bold uppercase tracking-[0.25em] text-[var(--content-muted)] text-[13px]"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  System Active
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.div>
    </Link>
  );
}
