"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Terminal, Cpu, ArrowRight } from "lucide-react";
import { tools, getCategory, type Tool } from "@/lib/tools";
import { useWorkspace } from "./WorkspaceContext";

export default function QuickSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const { openTool } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // 1. Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 2. Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // 3. Filtered tools list
  const filtered = tools.filter((t) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (
      t.name.toLowerCase().includes(s) ||
      t.description.toLowerCase().includes(s) ||
      t.categoryId.toLowerCase().includes(s)
    );
  });

  // 4. Handle navigation keys
  useEffect(() => {
    if (!isOpen || filtered.length === 0) return;

    const handleNav = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      }
    };

    window.addEventListener("keydown", handleNav);
    return () => window.removeEventListener("keydown", handleNav);
  }, [isOpen, filtered, selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const activeEl = resultsRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (tool: Tool) => {
    openTool({
      slug: tool.slug,
      categoryId: tool.categoryId,
      route: tool.route,
    });
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          {/* Blur Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Dialog Body */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 350, damping: 26 }}
            className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950/85 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            {/* Ambient Accent Glow */}
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />

            {/* Input Wrapper */}
            <div className="relative border-b border-white/5 p-4 flex items-center gap-3">
              <Search className="size-4 text-muted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Search command center..."
                className="w-full bg-transparent text-sm font-semibold text-white placeholder-muted focus:outline-none"
              />
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-black text-muted tracking-widest uppercase">
                ESC
              </div>
            </div>

            {/* Results Grid */}
            <div
              ref={resultsRef}
              className="max-h-[320px] overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar"
            >
              {filtered.length > 0 ? (
                filtered.map((tool, idx) => {
                  const isActive = idx === selectedIndex;
                  const category = getCategory(tool.categoryId);
                  
                  return (
                    <div
                      key={tool.slug}
                      data-active={isActive}
                      onClick={() => handleSelect(tool)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-accent/10 border border-accent/20 text-white shadow-[0_0_15px_var(--accent-glow)]"
                          : "border border-transparent text-muted hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Tool Icon Badge */}
                        <div
                          className={`size-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                            isActive
                              ? "bg-accent/25 text-white"
                              : "bg-white/5 text-muted"
                          }`}
                        >
                          {tool.icon}
                        </div>

                        {/* Title and details */}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black tracking-wide text-foreground truncate">
                            {tool.name}
                          </span>
                          <span className="text-[10px] text-muted truncate font-medium max-w-[350px]">
                            {tool.description}
                          </span>
                        </div>
                      </div>

                      {/* Category label */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-transparent"
                          style={{
                            color: category?.color,
                            backgroundColor: `${category?.color}15`,
                            borderColor: `${category?.color}25`,
                          }}
                        >
                          {category?.shortLabel}
                        </span>
                        {isActive && (
                          <ArrowRight className="size-3 text-accent animate-pulse" />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center flex flex-col items-center gap-3">
                  <Terminal className="size-6 text-muted/30" />
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase text-muted tracking-widest">
                      Command not found
                    </span>
                    <span className="text-[10px] text-muted/50 font-bold uppercase tracking-tighter">
                      Verify spelling or category
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Switcher Footer */}
            <div className="border-t border-white/5 px-4 py-3 bg-slate-950/95 flex items-center justify-between text-[9px] font-black text-muted tracking-[0.25em] uppercase">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded bg-white/5">↑↓</span> Move
                </span>
                <span className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded bg-white/5">Enter</span> Execute
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-accent/60">
                <Cpu className="size-3" />
                <span>Command Shell v1.2</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
