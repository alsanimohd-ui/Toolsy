"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { categoryList, tools, type CategoryId, type Tool } from "@/lib/tools";
import ToolIcon from "@/components/ui/ToolIcon";

function ToolTile({ tool }: { tool: Tool }) {
  const className =
    "group flex h-full flex-col gap-3 rounded-xl border border-border bg-card-bg p-5 shadow-[var(--card-shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[var(--card-hover-shadow)]";

  const body = (
    <>
      <div className="flex items-start justify-between">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <ToolIcon slug={tool.slug} className="size-5" />
        </span>
        {tool.isExternal && <ArrowUpRight className="size-4 text-muted" aria-label="Opens external site" />}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-foreground transition-colors group-hover:text-accent">{tool.name}</h3>
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
    <Link href={tool.route} className={className}>
      {body}
    </Link>
  );
}

export default function ToolsExplorer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "all">("all");

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return tools.filter((t) => {
      if (category !== "all" && t.categoryId !== category) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    });
  }, [query, category]);

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-accent bg-accent text-[#04181a]"
        : "border-border bg-surface text-muted hover:border-accent/40 hover:text-foreground"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto w-full max-w-xl">
        <label className="relative block">
          <span className="sr-only">Search tools</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus:bg-surface-raised"
          />
        </label>
      </div>

      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Filter by category">
        <button type="button" className={chip(category === "all")} onClick={() => setCategory("all")}>
          All
        </button>
        {categoryList.map((c) => (
          <button key={c.id} type="button" className={chip(category === c.id)} onClick={() => setCategory(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((tool) => (
            <ToolTile key={tool.slug} tool={tool} />
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-muted">No tools match “{query}”.</p>
      )}
    </div>
  );
}
