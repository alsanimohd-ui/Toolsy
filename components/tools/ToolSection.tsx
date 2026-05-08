import { ReactNode } from "react";

interface ToolSectionProps {
  /** Optional section heading */
  title?: string;
  /** Optional helper text below the title */
  description?: string;
  children: ReactNode;
  /** Additional classes */
  className?: string;
}

/**
 * ToolSection
 * A card-style container for grouping related content within a tool page.
 * Handles optional section title and description.
 */
export default function ToolSection({
  title,
  description,
  children,
  className = "",
}: ToolSectionProps) {
  return (
    <section
      className={`
        toolsy-card flex flex-col gap-[clamp(1rem,2svh,1.5rem)] p-[var(--space-card)]
        ${className}
      `}
    >
      {(title || description) && (
        <div className="flex flex-col gap-2">
          {title && (
            <h2 className="toolsy-section-title">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm text-muted leading-relaxed font-medium">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
