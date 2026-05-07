"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { tools, type Tool } from "@/lib/tools";
import GlassCard from "@/components/ui/GlassCard";
import { motion } from "framer-motion";
import { Search, Sparkles, ArrowRight, Clock, Box } from "lucide-react";

/* ─────────────────────────────────────────────
   Premium Tool Card
 ───────────────────────────────────────────── */
function ToolCard({ tool }: { tool: Tool }) {
  const trackRecent = () => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("toolsy_recent_tools");
        const existing: string[] = stored ? JSON.parse(stored) : [];
        const updated = [tool.slug, ...existing.filter((s) => s !== tool.slug)].slice(0, 3);
        localStorage.setItem("toolsy_recent_tools", JSON.stringify(updated));
      } catch {}
    }
  };

  const isExternal = tool.isExternal;

  return (
    <Link href={tool.route} onClick={trackRecent} target={isExternal ? "_blank" : undefined}>
      <GlassCard className="h-full flex flex-col gap-6 group hover:border-accent transition-all duration-500">
        <div className="flex items-start justify-between">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
            {tool.icon}
          </div>
          <div className="flex flex-col items-end gap-2">
            {isExternal && (
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                External
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-border-subtle text-muted group-hover:border-accent/40 group-hover:text-accent transition-colors duration-500">
              {tool.category}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-black text-foreground group-hover:text-accent transition-colors duration-300">
            {tool.name}
          </h2>
          <p className="text-sm text-muted leading-relaxed line-clamp-2 font-medium">
            {tool.description}
          </p>
        </div>

        <div className="mt-auto pt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted group-hover:text-accent transition-colors duration-300">
          <span>{isExternal ? "Open" : "Launch"}</span>
          <ArrowRight className="w-3 h-3 transition-transform duration-500 group-hover:translate-x-2" />
        </div>
      </GlassCard>
    </Link>
  );
}

/* ─────────────────────────────────────────────
   Page
 ───────────────────────────────────────────── */
export default function ToolsIndexPage() {
  const [search, setSearch] = useState("");
  const [routerInput, setRouterInput] = useState("");
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("toolsy_recent_tools");
      if (stored) setRecentSlugs(JSON.parse(stored));
    } catch {}
  }, []);

  const coreSlugs = ["paste-to-code", "ssl-toolkit", "json-lego"];
  const coreTools = coreSlugs.map(slug => tools.find(t => t.slug === slug)).filter(Boolean) as Tool[];
  const recentTools = recentSlugs
    .filter(slug => !coreSlugs.includes(slug))
    .map((slug) => tools.find((t) => t.slug === slug))
    .filter(Boolean) as Tool[];

  const filteredTools = tools.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) &&
    !coreSlugs.includes(t.slug) &&
    !recentSlugs.includes(t.slug)
  );

  const groupedTools: Record<string, Tool[]> = {};
  filteredTools.forEach((tool) => {
    if (!groupedTools[tool.category]) groupedTools[tool.category] = [];
    groupedTools[tool.category].push(tool);
  });

  const categories = Object.keys(groupedTools);

  return (
    <div className="max-w-7xl mx-auto px-6 py-24 flex flex-col gap-24 relative z-10">
      
      {/* 1. High-Impact Header */}
      <header className="flex flex-col items-center text-center gap-10">
        <div className="flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-2 mb-2"
          >
            <div className="w-10 h-[2px] bg-accent" />
            <span className="text-[10px] font-black uppercase tracking-[0.6em] text-accent">Developer OS</span>
            <div className="w-10 h-[2px] bg-accent" />
          </motion.div>
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-foreground drop-shadow-sm">
            Control Center
          </h1>
          <p className="text-muted text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
            A unified ecosystem of high-fidelity utilities designed for performance. 
            All tools are processed locally for maximum privacy.
          </p>
        </div>
        
        {/* Premium Search Bar */}
        <div className="w-full max-w-md relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted group-focus-within:text-accent transition-colors" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search platform... (Ctrl+K)"
            className="w-full h-16 pl-14 pr-6 rounded-3xl bg-white/50 dark:bg-black/40 backdrop-blur-3xl border border-border group-focus-within:border-accent/40 outline-none transition-all text-foreground font-semibold placeholder:text-muted/60 shadow-xl"
          />
        </div>
      </header>

      {/* 2. Smart Router - Refactored as a Glass Interface */}
      <section className="relative">
        <GlassCard className="p-10 border-2 border-accent/20 dark:border-accent/10 shadow-[0_30px_100px_rgba(37,99,235,0.1)]">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-accent animate-pulse" />
                <h2 className="text-sm font-black text-foreground uppercase tracking-[0.4em]">
                  Intelligent Router
                </h2>
              </div>
              <p className="text-sm text-muted font-medium">
                Paste raw logs, JSON, or certificates—we&apos;ll identify the right tool instantly.
              </p>
            </div>

            <textarea
              value={routerInput}
              onChange={(e) => setRouterInput(e.target.value)}
              placeholder="Paste raw input here..."
              className="w-full min-h-[160px] px-8 py-6 rounded-3xl border border-border bg-white/20 dark:bg-black/20 text-foreground font-mono text-base focus:border-accent/40 focus:ring-4 focus:ring-accent/5 outline-none transition-all placeholder:text-muted/30"
            />
          </div>
        </GlassCard>
      </section>

      {/* 3. Grid Sections */}
      <div className="flex flex-col gap-24">
        {/* Core Essentials */}
        <section className="flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <Box className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-black tracking-tight text-foreground uppercase">Core Platform</h2>
            <div className="h-[2px] bg-gradient-to-r from-accent/40 to-transparent flex-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {coreTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>

        {/* Recently Visited */}
        {recentTools.length > 0 && (
          <section className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-muted" />
              <h2 className="text-xl font-black tracking-tight text-muted uppercase">Recent Sessions</h2>
              <div className="h-[2px] bg-gradient-to-r from-border to-transparent flex-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {recentTools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        )}

        {/* Categorized Tools */}
        {categories.map((category) => (
          <section key={category} className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-black tracking-[0.4em] uppercase text-muted">
                {category} Ecosystem
              </h2>
              <div className="h-[2px] bg-gradient-to-r from-border to-transparent flex-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {groupedTools[category].map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* 4. Unified Footer */}
      <footer className="pt-20 border-t border-border flex flex-col items-center gap-8">
        <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.4em] text-muted">
          <Link href="/" className="hover:text-accent transition-colors">Home</Link>
          <div className="w-1 h-1 rounded-full bg-border" />
          <a href="https://github.com" className="hover:text-accent transition-colors">Source</a>
          <div className="w-1 h-1 rounded-full bg-border" />
          <a href="#" className="hover:text-accent transition-colors">Status</a>
        </div>
        <p className="text-[10px] font-black text-muted/40 uppercase tracking-tighter">
          &copy; {new Date().getFullYear()} Toolsy Inc. &bull; Privacy First Developer Tools
        </p>
      </footer>
    </div>
  );
}
