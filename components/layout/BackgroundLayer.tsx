"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function BackgroundLayer() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {/* ── 1. BASE CANVAS ── */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{ background: "var(--background)" }}
      />

      {/* ── 2. AMBIENT GRADIENT — static color pool ── */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 72% 60% at 50% 46%, var(--atmos-core-glow) 0%, transparent 62%),
            radial-gradient(ellipse 45% 38% at 18% 22%, rgba(59,130,246,0.06) 0%, transparent 58%),
            radial-gradient(ellipse 42% 36% at 82% 26%, rgba(239,68,68,0.04) 0%, transparent 55%)
          `,
        }}
      />

      {/* ── 3. SINGLE DYNAMIC GRADIENT ── */}
      <motion.div
        className="absolute -top-[15%] -left-[10%] size-[90%] rounded-full blur-[150px]"
        style={{ background: "var(--atmos-core-glow)" }}
        animate={{
          x: ["-10%", "20%", "-10%"],
          y: ["-5%", "15%", "-5%"],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── 4. STRUCTURE RING ── */}
      <motion.div
        className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ width: "62vmin", height: "62vmin", borderColor: "var(--atmos-ring)" }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── 5. ATMOSPHERIC TEXTURE ── */}
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

      {/* ── 6. FILM GRAIN ── */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
