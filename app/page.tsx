"use client";

import Centerpiece from "@/components/home/Centerpiece";
import RadialMenu from "@/components/home/RadialMenu";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import type { CategoryId } from "@/lib/tools";



export default function HomePage() {
  const [activeSegment, setActiveSegment] = useState<CategoryId | null>(null);

  return (
    <main className="toolsy-home-shell relative overflow-hidden bg-[#020205]">
      {/* Premium Sci-Fi Grid Mesh Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 z-0 pointer-events-none" />

      {/* Drifting Soft Ambient Sci-Fi Glowing Bursts */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden animate-ambient-drift">
        {/* Deep Red Glow - Behind Network Security Arc Sector (top right) */}
        <div className="absolute top-[15%] right-[15%] w-[38rem] h-[38rem] rounded-full bg-[#ef4444]/6 blur-[130px]" />
        
        {/* Blue Glow - Behind Data & Analytics Arc Sector (bottom left) */}
        <div className="absolute bottom-[15%] left-[15%] w-[38rem] h-[38rem] rounded-full bg-[#3b82f6]/6 blur-[130px]" />
        
        {/* Purple Glow - Behind Dev & Automation Arc Sector (top left) */}
        <div className="absolute top-[15%] left-[15%] w-[38rem] h-[38rem] rounded-full bg-[#8b5cf6]/6 blur-[130px]" />
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
              Mi <span className="text-white/25">by maker-ai.tech</span>&nbsp;
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
