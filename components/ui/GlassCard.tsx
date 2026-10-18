"use client";

import { forwardRef } from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className = "", hoverEffect = true }, ref) => {
    return (
      <div
        ref={ref}
        className={`toolsy-card ${hoverEffect ? "toolsy-card-hover" : ""} ${className}`}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";
export default GlassCard;
