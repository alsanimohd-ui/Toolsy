import Link from "next/link";

interface ToolHeaderProps {
  /** Tool name — rendered as the page <h1> */
  title: string;
  /** Short description of what the tool does */
  description: string;
  /** Optional category badge label (e.g. "Text", "JSON", "Crypto") */
  badge?: string;
}

/**
 * ToolHeader
 * Displays the tool name, optional category badge, description,
 * and a back-navigation link to the tools index.
 */
export default function ToolHeader({
  title,
  description,
  badge,
}: ToolHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      {/* Back navigation */}
      <Link
        href="/tools"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)]
          hover:text-[var(--foreground)] transition-colors duration-150 w-fit group"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 transition-transform duration-150 group-hover:-translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Tools
      </Link>

      {/* Title row */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        {badge && (
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide
              border border-[var(--accent-glow)] bg-[var(--accent-glow)]
              text-[var(--accent-hover)]"
          >
            {badge}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-[var(--muted)] text-base leading-relaxed max-w-2xl">
        {description}
      </p>

      {/* Divider */}
      <div className="h-px bg-[var(--border)]" />
    </header>
  );
}
