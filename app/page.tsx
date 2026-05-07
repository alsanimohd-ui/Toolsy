"use client";

import { tools } from "@/lib/tools";
import Centerpiece from "@/components/home/Centerpiece";
import RadialMenu from "@/components/home/RadialMenu";
import { SectionBlock } from "@/components/home/SectionBlock";
import { useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [activeSegment] = useState<string | null>(null);

  const dataTools = tools.filter((t) => t.category === "Data");
  const securityTools = tools.filter((t) => t.category === "Security");
  const logsTools = tools.filter((t) => t.category === "Logs");

  return (
    <main className="min-h-screen bg-background transition-colors duration-500 overflow-x-hidden flex flex-col items-center relative">
      {/* 1. Immersive Hero Landing */}
      <section className="relative w-full min-h-[90vh] flex flex-col items-center justify-center">
        {/* The Nucleus - Perfectly 50/50 centered within the hero area */}
        <div className="relative z-20 w-full max-w-[min(80vw,80vh,850px)] aspect-square flex items-center justify-center">
          <RadialMenu activeSegment={activeSegment} />
          <div className="relative z-30 w-[32%] aspect-square">
            <Centerpiece />
          </div>
        </div>
      </section>

      {/* 2. Platform Content Sections - Restored & Responsive */}
      <div className="relative z-10 w-full max-w-7xl">
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

      {/* 3. Unified Footer - Restored */}
      <footer className="w-full border-t border-border bg-surface mt-24">
        <div className="max-w-7xl mx-auto px-6 py-20 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <h2 className="text-xl font-black tracking-tighter text-foreground uppercase italic">Toolsy</h2>
            <p className="text-sm text-muted max-w-xs font-medium">Premium developer utilities. Speed, privacy, and precision as standard.</p>
          </div>
          
          <div className="flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.4em] text-muted hover:text-foreground transition-colors">
            <Link href="/tools">Platform</Link>
            <a href="https://github.com">GitHub</a>
            <a href="#">Status</a>
          </div>

          <div className="text-[10px] font-black text-muted/40 uppercase tracking-tighter">
            &copy; {new Date().getFullYear()} Toolsy Inc. &bull; Privacy First Developer Tools
          </div>
        </div>
      </footer>
    </main>
  );
}
