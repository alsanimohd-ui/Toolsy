"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { tools, type CategoryId, type Tool } from "@/lib/tools";

export interface ActiveTool {
  slug: string;
  categoryId: CategoryId;
  route: string;
}

interface WorkspaceContextValue {
  activeTool: ActiveTool | null;
  openTool: (tool: ActiveTool) => void;
  closeActiveTool: () => void;
  expandedCategory: CategoryId | null;
  setExpandedCategory: (id: CategoryId | null) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  recentTools: string[];
  pinnedTools: string[];
  togglePin: (slug: string) => void;
  isPinned: (slug: string) => boolean;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

const RECENT_KEY = "mi-recent-tools";
const PINNED_KEY = "mi-pinned-tools";
const MAX_RECENT = 6;

export function WorkspaceProvider({
  children,
  initialTool = null,
}: {
  children: ReactNode;
  initialTool?: ActiveTool | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const resolvedTool = useMemo(() => {
    const t = tools.find((t) => t.route === pathname);
    if (!t) return null;
    return { slug: t.slug, categoryId: t.categoryId, route: t.route };
  }, [pathname]);

  const [activeTool, setActiveTool] = useState<ActiveTool | null>(initialTool ?? resolvedTool);
  const [expandedCategory, setExpandedCategory] = useState<CategoryId | null>(
    (initialTool ?? resolvedTool)?.categoryId ?? null
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [recentTools, setRecentTools] = useState<string[]>([]);
  const [pinnedTools, setPinnedTools] = useState<string[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Load persisted state
  useEffect(() => {
    try {
      const recent = localStorage.getItem(RECENT_KEY);
      if (recent) setRecentTools(JSON.parse(recent));
      const pinned = localStorage.getItem(PINNED_KEY);
      if (pinned) setPinnedTools(JSON.parse(pinned));
    } catch {}
  }, []);

  // Persist
  useEffect(() => {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentTools)); } catch {}
  }, [recentTools]);

  useEffect(() => {
    try { localStorage.setItem(PINNED_KEY, JSON.stringify(pinnedTools)); } catch {}
  }, [pinnedTools]);

  // Sync with pathname
  useEffect(() => {
    if (resolvedTool) {
      setActiveTool(resolvedTool);
      setExpandedCategory(resolvedTool.categoryId);
    } else if (pathname === "/tools") {
      setActiveTool(null);
    }
  }, [resolvedTool, pathname]);

  // Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openTool = useCallback(
    (tool: ActiveTool) => {
      setActiveTool(tool);
      setExpandedCategory(tool.categoryId);
      setRecentTools((prev) => {
        const next = [tool.slug, ...prev.filter((s) => s !== tool.slug)].slice(0, MAX_RECENT);
        return next;
      });
      router.push(tool.route, { scroll: false });
      setCommandPaletteOpen(false);
    },
    [router]
  );

  const closeActiveTool = useCallback(() => {
    setActiveTool(null);
    router.push("/tools", { scroll: false });
  }, [router]);

  const togglePin = useCallback((slug: string) => {
    setPinnedTools((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }, []);

  const isPinned = useCallback((slug: string) => pinnedTools.includes(slug), [pinnedTools]);

  return (
    <WorkspaceContext.Provider
      value={{
        activeTool,
        openTool,
        closeActiveTool,
        expandedCategory,
        setExpandedCategory,
        sidebarCollapsed,
        setSidebarCollapsed,
        recentTools,
        pinnedTools,
        togglePin,
        isPinned,
        commandPaletteOpen,
        setCommandPaletteOpen,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function getToolBySlug(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug);
}