"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { categoryList, tools, type Tool } from "@/lib/tools";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Sparkles, 
  ArrowRight, 
  Cpu,
  Layers,
  Activity,
  ExternalLink
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

/* ─────────────────────────────────────────────
   Premium Tool Card — workspace-aware
  ───────────────────────────────────────────── */
function ToolCard({ tool, categoryColor }: { tool: Tool; categoryColor: string }) {
  const { openTool, activeTool } = useWorkspace();
  const isActive = activeTool?.slug === tool.slug;
  const isExternal = tool.isExternal;

  const handleClick = (e: React.MouseEvent) => {
    if (isExternal) return; // let link navigate
    e.preventDefault();
    openTool({ slug: tool.slug, categoryId: tool.categoryId, route: tool.route });
  };

  const content = (
    <motion.div
      whileHover={{ y: -5, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`toolsy-card h-full flex flex-col p-8 group relative overflow-hidden transition-all duration-500 ${
        isActive ? "border-accent/60 shadow-[0_0_0_1px_var(--accent)]" : "hover:border-accent/40"
      }`}
    >
      {/* Active indicator glow */}
      {isActive && (
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundColor: categoryColor }}
        />
      )}

      {/* Subtle background glow on hover */}
      <div 
        className="absolute -right-20 -top-20 size-40 blur-[80px] opacity-0 transition-opacity duration-500 group-hover:opacity-20"
        style={{ backgroundColor: categoryColor }}
      />

      <div className="flex items-start justify-between mb-8">
        <div 
          className={`flex size-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-xl font-black shadow-inner transition-all duration-500 ${
            isActive 
              ? "bg-accent/10 text-accent dark:bg-accent/20 scale-110" 
              : "group-hover:scale-110 group-hover:bg-accent/10 group-hover:text-accent dark:group-hover:bg-accent/20"
          }`}
        >
          {tool.icon}
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {isExternal && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Activity className="size-2.5" />
              Remote
            </div>
          )}
          {isActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-accent/10 border border-accent/20 text-accent">
              Active
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        <div className="flex flex-col gap-1">
          <span 
            className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40"
            style={{ color: categoryColor }}
          >
            {categoryList.find(c => c.id === tool.categoryId)?.label}
          </span>
          <h2 className={`text-xl font-black tracking-tight transition-colors duration-300 ${
            isActive ? "text-accent" : "text-foreground group-hover:text-accent"
          }`}>
            {tool.name}
          </h2>
        </div>
        <p className="text-sm text-muted/80 leading-relaxed font-medium line-clamp-3">
          {tool.description}
        </p>
      </div>

      <div className="mt-10 pt-6 border-t border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-muted/60 group-hover:text-accent transition-colors duration-300">
          <span>
            {isExternal ? "Establish Connection" : isActive ? "Currently Active" : "Initialize Module"}
          </span>
        </div>
        {isExternal ? (
          <ExternalLink className="w-4 h-4 text-muted/40" />
        ) : (
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowRight className="w-4 h-4 text-accent opacity-0 -translate-x-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );

  if (isExternal) {
    return (
      <a href={tool.route} target="_blank" rel="noopener noreferrer" className="block h-full">
        {content}
      </a>
    );
  }

  return (
    <div onClick={handleClick} className="block h-full cursor-pointer">
      {content}
    </div>
  );
}


/* ─────────────────────────────────────────────
   Main Page Component
  ───────────────────────────────────────────── */
export default function ToolsIndexPage() {
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Stability: Ensure keyboard shortcuts and search behavior are initialized
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

  // Stability: Global search logic
  const filteredTools = tools.filter((t) => {
    const s = search.toLowerCase().trim();
    
    if (s === "") return true;
    
    return t.name.toLowerCase().includes(s) || 
           t.description.toLowerCase().includes(s) ||
           t.categoryId.toLowerCase().includes(s);
  });

  return (
    <div className="toolsy-content relative z-10 flex flex-col gap-[clamp(1.5rem,5svh,3rem)]">
      
      {/* 1. Futuristic Header */}
      <header className="flex flex-col items-center text-center gap-10">
        <div className="flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-3"
          >
            <Layers className="size-4 text-accent/60" />
            <span className="toolsy-kicker tracking-[0.5em]">Command Center v2.0</span>
            <Layers className="size-4 text-accent/60" />
          </motion.div>
          <h1 className="toolsy-page-title text-[clamp(2.5rem,6vw,5rem)]">
            Platform Modules
          </h1>
          <p className="toolsy-description mx-auto opacity-70">
            A high-fidelity categorized ecosystem for advanced development workflows.
          </p>
        </div>
        
        {/* Integrated Search & Navigation Container */}
          <div className="w-full flex flex-col md:flex-row gap-4 items-center justify-center">
            <Link 
              href="/"
              className="flex items-center gap-2 px-4 h-14 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group shrink-0"
            >
              <motion.div
                whileHover={{ x: -2 }}
                className="text-muted group-hover:text-white"
              >
                <ArrowRight className="size-4 rotate-180" />
              </motion.div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted group-hover:text-white">Portal</span>
            </Link>

            <div className="w-full max-w-lg relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search across all modules... (Ctrl+K)"
                className="toolsy-input h-14 pl-14 pr-6 rounded-2xl border-white/5 bg-white/[0.02] backdrop-blur-md font-semibold text-sm tracking-wide shadow-2xl focus:bg-white/[0.04]"
              />
            </div>
          </div>
      </header>


      {/* 3. Dynamic Tools Grid */}
      <main className="relative">
        {/* Background Mood Glow */}
        <AnimatePresence mode="wait">
          <motion.div
            key="global-glow"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.8 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[80%] rounded-full blur-[120px] pointer-events-none z-0 bg-accent"
          />
        </AnimatePresence>

        <div className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={search}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredTools.length > 0 ? (
                filteredTools.map((tool) => (
                  <ToolCard key={tool.slug} tool={tool} categoryColor="var(--accent)" />
                ))
              ) : (
                <div className="col-span-full py-20 flex flex-col items-center gap-4 text-center">
                  <div className="size-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                    <Search className="size-6 text-muted/30" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-black uppercase tracking-widest text-muted">No modules found</h3>
                    <p className="text-xs text-muted/50 font-bold uppercase tracking-tighter">Try a different query</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* 4. OS-Style System Status Footer */}
      <footer className="mt-12 pt-10 border-t border-white/5 flex flex-col items-center gap-8">
        <div className="flex items-center gap-8 text-[9px] font-black uppercase tracking-[0.4em] text-muted/40">
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Systems Nominal</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-2">
            <Cpu className="size-3" />
            <span>Local Compute Only</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-2 text-accent/60">
            <Sparkles className="size-3" />
            <span>Mi OS v2.0.5 <span className="text-white/20">by maker-ai.tech</span></span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[10px] font-black uppercase tracking-[0.3em] text-muted/60">
          <Link href="/" className="hover:text-accent transition-colors">Home</Link>
          <a href="https://github.com" className="hover:text-accent transition-colors">Repository</a>
          <a href="#" className="hover:text-accent transition-colors">System Status</a>
        </div>
      </footer>
    </div>
  );
}
