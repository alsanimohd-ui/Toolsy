import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import type { ReactNode } from "react";

/**
 * Tools workspace layout.
 *
 * Wraps all /tools/** routes with the IDE-style workspace shell:
 *   - Left sidebar (categories + tool list)
 *   - Right panel (active tool or tools grid)
 *
 * Individual tool pages still work via direct URL — the workspace
 * provider handles syncing state with the current URL.
 */
export default function ToolsLayout({ children }: { children: ReactNode }) {
  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
