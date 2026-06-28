"use client";

import { useState, useRef, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceContext";
import WorkspaceSidebar from "@/components/workspace/WorkspaceSidebar";
import WorkspacePanel from "@/components/workspace/WorkspacePanel";
import QuickSwitcher from "@/components/workspace/QuickSwitcher";

/* ───────────────────────────────────────────────────────────────────── */
/*  Workspace Shell                                                      */
/*  This is the inner client component that renders the sidebar + panel */
/* ───────────────────────────────────────────────────────────────────── */

function WorkspaceShell({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="workspace-shell flex h-[100dvh] overflow-hidden relative">
      {/* Mobile hamburger toggle */}
      <button
        ref={hamburgerRef}
        onClick={() => setMobileSidebarOpen((v) => !v)}
        className="fixed top-3 left-3 z-50 flex md:hidden items-center justify-center size-9 rounded-xl bg-surface-overlay backdrop-blur-xl border border-border-subtle text-muted hover:text-foreground transition-colors"
        aria-label={mobileSidebarOpen ? "Close menu" : "Open menu"}
      >
        {mobileSidebarOpen ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {/* Left: IDE-style sidebar */}
      <WorkspaceSidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => {
          setMobileSidebarOpen(false);
          hamburgerRef.current?.focus();
        }}
      />

      {/* Right: Dynamic tool panel */}
      <WorkspacePanel>{children}</WorkspacePanel>

      {/* Quick command switcher switcher */}
      <QuickSwitcher />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/*  Exported Layout                                                      */
/* ───────────────────────────────────────────────────────────────────── */

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceProvider>
  );
}
