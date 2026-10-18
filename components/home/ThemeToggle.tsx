"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  /** Full-width row with a label (used in the workspace sidebar) */
  inline?: boolean;
  collapsed?: boolean;
  className?: string;
}

export default function ThemeToggle({ inline = false, collapsed = false, className = "" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("theme");
    } catch {}
    const initial = saved === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    document.documentElement.classList.toggle("light", initial === "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
  };

  const isLight = mounted && theme === "light";
  const Icon = isLight ? Sun : Moon;
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  if (inline) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        title={label}
        className={`flex w-full select-none items-center rounded-xl border border-transparent text-muted transition-all hover:bg-surface hover:text-foreground ${
          collapsed ? "h-10 justify-center p-0" : "gap-2.5 px-3 py-2.5"
        } ${className}`}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed && <span className="truncate text-xs">{isLight ? "Light theme" : "Dark theme"}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:border-accent/40 hover:text-accent ${className}`}
    >
      <Icon className="size-4" />
    </button>
  );
}
