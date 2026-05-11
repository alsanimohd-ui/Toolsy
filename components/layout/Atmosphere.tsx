"use client";

import { motion } from "framer-motion";

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

export default function Atmosphere({ activeSegment = null }: { activeSegment?: string | null }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      
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

      {/* ── BREATHING CORE LIGHT ── */}
      <motion.div
        className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: "48vmin", height: "48vmin" }}
        animate={{
          opacity: activeSegment ? [0.4, 0.6, 0.4] : [0.2, 0.35, 0.2],
          scale: activeSegment ? [0.95, 1.06, 0.95] : [0.97, 1.03, 0.97],
        }}
        transition={{ duration: activeSegment ? 3.2 : 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle at center, var(--atmos-core-glow) 0%, var(--atmos-core-fade) 45%, transparent 70%)",
            filter: "blur(32px)",
          }}
        />
      </motion.div>

      {/* ── STRUCTURE RINGS ── */}
      <motion.div
        className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ width: "62vmin", height: "62vmin", borderColor: "var(--atmos-ring)" }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.98, 1.01, 0.98], rotate: [0, 2, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ width: "85vmin", height: "85vmin", borderColor: "var(--atmos-ring)", opacity: 0.6 }}
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [1.01, 0.99, 1.01], rotate: [0, -1.5, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── DOT GRID ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle at center, var(--atmos-dot) 0.5px, transparent 0.5px)",
          backgroundSize: "30px 30px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 46%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 46%, black 20%, transparent 80%)",
        }}
      />

      {/* ── LIGHT BEAMS ── */}
      <motion.div
        className="absolute h-px"
        style={{
          left: "-10%", width: "120%", top: "16%", rotate: "-14deg",
          background: "linear-gradient(90deg, transparent, var(--atmos-beam-fade) 30%, var(--atmos-beam) 50%, var(--atmos-core-glow) 58%, transparent)",
          boxShadow: "0 0 20px var(--atmos-core-fade)",
          opacity: 0,
        }}
        initial={{ x: "-18%", opacity: 0 }}
        animate={{ x: ["-18%", "18%"], opacity: [0, 1, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
      />

      {/* ── CINEMATIC VIGNETTE ── */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 75% 65% at center, transparent 0%, transparent 38%, var(--atmos-vignette-edge) 100%),
            linear-gradient(to bottom, transparent 0%, transparent 12%, transparent 88%, var(--atmos-vignette-shadow) 100%)
          `,
        }}
      />

      {/* ── AMBIENT PARTICLES ── */}
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: p.x, top: p.y, width: "2px", height: "2px",
            background: "var(--accent)",
            boxShadow: "0 0 8px var(--accent-glow)",
          }}
          initial={{ opacity: 0, y: "0%", x: "0%" }}
          animate={{
            opacity: [0, 0.3, 0],
            y: ["0%", "-200%"],
            x: ["0%", `${p.drift * 50}%`],
          }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}
