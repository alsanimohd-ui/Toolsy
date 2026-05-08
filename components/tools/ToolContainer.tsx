import { CSSProperties, ReactNode } from "react";
import { CategoryId, getCategory } from "@/lib/tools";

interface ToolContainerProps {
  children: ReactNode;
  /** Additional classes for the outer wrapper */
  className?: string;
  /** Canonical category identity for page-level accenting */
  categoryId?: CategoryId;
}

/**
 * ToolContainer
 * Top-level page wrapper for every tool page.
 * Provides consistent max-width, padding, and vertical rhythm.
 */
export default function ToolContainer({
  children,
  className = "",
  categoryId,
}: ToolContainerProps) {
  const category = categoryId ? getCategory(categoryId) : null;

  return (
    <div
      className={`toolsy-page-shell ${className}`}
      style={category ? ({
        "--category-accent": category.color,
        "--category-glow": category.glow,
      } as CSSProperties) : undefined}
    >
      <div className="toolsy-content">
        {children}
      </div>
    </div>
  );
}
