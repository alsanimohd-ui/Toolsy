"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Tool } from "@/lib/tools";

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
      className="group relative block p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all overflow-hidden"
    >
      {/* Hover Glow */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), ${color}11, transparent 40%)`
        }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border border-white/5 bg-white/[0.03] group-hover:bg-white/[0.06] transition-colors shadow-inner"
            style={{ borderColor: `${color}22` }}
          >
            {tool.icon}
          </div>
          {isExternal && (
            <span className="text-[10px] font-black tracking-widest text-white/20 uppercase border border-white/5 px-2 py-1 rounded">
              External
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-white transition-colors">
          {tool.name}
        </h3>
        <p className="text-sm text-white/40 leading-relaxed mb-6">
          {tool.description}
        </p>

        <div className="flex items-center gap-1.5 text-xs font-black tracking-widest uppercase opacity-40 group-hover:opacity-100 transition-all" style={{ color: color }}>
          <span>{isExternal ? "Open" : "Launch"}</span>
          <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
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
    <section id={id} className="py-32 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col gap-4 mb-16">
          <div className="flex items-center gap-4">
            <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">
              {title}
            </h2>
            <div className="h-0.5 flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <p className="text-[var(--muted)] max-w-xl">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} color={color} />
          ))}
        </div>
      </div>
    </section>
  );
}
