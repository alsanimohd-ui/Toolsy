import { ReactNode } from "react";

interface ToolContainerProps {
  children: ReactNode;
  /** Additional classes for the outer wrapper */
  className?: string;
}

/**
 * ToolContainer
 * Top-level page wrapper for every tool page.
 * Provides consistent max-width, padding, and vertical rhythm.
 */
export default function ToolContainer({
  children,
  className = "",
}: ToolContainerProps) {
  return (
    <div className={`min-h-screen bg-[var(--background)] ${className}`}>
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-12 flex flex-col gap-10">
        {children}
      </div>
    </div>
  );
}
