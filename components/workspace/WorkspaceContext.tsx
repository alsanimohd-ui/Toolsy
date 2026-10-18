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
  /** All currently open tools/tabs */
  openTools: ActiveTool[];
  /** Switch to a tool — updates state + URL without full reload */
  openTool: (tool: ActiveTool) => void;
  /** Close a specific tool/tab */
  closeTool: (slug: string) => void;
  /** Return to the tools-grid default view */
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
const TABS_KEY = "mi-open-tabs";
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
  const [openTools, setOpenTools] = useState<ActiveTool[]>(() => {
    const initial = initialTool ?? resolvedTool;
    return initial ? [initial] : [];
  });

  const [expandedCategory, setExpandedCategory] = useState<CategoryId | null>(
    (initialTool ?? resolvedTool)?.categoryId ?? null
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [recentTools, setRecentTools] = useState<string[]>([]);
  const [pinnedTools, setPinnedTools] = useState<string[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const [tabsRestored, setTabsRestored] = useState(false);

  // Load persisted state
  useEffect(() => {
    try {
      const recent = localStorage.getItem(RECENT_KEY);
      if (recent) setRecentTools(JSON.parse(recent));
      const pinned = localStorage.getItem(PINNED_KEY);
      if (pinned) setPinnedTools(JSON.parse(pinned));

      // Restore open tabs (only tools that still exist and run inside the workspace)
      const savedTabs: unknown = JSON.parse(localStorage.getItem(TABS_KEY) ?? "[]");
      if (Array.isArray(savedTabs)) {
        const restored: ActiveTool[] = [];
        for (const slug of savedTabs) {
          const t = tools.find((x) => x.slug === slug && !x.isExternal);
          if (t) restored.push({ slug: t.slug, categoryId: t.categoryId, route: t.route });
        }
        if (restored.length > 0) {
          setOpenTools((prev) => [
            ...restored,
            ...prev.filter((p) => !restored.some((r) => r.slug === p.slug)),
          ]);
        }
      }
    } catch {}
    setTabsRestored(true);
  }, []);

  // Persist open tabs (after restore, so the initial empty state never overwrites them)
  useEffect(() => {
    if (!tabsRestored) return;
    try { localStorage.setItem(TABS_KEY, JSON.stringify(openTools.map((t) => t.slug))); } catch {}
  }, [openTools, tabsRestored]);

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
      setOpenTools((prev) => {
        if (prev.some((t) => t.slug === resolvedTool.slug)) return prev;
        return [...prev, resolvedTool];
      });
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
      setOpenTools((prev) => {
        if (prev.some((t) => t.slug === tool.slug)) return prev;
        return [...prev, tool];
      });
      router.push(tool.route, { scroll: false });
      setCommandPaletteOpen(false);
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
        openTools,
        openTool,
        closeTool,
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