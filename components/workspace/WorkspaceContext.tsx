"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { tools, type CategoryId } from "@/lib/tools";

/* ───────────────────────────────────────────────────────────────────── */
/*  Types                                                                */
/* ───────────────────────────────────────────────────────────────────── */

export interface ActiveTool {
  slug: string;
  categoryId: CategoryId;
  route: string;
}

interface WorkspaceContextValue {
  /** Currently active tool, or null for the tools-grid view */
  activeTool: ActiveTool | null;
  /** All currently open tools/tabs */
  openTools: ActiveTool[];
  /** Switch to a tool — updates state + URL without full reload */
  openTool: (tool: ActiveTool) => void;
  /** Close a specific tool/tab */
  closeTool: (slug: string) => void;
  /** Return to the tools-grid default view */
  closeActiveTool: () => void;
  /** Currently expanded category in the sidebar */
  expandedCategory: CategoryId | null;
  setExpandedCategory: (id: CategoryId | null) => void;
  /** Is the sidebar collapsed to icon-only mode? */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
}

/* ───────────────────────────────────────────────────────────────────── */
/*  Context                                                              */
/* ───────────────────────────────────────────────────────────────────── */

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

/* ───────────────────────────────────────────────────────────────────── */
/*  Provider                                                             */
/* ───────────────────────────────────────────────────────────────────── */

interface WorkspaceProviderProps {
  children: ReactNode;
  /** Initial active tool (resolved from the current URL on SSR) */
  initialTool?: ActiveTool | null;
}

export function WorkspaceProvider({
  children,
  initialTool = null,
}: WorkspaceProviderProps) {
  const pathname = usePathname();
  const router = useRouter();

  // 1. Find the tool matching the current URL
  const resolvedTool = useMemo(() => {
    const t = tools.find((t) => t.route === pathname);
    if (!t) return null;
    return {
      slug: t.slug,
      categoryId: t.categoryId,
      route: t.route,
    };
  }, [pathname]);

  const [activeTool, setActiveTool] = useState<ActiveTool | null>(initialTool ?? resolvedTool);
  const [openTools, setOpenTools] = useState<ActiveTool[]>(() => {
    const initial = initialTool ?? resolvedTool;
    return initial ? [initial] : [];
  });

  const [expandedCategory, setExpandedCategory] = useState<CategoryId | null>(
    (initialTool ?? resolvedTool)?.categoryId ?? null
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 2. Sync state if pathname changes externally (e.g. browser navigation)
  useEffect(() => {
    if (resolvedTool) {
      setActiveTool(resolvedTool);
      setExpandedCategory(resolvedTool.categoryId);
      setOpenTools((prev) => {
        if (prev.some((t) => t.slug === resolvedTool.slug)) return prev;
        return [...prev, resolvedTool];
      });
    } else if (pathname === "/tools") {
      setActiveTool(null);
    }
  }, [resolvedTool, pathname]);

  const openTool = useCallback(
    (tool: ActiveTool) => {
      setActiveTool(tool);
      setExpandedCategory(tool.categoryId);
      setOpenTools((prev) => {
        if (prev.some((t) => t.slug === tool.slug)) return prev;
        return [...prev, tool];
      });
      router.push(tool.route, { scroll: false });
    },
    [router]
  );

  const closeTool = useCallback(
    (slug: string) => {
      setOpenTools((prev) => {
        const filtered = prev.filter((t) => t.slug !== slug);
        // If we closed the active tool, switch active to another or null
        if (activeTool?.slug === slug) {
          if (filtered.length > 0) {
            const nextActive = filtered[filtered.length - 1];
            setActiveTool(nextActive);
            router.push(nextActive.route, { scroll: false });
          } else {
            setActiveTool(null);
            router.push("/tools", { scroll: false });
          }
        }
        return filtered;
      });
    },
    [activeTool, router]
  );

  const closeActiveTool = useCallback(() => {
    setActiveTool(null);
    router.push("/tools", { scroll: false });
  }, [router]);

  return (
    <WorkspaceContext.Provider
      value={{
        activeTool,
        openTools,
        openTool,
        closeTool,
        closeActiveTool,
        expandedCategory,
        setExpandedCategory,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
