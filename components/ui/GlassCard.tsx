"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className = "", hoverEffect = true }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={hoverEffect ? { y: -3, scale: 1.005 } : undefined}
        className={`toolsy-card ${hoverEffect ? "toolsy-card-hover" : ""} ${className}`}
      >
        {children}
      </motion.div>
    );
  }
);

GlassCard.displayName = "GlassCard";
export default GlassCard;
