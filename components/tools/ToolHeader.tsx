import Link from "next/link";
import { Braces, ShieldCheck, Workflow } from "lucide-react";
import { CategoryId, getCategory } from "@/lib/tools";

interface ToolHeaderProps {
  /** Tool name — rendered as the page <h1> */
  title: string;
  /** Short description of what the tool does */
  description: string;
  /** Optional category badge label (e.g. "Text", "JSON", "Crypto") */
  badge?: string;
  /** Canonical category identity */
  categoryId?: CategoryId;
}

const categoryIcons = {
  Braces,
  ShieldCheck,
  Workflow,
};

/**
 * ToolHeader
 * Displays the tool name, optional category badge, description,
 * and a back-navigation link to the tools index.
 */
export default function ToolHeader({
  title,
  description,
  badge,
  categoryId,
}: ToolHeaderProps) {
  const category = categoryId ? getCategory(categoryId) : null;
  const Icon = category ? categoryIcons[category.icon] : null;

  return (
    <header className="flex flex-col gap-[clamp(0.85rem,1.8svh,1.25rem)]">
      {/* Back navigation */}
      <div className="toolsy-meta flex flex-wrap items-center gap-2 text-muted">
        <Link href="/tools" className="transition-colors duration-200 hover:text-foreground">
          Mi
        </Link>
        {category && (
          <>
            <span className="text-muted/40">/</span>
            <Link href={category.route} className="transition-colors duration-200 hover:text-foreground">
              {category.label}
            </Link>
          </>
        )}
      </div>

      {/* Title row */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="toolsy-page-title">
          {title}
        </h1>
        {(category || badge) && (
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]"
            style={{
              borderColor: "rgba(var(--accent-rgb), 0.24)", // Direct fallback
              borderImage: "none", 
              borderImageSource: "none",
              backgroundColor: "var(--category-glow, var(--accent-glow))",
              color: "var(--category-accent, var(--accent-hover))",
            } as React.CSSProperties}
          >
            {Icon && <Icon className="h-3 w-3" />}
            {category?.label ?? badge}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="toolsy-description">
        {description}
      </p>

      {/* Divider */}
      <div className="toolsy-divider" />
    </header>
  );
}
