"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Braces,
  Workflow,
  ChevronRight,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
} from "lucide-react";
import { categoryList, tools, type CategoryId, type Tool } from "@/lib/tools";
import { useWorkspace } from "./WorkspaceContext";
import { MiIcon } from "@/components/ui/MiLogo";

/* ───────────────────────────────────────────────────────────────────── */
/*  Category Icon Map                                                    */
/* ───────────────────────────────────────────────────────────────────── */

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ShieldCheck,
  Braces,
  Workflow,
};

/* ───────────────────────────────────────────────────────────────────── */
/*  Tool Item                                                            */
/* ───────────────────────────────────────────────────────────────────── */

function ToolItem({
  tool,
  isActive,
  collapsed,
}: {
  tool: Tool;
  isActive: boolean;
  collapsed: boolean;
}) {
  const { openTool } = useWorkspace();

  const handleClick = (e: React.MouseEvent) => {
    if (tool.isExternal) return; // Let the link navigate naturally
    e.preventDefault();
    openTool({
      slug: tool.slug,
      categoryId: tool.categoryId,
      route: tool.route,
    });
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ x: 2 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`
        group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
        text-left transition-all duration-200 text-xs
        ${isActive
          ? "bg-accent/15 text-accent font-black border border-accent/25"
          : "text-muted hover:text-foreground hover:bg-white/5 font-semibold border border-transparent"
        }
      `}
      title={collapsed ? tool.name : undefined}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="active-tool-indicator"
          className="absolute left-0 inset-y-2 w-0.5 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}

      {/* Icon badge */}
      <span
        className={`
          shrink-0 flex items-center justify-center rounded-lg
          text-[9px] font-black tracking-wider transition-all duration-200
          ${collapsed ? "size-8" : "size-6"}
          ${isActive
            ? "bg-accent/20 text-accent"
            : "bg-white/5 text-muted group-hover:bg-white/10 group-hover:text-foreground"
          }
        `}
      >
        {tool.icon}
      </span>

      {/* Label */}
      {!collapsed && (
        <AnimatePresence>
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            className="flex-1 truncate text-[11px] leading-none"
          >
            {tool.name}
          </motion.span>
        </AnimatePresence>
      )}

      {/* External badge */}
      {!collapsed && tool.isExternal && (
        <ExternalLink className="size-3 shrink-0 opacity-40" />
      )}
    </motion.button>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/*  Category Section                                                     */
/* ───────────────────────────────────────────────────────────────────── */

function CategorySection({
  categoryId,
  collapsed,
}: {
  categoryId: CategoryId;
  collapsed: boolean;
}) {
  const { expandedCategory, setExpandedCategory, activeTool } = useWorkspace();
  const category = categoryList.find((c) => c.id === categoryId)!;
  const Icon = CATEGORY_ICONS[category.icon];
  const categoryTools = tools.filter((t) => t.categoryId === categoryId);
  const isExpanded = expandedCategory === categoryId;
  const hasActiveChild = activeTool?.categoryId === categoryId;

  const toggleExpanded = () => {
    setExpandedCategory(isExpanded ? null : categoryId);
  };

  return (
    <div className="flex flex-col gap-0.5">
      {/* Category header */}
      <button
        onClick={toggleExpanded}
        className={`
          group flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl
          transition-all duration-200
          ${hasActiveChild
            ? "text-foreground"
            : "text-muted hover:text-foreground"
          }
        `}
        title={collapsed ? category.label : undefined}
      >
        {/* Category icon */}
        <div
          className="shrink-0 flex items-center justify-center size-7 rounded-xl transition-all duration-200"
          style={{
            backgroundColor: isExpanded || hasActiveChild
              ? `${category.color}20`
              : "rgba(255,255,255,0.04)",
            color: isExpanded || hasActiveChild
              ? category.color
              : undefined,
          }}
        >
          <Icon className="size-3.5" />
        </div>

        {!collapsed && (
          <>
            <span
              className="flex-1 text-left text-[10px] font-black uppercase tracking-[0.18em] truncate"
              style={{ color: isExpanded || hasActiveChild ? category.color : undefined }}
            >
              {category.shortLabel}
            </span>
            <ChevronRight
              className={`size-3 shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`}
            />
          </>
        )}
      </button>

      {/* Tool list (when expanded and not collapsed) */}
      {!collapsed && (
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="overflow-hidden pl-3"
            >
              <div className="flex flex-col gap-0.5 pt-0.5 pb-1 border-l border-white/5 pl-3 ml-3.5">
                {categoryTools.map((tool) => (
                  <ToolItem
                    key={tool.slug}
                    tool={tool}
                    isActive={activeTool?.slug === tool.slug}
                    collapsed={false}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Collapsed tool items (shown below icon) */}
      {collapsed && isExpanded && (
        <div className="flex flex-col gap-0.5 items-center">
          {categoryTools.map((tool) => (
            <ToolItem
              key={tool.slug}
              tool={tool}
              isActive={activeTool?.slug === tool.slug}
              collapsed={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/*  Main Sidebar                                                         */
/* ───────────────────────────────────────────────────────────────────── */

export default function WorkspaceSidebar() {
  const { activeTool, closeActiveTool, sidebarCollapsed, setSidebarCollapsed } =
    useWorkspace();

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ type: "spring", stiffness: 400, damping: 35 }}
      className={`
        relative flex flex-col h-full shrink-0
        border-r border-white/5
        bg-black/20 backdrop-blur-xl
        overflow-hidden
      `}
    >
      {/* ── Header ── */}
      <div
        className={`
          flex items-center h-14 px-3 shrink-0
          border-b border-white/5
          ${sidebarCollapsed ? "justify-center" : "justify-between"}
        `}
      >
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <MiIcon className="size-4 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-muted/70">
              Mi Workspace
            </span>
          </motion.div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex items-center justify-center size-8 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-all shrink-0"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex flex-col flex-1 gap-1 p-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* All Tools / Grid View */}
        <button
          onClick={closeActiveTool}
          className={`
            group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
            transition-all duration-200 border
            ${!activeTool
              ? "bg-accent/15 text-accent font-black border-accent/25"
              : "text-muted hover:text-foreground hover:bg-white/5 font-semibold border-transparent"
            }
          `}
          title={sidebarCollapsed ? "All Modules" : undefined}
        >
          <LayoutGrid
            className={`shrink-0 transition-colors duration-200 ${
              sidebarCollapsed ? "size-5" : "size-4"
            } ${!activeTool ? "text-accent" : "text-muted group-hover:text-foreground"}`}
          />
          {!sidebarCollapsed && (
            <span className="text-[11px] truncate">All Modules</span>
          )}
        </button>

        {/* Divider */}
        <div className="my-1 h-px bg-white/5" />

        {/* Categories */}
        {categoryList.map((cat) => (
          <CategorySection
            key={cat.id}
            categoryId={cat.id}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>

      {/* ── Footer ── */}
      {!sidebarCollapsed && (
        <div className="shrink-0 px-3 pb-4 pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted/40 truncate">
              Systems Nominal
            </span>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
