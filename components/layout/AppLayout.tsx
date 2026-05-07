"use client";

import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "@/components/home/ThemeToggle";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen bg-background transition-colors duration-500 mesh-gradient overflow-x-hidden">
      {/* Persistent Global Theme Toggle */}
      <ThemeToggle />

      {/* Global Cinematic Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[100vw] h-[100vh] bg-accent/[0.03] rounded-full blur-[160px]" />
        <div className="absolute bottom-0 right-1/4 w-[100vw] h-[100vh] bg-purple-500/[0.03] rounded-full blur-[140px]" />
      </div>

      {/* Page Transitions & Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="relative z-10"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
