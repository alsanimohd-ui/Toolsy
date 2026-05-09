"use client";

import Centerpiece from "@/components/home/Centerpiece";
import RadialMenu from "@/components/home/RadialMenu";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import type { CategoryId } from "@/lib/tools";

// ─────────────────────────────────────────────────────────────
// AMBIENT PARTICLES — minimal, intentional
// ─────────────────────────────────────────────────────────────
const PARTICLES = [
  { x: "7%",  y: "16%", dur: 16, delay: 0,   drift: -1 },
  { x: "17%", y: "71%", dur: 13, delay: 1.4, drift:  1 },
  { x: "28%", y: "33%", dur: 18, delay: 2.8, drift: -1 },
  { x: "38%", y: "84%", dur: 14, delay: 0.7, drift:  1 },
  { x: "62%", y: "78%", dur: 15, delay: 1.9, drift: -1 },
  { x: "72%", y: "22%", dur: 12, delay: 3.2, drift:  1 },
  { x: "84%", y: "62%", dur: 17, delay: 0.4, drift: -1 },
  { x: "91%", y: "29%", dur: 14, delay: 2.1, drift:  1 },
];

export default function HomePage() {
  const [activeSegment, setActiveSegment] = useState<CategoryId | null>(null);

  return (
    <main className="toolsy-home-shell">

      {/* ═══════════════════════════════════════════════════ */}
      {/* ATMOSPHERIC DEPTH LAYERS                           */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>

        {/* ── BASE AMBIENT GRADIENT — central glow pool ── */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 72% 60% at 50% 46%, rgba(124,106,255,0.14) 0%, transparent 62%),
              radial-gradient(ellipse 45% 38% at 18% 22%, rgba(59,130,246,0.10) 0%, transparent 58%),
              radial-gradient(ellipse 42% 36% at 82% 26%, rgba(239,68,68,0.08) 0%, transparent 55%),
              radial-gradient(ellipse 38% 32% at 80% 78%, rgba(168,85,247,0.07) 0%, transparent 50%),
              radial-gradient(ellipse 36% 30% at 14% 78%, rgba(34,211,238,0.05) 0%, transparent 48%)
            `,
          }}
        />

        {/* ── BREATHING CORE LIGHT — reacts to active state ── */}
        <motion.div
          className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: "48vmin", height: "48vmin" }}
          animate={{
            opacity: activeSegment ? [0.28, 0.42, 0.28] : [0.14, 0.22, 0.14],
            scale: activeSegment ? [0.95, 1.06, 0.95] : [0.97, 1.03, 0.97],
          }}
          transition={{ duration: activeSegment ? 3.2 : 5.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle at center, rgba(124,106,255,0.22) 0%, rgba(124,106,255,0.08) 45%, transparent 70%)",
              filter: "blur(32px)",
            }}
          />
        </motion.div>

        {/* ── STRUCTURE RINGS — architectural frame ── */}

        {/* Ring 1 — inner pulse */}
        <motion.div
          className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04]"
          style={{ width: "62vmin", height: "62vmin" }}
          animate={{
            opacity: [0.6, 1, 0.6],
            scale: [0.98, 1.01, 0.98],
            rotate: [0, 2, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Ring 2 — mid orbit */}
        <motion.div
          className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.025]"
          style={{ width: "85vmin", height: "85vmin" }}
          animate={{
            opacity: [0.5, 0.9, 0.5],
            scale: [1.01, 0.99, 1.01],
            rotate: [0, -1.5, 0],
          }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Ring 3 — outer vast */}
        <motion.div
          className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.015]"
          style={{ width: "115vmin", height: "115vmin" }}
          animate={{
            opacity: [0.4, 0.7, 0.4],
            rotate: [0, 1, 0],
          }}
          transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* ── DOT GRID — precision micro-texture ── */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.35) 0.5px, transparent 0.5px)",
            backgroundSize: "30px 30px",
            opacity: 0.04,
            maskImage: "radial-gradient(ellipse 80% 70% at 50% 46%, black 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 46%, black 20%, transparent 80%)",
          }}
        />

        {/* ── LIGHT BEAMS — cinematic diagonal accents ── */}
        <motion.div
          className="absolute h-px"
          style={{
            left: "-10%",
            width: "120%",
            top: "16%",
            rotate: "-14deg",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.22) 50%, rgba(124,106,255,0.14) 58%, transparent)",
            boxShadow: "0 0 20px rgba(124,106,255,0.15)",
            opacity: 0,
          }}
          animate={{ x: ["-18%", "18%"], opacity: [0, 0.45, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
        />
        <motion.div
          className="absolute h-px"
          style={{
            left: "-18%",
            width: "120%",
            bottom: "20%",
            rotate: "11deg",
            background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.16) 44%, rgba(255,255,255,0.18) 52%, transparent)",
            boxShadow: "0 0 16px rgba(59,130,246,0.12)",
            opacity: 0,
          }}
          animate={{ x: ["20%", "-10%"], opacity: [0, 0.28, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 3.5, repeatDelay: 4 }}
        />

        {/* ── CINEMATIC VIGNETTE ── */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 75% 65% at center, transparent 0%, transparent 38%, rgba(0,0,0,0.18) 100%),
              linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, transparent 12%, transparent 88%, rgba(0,0,0,0.12) 100%)
            `,
          }}
        />

        {/* Bottom fade to solid — grounds the page */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: "28%",
            background: "linear-gradient(to bottom, transparent, #020205)",
          }}
        />

        {/* ── AMBIENT PARTICLES — floating micro-dots ── */}
        {PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: p.x,
              top: p.y,
              width: "2px",
              height: "2px",
              background: "var(--accent)",
              boxShadow: "0 0 8px var(--accent-glow)",
            }}
            initial={{ opacity: 0, y: "0%", x: "0%" }}
            animate={{
              opacity: [0, 0.3, 0],
              y: ["0%", "-200%"],
              x: ["0%", `${p.drift * 50}%`],
            }}
            transition={{
              duration: p.dur,
              delay: p.delay,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* MAIN HERO STAGE                                     */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="toolsy-home-stage relative z-10">
        <div className="toolsy-radial-scale relative flex items-center justify-center">

          {/* Radial orbital category menu */}
          <RadialMenu
            activeSegment={activeSegment}
            onActiveSegmentChange={setActiveSegment}
          />

          {/* Living center core */}
          <div className="relative z-30 aspect-square w-[30%]">
            <Centerpiece activeSegment={activeSegment} />
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* PORTAL FOOTER — minimal glass bar                  */}
      {/* ═══════════════════════════════════════════════════ */}
      <footer className="toolsy-portal-footer relative z-10 w-full shrink-0">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-[var(--space-page-x)]">

          {/* System status */}
          <div className="flex items-center gap-2.5">
            <motion.span
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              className="h-1.5 w-1.5 rounded-full bg-accent"
              style={{ boxShadow: "0 0 10px var(--accent-glow)" }}
            />
            <span className="toolsy-meta text-white/45">
              Toolsy&nbsp;
              <span className="text-white/25">·</span>
              &nbsp;OS v1.0
            </span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-5">
            {[
              { label: "Enter", href: "/tools" },
              { label: "Source", href: "https://github.com", hidden: true },
              { label: "Docs", href: "#" },
            ].map(({ label, href, hidden }) => (
              <Link
                key={label}
                href={href}
                className={`toolsy-meta text-white/40 transition-all duration-300 hover:text-white/90 hover:drop-shadow-[0_0_12px_var(--accent-glow)] ${hidden ? "hidden sm:inline" : ""}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </main>
  );
}
