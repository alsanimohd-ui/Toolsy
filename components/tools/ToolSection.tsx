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
        rounded-2xl border border-[var(--border)]
        bg-[var(--surface)] p-6
        flex flex-col gap-5
        ${className}
      `}
    >
      {(title || description) && (
        <div className="flex flex-col gap-1">
          {title && (
            <h2 className="text-sm font-semibold text-[var(--foreground)] tracking-wide uppercase">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
