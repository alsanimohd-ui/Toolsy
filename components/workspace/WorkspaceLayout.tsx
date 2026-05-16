"use client";

import { type ReactNode } from "react";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceContext";
import WorkspaceSidebar from "@/components/workspace/WorkspaceSidebar";
import WorkspacePanel from "@/components/workspace/WorkspacePanel";

/* ───────────────────────────────────────────────────────────────────── */
/*  Workspace Shell                                                      */
/*  This is the inner client component that renders the sidebar + panel */
/* ───────────────────────────────────────────────────────────────────── */

function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="workspace-shell flex h-[100dvh] overflow-hidden">
      {/* Left: IDE-style sidebar */}
      <WorkspaceSidebar />

      {/* Right: Dynamic tool panel */}
      <WorkspacePanel>{children}</WorkspacePanel>
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
