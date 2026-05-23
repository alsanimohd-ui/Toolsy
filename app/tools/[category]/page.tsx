import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { ArrowRight, Braces, ShieldCheck, Workflow } from "lucide-react";
import { CategoryId, categoryList, getCategory, tools } from "@/lib/tools";
import GlassCard from "@/components/ui/GlassCard";

interface CategoryPageParams {
  params: {
    category: CategoryId;
  };
}

const categoryIcons = {
  Braces,
  ShieldCheck,
  Workflow,
};

export function generateStaticParams() {
  return categoryList.map((category) => ({ category: category.id }));
}

export default function CategoryPage({ params }: CategoryPageParams) {
  const category = getCategory(params.category);
  if (!category) notFound();

  const Icon = categoryIcons[category.icon];
  const categoryTools = tools.filter((tool) => tool.categoryId === category.id);

  return (
    <main
      className="toolsy-page-shell"
      style={{
        "--category-accent": category.color,
        "--category-glow": category.glow,
      } as CSSProperties}
    >
      <div className="toolsy-content">
        <header className="flex flex-col gap-[clamp(0.85rem,1.8svh,1.25rem)]">
          <div className="toolsy-meta flex items-center gap-2">
            <Link href="/tools" className="transition-colors hover:text-foreground">Mi</Link>
            <span className="text-muted/40">/</span>
            <span>{category.label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-raised text-[var(--category-accent)]">
              <Icon className="h-5 w-5" />
            </div>
            <h1 className="toolsy-page-title">{category.label}</h1>
          </div>
          <p className="toolsy-description">{category.description}</p>
          <div className="toolsy-divider" />
        </header>

        <section className="grid grid-cols-1 gap-[var(--space-section)] sm:grid-cols-2 lg:grid-cols-3">
          {categoryTools.map((tool) => (
            <Link key={tool.slug} href={tool.route} target={tool.isExternal ? "_blank" : undefined}>
              <GlassCard className="group flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <span className="toolsy-meta text-[var(--category-accent)]">{tool.icon}</span>
                  <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-[var(--category-accent)]" />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-[clamp(1rem,1.8vw,1.25rem)] font-black text-foreground">{tool.name}</h2>
                  <p className="text-sm font-medium leading-relaxed text-muted">{tool.description}</p>
                </div>
              </GlassCard>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
