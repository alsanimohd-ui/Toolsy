"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

export default function ThemeToggle() {
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
    return (
      <div className="fixed top-6 right-6 md:top-8 md:right-8 z-50 flex items-center gap-3 px-4 py-2 rounded-full border border-border bg-white/70 dark:bg-black/30 backdrop-blur-xl h-[42px] w-[110px] opacity-0" />
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="fixed top-6 right-6 md:top-8 md:right-8 z-50 flex items-center gap-3 px-4 py-2 rounded-full 
        border border-border bg-white/70 dark:bg-black/30 backdrop-blur-xl 
        shadow-[0_14px_40px_var(--card-shadow)] transition-all hover:border-accent/35 hover:bg-white/90 dark:hover:bg-black/45 group"
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
