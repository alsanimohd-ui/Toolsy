"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  CornerDownLeft,
  Pin,
  PinOff,
} from "lucide-react";
import { tools, categoryList, type Tool } from "@/lib/tools";
import { useWorkspace } from "./WorkspaceContext";

interface CommandItem {
  type: "tool" | "category" | "action";
  label: string;
  description: string;
  icon?: string;
  categoryColor?: string;
  tool?: Tool;
  action?: () => void;
  keywords: string;
}

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, openTool, closeActiveTool, togglePin, isPinned, pinnedTools } = useWorkspace();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Build command items
  const allItems = useMemo<CommandItem[]>(() => {
    const toolItems: CommandItem[] = tools.map((tool) => ({
      type: "tool" as const,
      label: tool.name,
      description: tool.description,
      icon: tool.icon,
      categoryColor: categoryList.find((c) => c.id === tool.categoryId)?.color,
      tool,
      keywords: `${tool.name} ${tool.description} ${tool.category} ${tool.slug}`.toLowerCase(),
    }));

    const categoryItems: CommandItem[] = categoryList.map((cat) => ({
      type: "category" as const,
      label: cat.label,
      description: cat.description,
      categoryColor: cat.color,
      keywords: `${cat.label} ${cat.shortLabel} ${cat.description}`.toLowerCase(),
      action: () => {
        const firstTool = tools.find((t) => t.categoryId === cat.id);
        if (firstTool && !firstTool.isExternal) {
          openTool({ slug: firstTool.slug, categoryId: cat.id, route: firstTool.route });
        }
      },
    }));

    const actionItems: CommandItem[] = [
      {
        type: "action" as const,
        label: "Go to All Tools",
        description: "View the tools grid",
        keywords: "all tools grid home",
        action: () => closeActiveTool(),
      },
    ];

    return [...toolItems, ...categoryItems, ...actionItems];
  }, [openTool, closeActiveTool]);

  // Filter
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter((item) => item.keywords.includes(q));
  }, [query, allItems]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (item) executeItem(item);
    }
  };

  const executeItem = (item: CommandItem) => {
    if (item.type === "tool" && item.tool && !item.tool.isExternal) {
      openTool({ slug: item.tool.slug, categoryId: item.tool.categoryId, route: item.tool.route });
    } else if (item.tool?.isExternal) {
      window.open(item.tool.route, "_blank", "noopener");
    } else if (item.action) {
      item.action();
    }
    setCommandPaletteOpen(false);
  };

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
          onClick={() => setCommandPaletteOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-surface-overlay backdrop-blur-md" />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl toolsy-card !p-0 overflow-hidden"
            style={{ boxShadow: "var(--card-hover-shadow)" }}
            role="dialog"
            aria-label="Command palette"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3.5">
              <Search className="size-4 shrink-0 text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search tools, categories, actions..."
                className="flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted"
                aria-label="Search"
              />
              <kbd className="hidden sm:flex items-center gap-1 rounded-md border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Search className="size-6 text-muted opacity-40" />
                  <p className="text-sm font-medium text-muted">No results found</p>
                </div>
              ) : (
                filtered.map((item, i) => (
                  <button
                    key={`${item.type}-${item.label}`}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                      i === selectedIndex ? "bg-surface-overlay" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-black"
                      style={{
                        borderColor: item.categoryColor
                          ? `color-mix(in srgb, ${item.categoryColor} 25%, transparent)`
                          : "var(--border-subtle)",
                        backgroundColor: item.categoryColor
                          ? `color-mix(in srgb, ${item.categoryColor} 8%, transparent)`
                          : "var(--surface)",
                        color: item.categoryColor ?? "var(--muted)",
                      }}
                    >
                      {item.icon ?? "→"}
                    </div>

                    {/* Label + description */}
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-black text-foreground truncate">
                        {item.label}
                      </span>
                      <span className="text-[11px] font-medium text-muted truncate">
                        {item.description}
                      </span>
                    </div>

                    {/* Type badge */}
                    <span className="toolsy-badge bg-surface text-muted border-border-subtle shrink-0">
                      {item.type}
                    </span>

                    {/* Pin toggle for tools */}
                    {item.type === "tool" && item.tool && !item.tool.isExternal && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(item.tool!.slug);
                        }}
                        className="shrink-0 rounded-md p-1 text-muted transition-colors hover:text-foreground"
                        aria-label={isPinned(item.tool.slug) ? "Unpin" : "Pin"}
                      >
                        {isPinned(item.tool.slug) ? (
                          <PinOff className="size-3.5" />
                        ) : (
                          <Pin className="size-3.5" />
                        )}
                      </button>
                    )}

                    {/* Enter hint on selected */}
                    {i === selectedIndex && (
                      <CornerDownLeft className="size-3.5 shrink-0 text-muted" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                  {filtered.length} results
                </span>
                {pinnedTools.length > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-accent">
                    {pinnedTools.length} pinned
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <kbd className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted">
                  ↑↓ navigate
                </kbd>
                <kbd className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted">
                  ↵ select
                </kbd>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}