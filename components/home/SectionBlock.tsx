"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Tool } from "@/lib/tools";
import GlassCard from "@/components/ui/GlassCard";

interface ToolCardProps {
  tool: Tool;
  color: string;
}

export function ToolCard({ tool, color }: ToolCardProps) {
  const isExternal = tool.isExternal;

  return (
    <Link
      href={tool.route}
      target={isExternal ? "_blank" : undefined}
      className="group relative block transition-all"
    >
      <GlassCard className="p-6 h-full flex flex-col gap-4 border-border-subtle hover:border-accent/40">
        <div className="flex items-start justify-between">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border border-border-subtle bg-surface group-hover:bg-accent/5 transition-all"
            style={{ borderColor: `${color}44` }}
          >
            {tool.icon}
          </div>
          {isExternal && (
            <span className="text-[10px] font-black tracking-widest text-muted uppercase border border-border-subtle px-2 py-1 rounded-md">
              External
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-black text-foreground group-hover:text-accent transition-colors">
            {tool.name}
          </h3>
          <p className="text-sm text-muted leading-relaxed line-clamp-2 font-medium">
            {tool.description}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase text-muted group-hover:text-accent transition-all">
          <span>{isExternal ? "Open" : "Launch"}</span>
          <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </GlassCard>
    </Link>
  );
}

interface SectionBlockProps {
  id: string;
  title: string;
  description: string;
  color: string;
  tools: Tool[];
}

export function SectionBlock({ id, title, description, color, tools }: SectionBlockProps) {
  return (
    <section id={id} className="py-24 md:py-32 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col gap-4 mb-16">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground uppercase italic drop-shadow-sm">
              {title}
            </h2>
            <div className="h-[2px] flex-1 bg-gradient-to-r from-accent/20 to-transparent" />
          </div>
          <p className="text-muted max-w-xl font-medium leading-relaxed">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {tools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} color={color} />
          ))}
        </div>
      </div>
    </section>
  );
}
