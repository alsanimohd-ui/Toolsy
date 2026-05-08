"use client";

import Centerpiece from "@/components/home/Centerpiece";
import RadialMenu from "@/components/home/RadialMenu";
import { motion } from "framer-motion";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────
// AMBIENT PARTICLES — subtle cinematic atmosphere
// ─────────────────────────────────────────────────────────────
const ambientParticles = [
  { x: "8%", y: "18%", size: "2px", delay: 0, duration: 14 },
  { x: "18%", y: "72%", size: "1.5px", delay: 1.2, duration: 12 },
  { x: "27%", y: "34%", size: "1.5px", delay: 2.3, duration: 16 },
  { x: "36%", y: "82%", size: "2px", delay: 0.5, duration: 13 },
  { x: "44%", y: "14%", size: "1.5px", delay: 3.1, duration: 15 },
  { x: "58%", y: "76%", size: "2px", delay: 1.7, duration: 14 },
  { x: "66%", y: "24%", size: "1.5px", delay: 2.6, duration: 12 },
  { x: "78%", y: "64%", size: "2px", delay: 0.9, duration: 17 },
  { x: "88%", y: "30%", size: "1.5px", delay: 3.8, duration: 13 },
  { x: "92%", y: "84%", size: "2px", delay: 1.4, duration: 11 },
];

export default function HomePage() {
  return (
    <main className="toolsy-home-shell relative flex flex-col items-center bg-background text-foreground transition-colors duration-500">

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CINEMATIC ATMOSPHERIC LAYERS */}
      {/* ═══════════════════════════════════════════════════════ */}

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">

        {/* Primary holographic gradient — multi-source */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle 60% 50% at 50% 48%, rgba(37,99,235,0.12) 0%, transparent 65%),
              radial-gradient(circle 40% 35% at 20% 25%, rgba(14,165,233,0.08) 0%, transparent 60%),
              radial-gradient(circle 40% 35% at 80% 28%, rgba(239,68,68,0.08) 0%, transparent 60%),
              radial-gradient(circle 35% 30% at 15% 75%, rgba(168,85,247,0.06) 0%, transparent 55%),
              radial-gradient(circle 35% 30% at 85% 72%, rgba(34,211,238,0.05) 0%, transparent 55%)
            `,
          }}
        />

        {/* Dark mode premium gradients */}
        <div
          className="absolute inset-0 dark:opacity-100 opacity-0 transition-opacity duration-1000"
          style={{
            background: `
              radial-gradient(circle 55% 45% at 50% 48%, rgba(124,106,255,0.18) 0%, transparent 60%),
              radial-gradient(circle 35% 30% at 22% 28%, rgba(59,130,246,0.12) 0%, transparent 55%),
              radial-gradient(circle 35% 30% at 78% 30%, rgba(239,68,68,0.10) 0%, transparent 55%),
              radial-gradient(circle 30% 25% at 80% 75%, rgba(168,85,247,0.08) 0%, transparent 50%),
              radial-gradient(circle 30% 25% at 18% 72%, rgba(34,211,238,0.06) 0%, transparent 50%)
            `,
          }}
        />

        {/* Primary structural tech ring — breathing */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0.06, scale: 0.99, rotate: 0 }}
          animate={{
            opacity: [0.06, 0.12, 0.06],
            scale: [0.99, 1.01, 0.99],
            rotate: [0, 1.5, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute left-1/2 top-[48%] h-[1200px] w-[1200px] -translate-x-1/2 -translate-y-1/2 rounded-full
            border border-accent/6 dark:border-white/4
            shadow-[0_0_180px_rgba(37,99,235,0.06)] dark:shadow-[0_0_220px_rgba(124,106,255,0.08)]"
        />

        {/* Secondary structural ring */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0.04, scale: 1.01, rotate: 0 }}
          animate={{
            opacity: [0.04, 0.08, 0.04],
            scale: [1.01, 0.99, 1.01],
            rotate: [0, -1, 0],
          }}
          transition={{
            duration: 24,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute left-1/2 top-[48%] h-[1600px] w-[1600px] -translate-x-1/2 -translate-y-1/2 rounded-full
            border border-accent/3 dark:border-white/2"
        />

        {/* Micro-grid pattern — precision aesthetic */}
        <div
          className="absolute inset-0 opacity-[0.06] dark:opacity-[0.03]
            [background-image:radial-gradient(circle_at_center,currentColor_0.5px,transparent_0.5px)]
            [background-size:28px_28px]
            [background-position:0_0]"
        />

        {/* Precision grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.015]
            [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)]
            [background-size:56px_56px]"
        />

        {/* Vignette — cinematic framing */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 70% 60% at center, transparent 0%, transparent 40%, rgba(0,0,0,0.15) 100%),
              radial-gradient(ellipse 100% 50% at center bottom, transparent 0%, transparent 60%, rgba(0,0,0,0.08) 100%)
            `,
          }}
        />

        {/* Bottom ambient glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[35vh]
            bg-gradient-to-t from-background via-background/50 to-transparent"
        />

        {/* Top edge darkening */}
        <div
          className="absolute top-0 left-0 right-0 h-[10vh]
            bg-gradient-to-b from-black/5 via-transparent to-transparent"
        />

        {/* Floating particles */}
        {ambientParticles.map((particle, index) => (
          <motion.span
            key={index}
            className="absolute rounded-full"
            style={{
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              background: 'var(--accent)',
              boxShadow: '0 0 6px var(--accent-glow)',
            }}
            initial={{ opacity: 0, y: "0%", x: "0%" }}
            animate={{
              opacity: [0, 0.35, 0],
              y: ["0%", "-180%"],
              x: ["0%", index % 2 === 0 ? "40%" : "-40%"],
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MAIN STAGE */}
      {/* ═══════════════════════════════════════════════════════ */}

      <section className="toolsy-home-stage relative z-10 flex w-full min-h-0 flex-1 items-center justify-center">
        <div className="toolsy-radial-scale relative flex items-center justify-center">

          {/* Radial category menu */}
          <RadialMenu />

          {/* Center core — living cybernetic sphere */}
          <div className="relative z-30 aspect-square w-[30%]">
            <Centerpiece />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FOOTER — minimal portal footer */}
      {/* ═══════════════════════════════════════════════════════ */}

      <footer className="toolsy-portal-footer relative z-10 w-full shrink-0
        border-t border-border/50 dark:border-white/8
        bg-background/30 dark:bg-background/40
        backdrop-blur-2xl">

        <div className="mx-auto flex h-full w-full max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2
          px-[var(--space-page-x)] text-center md:justify-between md:text-left">

          {/* Status indicator */}
          <div className="flex items-center gap-3">
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="h-1.5 w-1.5 rounded-full bg-accent"
              style={{ boxShadow: '0 0 12px var(--accent-glow)' }}
            />
            <span className="toolsy-meta text-foreground/60 dark:text-white/50">
              Toolsy Portal
            </span>
          </div>

          {/* Navigation */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2
            text-[10px] font-black uppercase tracking-[0.24em] text-muted
            sm:gap-6 sm:tracking-[0.32em]">
            <Link
              href="/tools"
              className="transition-all duration-500 hover:text-accent
                hover:drop-shadow-[0_0_12px_var(--accent-glow)]"
            >
              Enter
            </Link>
            <a
              href="https://github.com"
              className="hidden transition-colors hover:text-accent sm:inline"
            >
              Source
            </a>
            <a
              href="#"
              className="transition-colors hover:text-accent"
            >
              Docs
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
