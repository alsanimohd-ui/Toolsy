"use client";

import { motion } from "framer-motion";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export default function GlassCard({ children, className = "", hoverEffect = true }: GlassCardProps) {
  return (
    <motion.div
      whileHover={hoverEffect ? { y: -3, scale: 1.005 } : undefined}
      className={`toolsy-card ${hoverEffect ? "toolsy-card-hover" : ""} p-[var(--space-card)] ${className}`}
    >
      {children}
    </motion.div>
  );
}
