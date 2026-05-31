"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

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

export default function BackgroundLayer() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {/* ── 1. BASE CANVAS (Theme Aware) ── */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{ background: "var(--background)" }}
      />

      {/* ── 2. AMBIENT COLOR GRADIENT — central glow pool ── */}
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

      {/* ── 3. UNIFIED DYNAMIC GRADIENT SYSTEM ── */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.5] dark:opacity-[0.8] transition-opacity duration-700">
        <motion.div
          animate={{
            x: ["-10%", "20%", "-10%"],
            y: ["-5%", "15%", "-5%"],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[15%] -left-[10%] size-[90%] rounded-full blur-[150px] bg-accent/40 dark:bg-accent/60"
        />
        <motion.div
          animate={{
            x: ["30%", "-5%", "30%"],
            y: ["10%", "-15%", "10%"],
            scale: [1.3, 1, 1.3],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[15%] -right-[15%] size-[80%] rounded-full blur-[150px] bg-blue-500/30 dark:bg-blue-600/40"
        />
        <motion.div
          animate={{
            x: ["-5%", "5%", "-5%"],
            y: ["30%", "5%", "30%"],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-10%] left-[10%] size-[70%] rounded-full blur-[150px] bg-rose-500/20 dark:bg-purple-600/30"
        />
      </div>

      {/* ── 4. BREATHING CORE LIGHT ── */}
      <motion.div
        className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: "48vmin", height: "48vmin" }}
        animate={{
          opacity: [0.2, 0.35, 0.2],
          scale: [0.97, 1.03, 0.97],
        }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle at center, var(--atmos-core-glow) 0%, var(--atmos-core-fade) 45%, transparent 70%)",
            filter: "blur(32px)",
          }}
        />
      </motion.div>

      {/* ── 5. STRUCTURE RINGS ── */}
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

      {/* ── 6. ATMOSPHERIC TEXTURE ── */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.25] dark:opacity-[0.45] transition-opacity duration-700"
          style={{
            backgroundImage: "radial-gradient(circle at center, var(--atmos-dot) 0.5px, transparent 0.5px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 80%)",
          }}
        />

        <div
          className="absolute inset-0 transition-opacity duration-700 bg-[radial-gradient(ellipse_80%_70%_at_center,transparent_0%,transparent_40%,var(--atmos-vignette-edge)_100%)]"
        />

        {!isHome && (
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[var(--background)] to-transparent z-10 transition-colors duration-700" />
        )}
      </div>

      {/* ── 7. LIGHT BEAM ── */}
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

      {/* ── 8. AMBIENT DRIFT PARTICLES ── */}
      <div className="absolute inset-0">
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

      {/* ── 9. FILM GRAIN ── */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
