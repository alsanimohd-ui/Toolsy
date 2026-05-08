"use client";

import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "@/components/home/ThemeToggle";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-[100dvh] bg-background transition-colors duration-500 mesh-gradient overflow-x-hidden">
      {/* Persistent Global Theme Toggle */}
      <ThemeToggle />

      {/* Global Cinematic Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 h-[100dvh] w-[100vw] rounded-full bg-accent/[0.03] blur-[clamp(80px,12vw,160px)]" />
        <div className="absolute bottom-0 right-1/4 h-[100dvh] w-[100vw] rounded-full bg-purple-500/[0.03] blur-[clamp(70px,11vw,140px)]" />
      </div>

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
