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

      {/* ── 2. UNIFIED DYNAMIC GRADIENT SYSTEM ── */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.5] dark:opacity-[0.8] transition-opacity duration-700">
        {/* Animated Blob A (Primary Accent) */}
        <motion.div
          animate={{
            x: ["-10%", "20%", "-10%"],
            y: ["-5%", "15%", "-5%"],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[15%] -left-[10%] size-[90%] rounded-full blur-[150px] bg-accent/40 dark:bg-accent/60"
        />

        {/* Animated Blob B (Secondary/Deep Blue) */}
        <motion.div
          animate={{
            x: ["30%", "-5%", "30%"],
            y: ["10%", "-15%", "10%"],
            scale: [1.3, 1, 1.3],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[15%] -right-[15%] size-[80%] rounded-full blur-[150px] bg-blue-500/30 dark:bg-blue-600/40"
        />

        {/* Animated Blob C (Warm/Purple Sub-glow) */}
        <motion.div
          animate={{
            x: ["-5%", "5%", "-5%"],
            y: ["30%", "5%", "30%"],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-10%] left-[10%] size-[70%] rounded-full blur-[150px] bg-rose-500/20 dark:bg-purple-600/30"
        />
      </div>

      {/* ── 3. ATMOSPHERIC TEXTURE ── */}
      <div className="absolute inset-0">
        {/* Global Dot Grid */}
        <div
          className="absolute inset-0 opacity-[0.25] dark:opacity-[0.45] transition-opacity duration-700"
          style={{
            backgroundImage: "radial-gradient(circle at center, var(--atmos-dot) 0.5px, transparent 0.5px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 80%)",
          }}
        />

        {/* Cinematic Vignette (Theme Sensitive) */}
        <div
          className="absolute inset-0 transition-opacity duration-700 bg-[radial-gradient(ellipse_80%_70%_at_center,transparent_0%,transparent_40%,var(--atmos-vignette-edge)_100%)]"
        />
        
        {/* Interior Page Top Fade (Ensures search/nav header remains clean) */}
        {!isHome && (
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[var(--background)] to-transparent z-10 transition-colors duration-700" />
        )}
      </div>

      {/* ── 4. AMBIENT DRIFT PARTICLES ── */}
      <div className="absolute inset-0">
        {PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: p.x, top: p.y, width: "1.2px", height: "1.2px",
              background: "var(--accent)",
              boxShadow: "0 0-8px var(--accent-glow)",
            }}
            initial={{ opacity: 0, y: "0%", x: "0%" }}
            animate={{
              opacity: [0, 0.3, 0],
              y: ["0%", "-250%"],
              x: ["0%", `${p.drift * 60}%`],
            }}
            transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>
      
      {/* ── 5. FILM GRAIN ── */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
