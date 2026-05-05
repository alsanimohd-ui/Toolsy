"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { tools, type Tool } from "@/lib/tools";

/* ─────────────────────────────────────────────
   Tool Card
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
    <Link
      href={tool.route}
      onClick={trackRecent}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="group relative flex flex-col gap-5 p-7 rounded-3xl
        border border-[var(--border)] bg-[var(--surface)]
        hover:border-[var(--accent)] hover:bg-[var(--surface-raised)]
        transition-all duration-300 hover:-translate-y-1
        hover:shadow-2xl hover:shadow-[var(--accent-glow)]/10 select-none cursor-pointer"
    >
      {/* Icon + Category row */}
      <div className="flex items-start justify-between">
        <span
          className="flex items-center justify-center w-12 h-12 rounded-2xl text-2xl
            bg-[var(--surface-raised)] border border-[var(--border-subtle)]
            group-hover:border-[var(--accent)] group-hover:bg-[var(--surface)] 
            transition-all duration-300 shadow-inner"
          aria-hidden="true"
        >
          {tool.icon}
        </span>

        <div className="flex flex-col items-end gap-2">
          {isExternal && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
              bg-amber-500/10 border border-amber-500/20 text-amber-500">
              External
            </span>
          )}
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide
              border border-[var(--border-subtle)] text-[var(--muted)]
              group-hover:border-[var(--accent-glow)] group-hover:text-[var(--accent-hover)]
              transition-colors duration-300"
          >
            {tool.category}
          </span>
        </div>
      </div>

      {/* Name + description */}
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-[var(--foreground)] group-hover:text-white transition-colors duration-200">
          {tool.name}
        </h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed line-clamp-2">
          {tool.description}
        </p>
      </div>

      {/* Action CTA */}
      <div className="mt-auto flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[var(--muted)] group-hover:text-[var(--accent-hover)] transition-colors duration-200">
        <span>{isExternal ? "Open" : "Launch"}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>

      {/* Decorative Glow */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none
        bg-gradient-to-br from-[var(--accent-glow)]/5 to-transparent" />
    </Link>
  );
}

/* ─────────────────────────────────────────────
   Input Router Algorithm
───────────────────────────────────────────── */
interface Suggestion {
  slug: string;
  name: string;
  icon: string;
  reason: string;
  route: string;
  isExternal?: boolean;
}

