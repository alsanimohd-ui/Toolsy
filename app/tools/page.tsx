"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { categoryList, tools, type Tool } from "@/lib/tools";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import ToolIcon from "@/components/ui/ToolIcon";
import SiteFooter from "@/components/layout/SiteFooter";

function ToolCard({ tool }: { tool: Tool }) {
  const { openTool } = useWorkspace();
  const category = categoryList.find((c) => c.id === tool.categoryId);

  const className =
    "group flex h-full flex-col gap-3 rounded-xl border border-border bg-card-bg p-5 text-left shadow-[var(--card-shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[var(--card-hover-shadow)]";

  const body = (
    <>
      <div className="flex items-start justify-between">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <ToolIcon slug={tool.slug} className="size-5" />
        </span>
        <span className="flex items-center gap-1 text-xs text-muted">
          {category?.shortLabel}
          {tool.isExternal && <ArrowUpRight className="size-3.5" aria-label="Opens external site" />}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-foreground transition-colors group-hover:text-accent">{tool.name}</h2>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">{tool.description}</p>
      </div>
    </>
  );

  if (tool.isExternal) {
    return (
      <a href={tool.route} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openTool({ slug: tool.slug, categoryId: tool.categoryId, route: tool.route })}
      className={className}
    >
      {body}
    </button>
  );
}

export default function ToolsIndexPage() {
  const [search, setSearch] = useState("");
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

  const q = search.toLowerCase().trim();
  const filteredTools = tools.filter(
    (t) =>
      q === "" ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.categoryId.toLowerCase().includes(q)
  );

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 pl-14 sm:px-8 md:pl-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">All tools</h1>
            <p className="mt-1 text-muted">{tools.length} free tools for everyday IT work.</p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search tools</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools…  Ctrl+K"
              className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus:bg-surface-raised"
            />
          </label>
        </header>

        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        ) : (
          <p className="py-16 text-center text-muted">No tools match “{search}”.</p>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
