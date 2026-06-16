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
  X,
  ExternalLink,
} from "lucide-react";
import { categoryList, tools, type CategoryId, type Tool } from "@/lib/tools";
import { useWorkspace } from "./WorkspaceContext";
import { MiIcon } from "@/components/ui/MiLogo";
import { useFocusTrap } from "@/hooks/useFocusTrap";

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
  onActivate,
}: {
  tool: Tool;
  isActive: boolean;
  collapsed: boolean;
  onActivate?: () => void;
}) {
  const { openTool } = useWorkspace();

  const handleClick = (e: React.MouseEvent) => {
    if (tool.isExternal) return;
    e.preventDefault();
    openTool({
      slug: tool.slug,
      categoryId: tool.categoryId,
      route: tool.route,
    });
    onActivate?.();
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
              ? "bg-accent/15 text-accent font-black border border-accent/25 shadow-[0_0_12px_var(--accent-glow)]"
              : "text-muted hover:text-foreground hover:bg-surface font-semibold border border-transparent"
            }
          `}
        title={collapsed ? tool.name : tool.name}
        aria-label={tool.name}
        aria-current={isActive ? "page" : undefined}
      >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="active-tool-indicator"
          className="absolute left-0 inset-y-2 w-1 rounded-full bg-accent"
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
                : "bg-surface text-muted group-hover:bg-surface-raised group-hover:text-foreground"
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
  onActivate,
}: {
  categoryId: CategoryId;
  collapsed: boolean;
  onActivate?: () => void;
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
          aria-label={category.label}
          aria-expanded={isExpanded}
        >
        {/* Category icon */}
        <div
          className="shrink-0 flex items-center justify-center size-7 rounded-xl transition-all duration-200"
          style={{
            backgroundColor: isExpanded || hasActiveChild
              ? `${category.color}20`
              : "var(--surface-raised)",
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
              <div className="flex flex-col gap-0.5 pt-0.5 pb-1 border-l border-border-subtle pl-3 ml-3.5">
                {categoryTools.map((tool) => (
                  <ToolItem
                    key={tool.slug}
                    tool={tool}
                    isActive={activeTool?.slug === tool.slug}
                    collapsed={false}
                    onActivate={onActivate}
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
              onActivate={onActivate}
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

export default function WorkspaceSidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const { activeTool, closeActiveTool, sidebarCollapsed, setSidebarCollapsed } =
    useWorkspace();

  const handleToolClick = () => {
    onMobileClose?.();
  };

  const focusTrapRef = useFocusTrap(!!mobileOpen);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      <motion.aside
        animate={{
          width: sidebarCollapsed ? 64 : 240,
          x: mobileOpen ? 0 : undefined,
        }}
        initial={false}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        className={`
          relative flex flex-col h-full shrink-0
          border-r border-border-subtle
          bg-surface-overlay backdrop-blur-xl
          overflow-hidden
          max-md:fixed max-md:left-0 max-md:top-0 max-md:z-40 max-md:h-dvh
          ${mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"}
          max-md:transition-transform max-md:duration-300 max-md:ease-in-out
        `}
      >
      <div ref={focusTrapRef} className="flex flex-col h-full">
      {/* ── Header ── */}
      <div
className={`
           flex items-center h-14 px-3 shrink-0
           border-b border-border-subtle
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
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-muted">
              Mi Workspace
            </span>
          </motion.div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex items-center justify-center size-8 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-all shrink-0"
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
      <nav className="flex flex-col flex-1 gap-1 p-2 overflow-y-auto overflow-x-hidden custom-scrollbar" aria-label="Tool navigation">
        {/* All Tools / Grid View */}
        <button
          onClick={() => { closeActiveTool(); handleToolClick(); }}
          className={`
            group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
            transition-all duration-200 border
            ${!activeTool
              ? "bg-accent/15 text-accent font-black border-accent/25 shadow-[0_0_12px_var(--accent-glow)]"
              : "text-muted hover:text-foreground hover:bg-surface font-semibold border-transparent"
            }
          `}
          title={sidebarCollapsed ? "All Modules" : undefined}
          aria-label="All Modules"
          aria-current={!activeTool ? "page" : undefined}
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
        <div className="my-1 h-px bg-border-subtle" />

        {/* Categories */}
        {categoryList.map((cat) => (
          <CategorySection
            key={cat.id}
            categoryId={cat.id}
            collapsed={sidebarCollapsed}
            onActivate={handleToolClick}
          />
        ))}
      </nav>

      {/* ── Footer ── */}
      {!sidebarCollapsed && (
        <div className="shrink-0 px-3 pb-4 pt-2 border-t border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-muted truncate">
              Systems Nominal
            </span>
          </div>
        </div>
      )}
    </div>
    {/* Mobile close button */}
    {mobileOpen && (
      <button
        data-sidebar-close
        onClick={onMobileClose}
        className="absolute top-3 right-3 z-50 flex md:hidden items-center justify-center size-8 rounded-xl text-muted hover:text-foreground hover:bg-surface transition-all"
        aria-label="Close sidebar"
      >
        <X className="size-4" />
      </button>
    )}
    </motion.aside>
    </>
  );
}