function detectToolSuggestions(value: string): Suggestion[] {
  if (!value || !value.trim()) return [];
  const trimmed = value.trim();
  const suggestions: Suggestion[] = [];

  // 1. Detect JSON
  let isJson = false;
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      JSON.parse(trimmed);
      isJson = true;
    } catch {
      // Could be partial JSON
      if (trimmed.length > 10) isJson = true;
    }
  }
  if (isJson) {
    suggestions.push({
      slug: "json-lego",
      name: "JSON Lego",
      icon: "📦",
      reason: "Structured object notation detected.",
      route: "https://jsonlego.app",
      isExternal: true
    });
  }

  // 2. Detect SSL/PEM Certificates
  let isPem = false;
  if (trimmed.includes("-----BEGIN CERTIFICATE-----") || trimmed.includes("-----BEGIN PRIVATE KEY-----") || trimmed.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    isPem = true;
  }
  if (isPem) {
    suggestions.push({
      slug: "ssl-toolkit",
      name: "SSL Toolkit",
      icon: "🔐",
      reason: "PEM or Certificate format detected.",
      route: "/tools/ssl-toolkit",
    });
  }

  // 3. Detect Logs
  const logRegex = /(info|warn|error|debug|fatal|trace|stdout|stderr|\[\d{4}-\d{2}-\d{2})/i;
  if (logRegex.test(trimmed) || trimmed.includes("\n")) {
    // If it's logs but also has delimiters like commas or tabs, suggest Paste to Code too
    const looksLikeData = trimmed.includes(",") || trimmed.includes("\t") || trimmed.includes(";");
    
    suggestions.push({
      slug: "log-analyzer",
      name: "Log Analyzer",
      icon: "📋",
      reason: "Log sequences or multi-line text detected.",
      route: "/tools/log-analyzer",
    });

    if (looksLikeData) {
      suggestions.push({
        slug: "paste-to-code",
        name: "Paste to Code",
        icon: "📋",
        reason: "Delimited data detected.",
        route: "/tools/paste-to-code",
      });
    }
  }

  return suggestions;
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function ToolsIndexPage() {
  const [search, setSearch] = useState("");
  const [routerInput, setRouterInput] = useState("");
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus Search input on Ctrl+K
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

  // Track recent tools on load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("toolsy_recent_tools");
      if (stored) {
        setRecentSlugs(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const coreSlugs = ["paste-to-code", "ssl-toolkit", "json-lego"];
  const coreTools = coreSlugs
    .map(slug => tools.find(t => t.slug === slug))
    .filter(Boolean) as Tool[];

  const recentTools = recentSlugs
    .filter(slug => !coreSlugs.includes(slug)) // Don't duplicate Core tools in Recent
    .map((slug) => tools.find((t) => t.slug === slug))
    .filter(Boolean) as Tool[];

  const filteredTools = tools.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) &&
    !coreSlugs.includes(t.slug) && // Exclude Core from Main list
    !recentSlugs.includes(t.slug) // Exclude Recent from Main list
  );

  // Group filtered tools by category
  const groupedTools: Record<string, Tool[]> = {};
  filteredTools.forEach((tool) => {
    if (!groupedTools[tool.category]) {
      groupedTools[tool.category] = [];
    }
    groupedTools[tool.category].push(tool);
  });

  const categories = Object.keys(groupedTools);
  const detectedSuggestions = detectToolSuggestions(routerInput);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col gap-16">

        {/* 1. Page Title & Tagline */}
        <header className="flex flex-col items-center text-center gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--foreground)]">
              Developer Toolbox
            </h1>
            <p className="text-[var(--muted)] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Premium, high-utility tools designed for performance. 
              Instantly analyze, convert, and organize your data.
            </p>
          </div>
          
          {/* Search Hint */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
            <span className="text-[var(--muted)]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools... (Ctrl+K)"
              className="bg-transparent text-[var(--foreground)] text-sm font-medium focus:outline-none w-48"
            />
          </div>
        </header>

        {/* 2. Smart Input Router (Large, centered) */}
        <section className="flex flex-col gap-6 p-8 rounded-3xl border-2 border-[var(--accent-glow)] bg-[var(--surface)] shadow-2xl shadow-[var(--accent-glow)]/10 animate-fadeIn">
          <div className="flex flex-col gap-1.5 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <h2 className="text-base font-bold text-white tracking-widest uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                Smart Input Router
              </h2>
              {routerInput && (
                <button
                  onClick={() => setRouterInput("")}
                  className="text-xs font-bold text-[var(--muted)] hover:text-[var(--accent-hover)] uppercase tracking-widest transition-colors"
                >
                  Clear Input
                </button>
              )}
            </div>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              Paste anything... JSON, logs, CSV, SSL files — we&apos;ll route you instantly.
            </p>
          </div>

          <textarea
            value={routerInput}
            onChange={(e) => setRouterInput(e.target.value)}
            placeholder="e.g. paste raw JSON, logs, or a URL..."
            className="w-full min-h-[140px] px-6 py-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--foreground)] text-base font-mono focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)]/20 outline-none transition-all duration-300 placeholder:opacity-30"
          />

          {detectedSuggestions.length > 0 && (
            <div className="flex flex-col gap-4 mt-2 border-t border-[var(--border-subtle)] pt-6 animate-fadeIn">
              <span className="text-xs font-bold text-[var(--muted)] tracking-widest uppercase text-center sm:text-left">
                Direct Routing Available:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {detectedSuggestions.map((suggestion) => (
                  <Link
                    key={suggestion.slug}
                    href={suggestion.route}
                    target={suggestion.isExternal ? "_blank" : undefined}
                    className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] hover:border-[var(--accent)] hover:bg-[var(--surface)] transition-all duration-300 group animate-slideUp shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl filter grayscale group-hover:grayscale-0 transition-all">{suggestion.icon}</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-[var(--foreground)] group-hover:text-white transition-colors">
                          {suggestion.name}
                        </span>
                        <span className="text-[10px] font-medium text-[var(--muted)] leading-tight uppercase tracking-wider">
                          {suggestion.reason}
                        </span>
                      </div>
                    </div>

                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--accent-hover)] transition-transform duration-200 group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 3. Core Tools Section */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-extrabold tracking-tight text-[var(--foreground)]">
              Core Essentials
            </h2>
            <div className="h-px bg-gradient-to-r from-[var(--border)] to-transparent flex-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>

        {/* 4. Recently Visited (excluding Core) */}
        {recentTools.length > 0 && (
          <section className="flex flex-col gap-6 animate-fadeIn">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold tracking-tight text-[var(--muted)]">
                Recently Visited
              </h2>
              <div className="h-px bg-gradient-to-r from-[var(--border-subtle)] to-transparent flex-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentTools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        )}

        {/* 5. Other Tools Section (Categorized) */}
        {categories.length > 0 && (
          <div className="flex flex-col gap-12 animate-fadeIn">
            {categories.map((category) => (
              <section key={category} className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-sm font-bold tracking-widest uppercase text-[var(--muted)]">
                    {category} Tools
                  </h2>
                  <div className="h-px bg-gradient-to-r from-[var(--border-subtle)] to-transparent flex-1" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedTools[category].map((tool) => (
                    <ToolCard key={tool.slug} tool={tool} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 pt-8 border-t border-[var(--border-subtle)] flex flex-col items-center gap-4">
          <p className="text-xs font-medium text-[var(--muted)] tracking-widest uppercase">
            More tools are on the way — suggestions welcome.
          </p>
          <div className="flex gap-6 text-[var(--muted)] text-xs font-bold uppercase tracking-wider">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span className="opacity-20">|</span>
            <a href="https://github.com" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
