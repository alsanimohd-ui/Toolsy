"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    document.documentElement.classList.toggle("light", initialTheme === "light");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    document.documentElement.classList.toggle("light", newTheme === "light");
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="fixed top-8 right-8 z-50 flex items-center gap-3 px-4 py-2 rounded-full 
        bg-white/10 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-white/5 
        shadow-2xl transition-all hover:bg-white/20 dark:hover:bg-black/30 group"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {theme === "dark" ? (
          <Moon className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
        ) : (
          <Sun className="w-5 h-5 text-amber-500 group-hover:text-amber-400 transition-colors" />
        )}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-foreground opacity-60 group-hover:opacity-100">
        {theme === "dark" ? "Night" : "Day"}
      </span>
    </motion.button>
  );
}
