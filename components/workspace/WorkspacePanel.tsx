"use client";

import ToolIcon from "@/components/ui/ToolIcon";
import { motion } from "framer-motion";
import { useWorkspace } from "./WorkspaceContext";
import { tools, getCategory } from "@/lib/tools";
import { X } from "lucide-react";
import { TOOL_MODULES } from "./toolModules";

/* ───────────────────────────────────────────────────────────────────── */
/*  Workspace Panel                                                      */
/* ───────────────────────────────────────────────────────────────────── */

interface WorkspacePanelProps {
  /** Default content shown when no tool is active (tools grid) */
  children: React.ReactNode;
}

export default function WorkspacePanel({ children }: WorkspacePanelProps) {
  const { activeTool, openTools, openTool, closeTool } = useWorkspace();

  return (
    <div className="flex flex-col h-full overflow-hidden w-full relative">
      {/* Dynamic Tab Bar */}
      {openTools.length > 0 && (
        <div className="flex items-center w-full h-11 border-b border-border-subtle bg-surface-overlay backdrop-blur-xl shrink-0 overflow-x-auto overflow-y-hidden select-none z-20">
          {openTools.map((t) => {
            const toolData = tools.find(tool => tool.slug === t.slug);
            const category = getCategory(t.categoryId);
            const isActive = activeTool?.slug === t.slug;
            
            return (
              <div
                key={t.slug}
                onClick={() => openTool(t)}
                className={`flex items-center gap-2 h-full px-4 border-r border-border-subtle cursor-pointer transition-all relative group text-[10px] font-black uppercase tracking-wider ${
                  isActive
                    ? "bg-surface-raised text-foreground"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <motion.div
                    layoutId="active-tab-line"
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: category?.color || "var(--accent)" }}
                  />
                )}
                
                {/* Icon */}
                <span className="opacity-70 group-hover:opacity-100 transition-opacity">
                  <ToolIcon slug={t.slug} className="size-3.5" />
                </span>
                
                {/* Label */}
                <span className="truncate max-w-[120px]">
                  {toolData?.name || t.slug}
                </span>
                
                {/* Close Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTool(t.slug);
                  }}
                  className="flex items-center justify-center size-4 rounded-md hover:bg-surface text-muted hover:text-foreground transition-colors ml-1"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Content panel */}
      <div id="main-content" role="main" className="workspace-panel relative flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Open tools stay mounted (hidden when inactive) so tabs keep their state */}
        {openTools.map((t) => {
          const ToolComponent = TOOL_MODULES[t.slug];
          if (!ToolComponent) return null;
          return (
            <div key={t.slug} hidden={activeTool?.slug !== t.slug}>
              <ToolComponent />
            </div>
          );
        })}
        {(!activeTool || !TOOL_MODULES[activeTool.slug]) && <div>{children}</div>}
      </div>
    </div>
  );
}
