"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

interface ThemeToggleProps {
  inline?: boolean;
  collapsed?: boolean;
}

export default function ThemeToggle({ inline = false, collapsed = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    document.documentElement.classList.toggle("light", initialTheme === "light");
  }, []);

  const toggleTheme = (e: React.MouseEvent) => {
    e.preventDefault();
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(newTheme);
  };

  if (!mounted) {
    if (inline) {
      return (
        <div className="h-10 rounded-xl bg-white/5 border border-transparent animate-pulse" />
      );
    }
    return (
      <div className="fixed top-6 right-6 md:top-8 md:right-8 z-50 flex items-center gap-3 px-4 py-2 rounded-full border border-border bg-surface-overlay backdrop-blur-xl h-[42px] w-[110px] opacity-0" />
    );
  }

  if (inline) {
    return (
      <button
        onClick={toggleTheme}
        className={`w-full flex items-center rounded-xl border border-transparent text-muted hover:text-foreground hover:bg-surface transition-all select-none
          ${collapsed ? "justify-center h-10 p-0" : "px-3 py-2.5 gap-2.5"}`}
        title={theme === "dark" ? "Switch to Day Mode" : "Switch to Night Mode"}
      >
        <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
          {theme === "dark" ? (
            <Moon className="w-4 h-4 text-blue-400" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500" />
          )}
        </div>
        {!collapsed && (
          <span className="text-[10px] font-black uppercase tracking-[0.2em] truncate">
            {theme === "dark" ? "Night Mode" : "Light Mode"}
          </span>
        )}
      </button>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="fixed top-6 right-6 md:top-8 md:right-8 z-50 flex items-center gap-3 px-4 py-2 rounded-full 
        border border-border bg-surface-overlay backdrop-blur-xl 
        shadow-[0_14px_40px_var(--card-shadow)] transition-all hover:border-accent/35 hover:bg-surface-raised group"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {theme === "dark" ? (
          <Moon className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
        ) : (
          <Sun className="w-5 h-5 text-amber-500 group-hover:text-amber-400 transition-colors" />
        )}
      </div>
      <span className="toolsy-meta text-foreground/65 group-hover:text-foreground">
        {theme === "dark" ? "Night" : "Day"}
      </span>
    </motion.button>
  );
}
