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
    <main className="toolsy-home-shell">
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
