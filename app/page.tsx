"use client";

import { tools } from "@/lib/tools";
import Centerpiece from "@/components/home/Centerpiece";
import RadialMenu from "@/components/home/RadialMenu";
import ThemeToggle from "@/components/home/ThemeToggle";
import { SectionBlock } from "@/components/home/SectionBlock";
import { motion } from "framer-motion";
import { useState } from "react";

export default function HomePage() {
  const [activeSegment] = useState<string | null>(null);
  const dataTools = tools.filter((t) => t.category === "Data");
  const securityTools = tools.filter((t) => t.category === "Security");
  const logsTools = tools.filter((t) => t.category === "Logs");

  return (
    <main className="min-h-screen bg-background transition-colors duration-500 overflow-x-hidden flex flex-col items-center">
      <ThemeToggle />

      {/* 1. Hero Section - Dynamically Adaptive Hub */}
      <section className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden mesh-gradient px-4 md:px-8">
        {/* Background Atmosphere - Scales with viewport */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[100vh] bg-blue-500/[0.05] dark:bg-blue-500/[0.02] rounded-full blur-[min(20vw,160px)]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[80vh] bg-purple-500/[0.03] dark:bg-purple-500/[0.01] rounded-full blur-[min(15vw,140px)] animate-pulse" />
        </div>

        {/* The Nucleus - Dynamic Sizing System */}
        <div className="relative z-20 w-full max-w-[min(85vw,85vh,900px)] aspect-square flex items-center justify-center">
          {/* Radial Hub (Background layer) - Scales to fill parent */}
          <RadialMenu activeSegment={activeSegment} />
          
          {/* Centerpiece (Core nucleus) - Proportional to hub */}
          <div className="relative z-30 pointer-events-none w-[28%] aspect-square">
            <Centerpiece />
          </div>
        </div>

        {/* Adaptive Scroll Indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[clamp(2rem,5vh,4rem)] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-20 dark:opacity-[0.05]"
        >
          <span className="text-[clamp(8px,1vw,10px)] font-black tracking-[0.6em] uppercase text-foreground">Explore</span>
          <div className="w-px h-[clamp(1.5rem,4vh,2rem)] bg-gradient-to-b from-foreground to-transparent" />
        </motion.div>
      </section>

      {/* 2. Detailed Tool Sections */}
      <div className="relative z-10 w-full max-w-7xl bg-gradient-to-b from-transparent via-background to-background">
        <SectionBlock
          id="data"
          title="Data Management"
          description="High-speed utilities for formatting, converting, and cleaning structured datasets. Optimized for JSON, CSV, and code generation."
          color="#3b82f6"
          tools={dataTools}
        />
        
        <SectionBlock
          id="security"
          title="Security & Auth"
          description="Enterprise-grade cryptographic tools for SSL management, certificate decoding, and secure PFX generation. Completely offline and secure."
          color="#ef4444"
          tools={securityTools}
        />

        <SectionBlock
          id="logs"
          title="Log Analytics"
          description="Instantly parse, filter, and analyze massive server log streams. Detect errors, group stack traces, and isolate issues in seconds."
          color="#a855f7"
          tools={logsTools}
        />
      </div>

      {/* Footer - Responsive padding */}
      <footer className="w-full border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-6 py-[clamp(3rem,8vw,5rem)] flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <h2 className="text-xl font-black tracking-tighter text-foreground uppercase italic">Toolsy</h2>
            <p className="text-sm text-muted max-w-xs">Premium developer utilities. Speed, privacy, and precision as standard.</p>
          </div>
          
          <div className="flex items-center gap-10 text-xs font-black uppercase tracking-[0.3em] text-muted hover:text-foreground transition-colors">
            <a href="#">Docs</a>
            <a href="https://github.com">GitHub</a>
            <a href="#">Status</a>
          </div>

          <div className="text-[10px] font-black text-muted uppercase tracking-tighter">
            &copy; {new Date().getFullYear()} Toolsy Inc.
          </div>
        </div>
      </footer>
    </main>
  );
}
