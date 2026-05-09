"use client";

import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "@/components/home/ThemeToggle";
import Atmosphere from "@/components/layout/Atmosphere";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="relative min-h-[100dvh] bg-background transition-colors duration-500 mesh-gradient overflow-x-hidden">
      {/* Persistent Global Theme Toggle */}
      <ThemeToggle />

      {/* Global Cinematic Background Atmosphere */}
      {!isHome && <Atmosphere />}

      {/* Page Transitions & Content */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="relative z-10"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
