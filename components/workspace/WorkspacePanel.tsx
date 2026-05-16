"use client";

import dynamic from "next/dynamic";
import { useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";

/* ───────────────────────────────────────────────────────────────────── */
/*  Lazy-loaded Tool Map                                                 */
/*  Each tool's client-page is imported dynamically so only the active  */
/*  tool is ever loaded. ssr:false because these are interactive clients */
/* ───────────────────────────────────────────────────────────────────── */

const TOOL_MODULES: Record<string, React.ComponentType> = {
  // ── Network & Security ──────────────────────────────────────────────
  "port-checker": dynamic(
    () => import("@/app/tools/network-security/port-checker/client-page"),
    { ssr: false }
  ),
  "pcap-analyzer": dynamic(
    () => import("@/app/tools/network-security/pcap-analyzer/client-page"),
    { ssr: false }
  ),
  "threat-inspector": dynamic(
    () => import("@/app/tools/network-security/threat-inspector/client-page"),
    { ssr: false }
  ),
  "ssl-toolkit": dynamic(
    () => import("@/app/tools/ssl-toolkit/client-page"),
    { ssr: false }
  ),

  // ── Data & Analytics ────────────────────────────────────────────────
  "qr-generator": dynamic(
    () => import("@/app/tools/qr-generator/client-page"),
    { ssr: false }
  ),
  "log-analyzer": dynamic(
    () => import("@/app/tools/data-analytics/log-analyzer/client-page"),
    { ssr: false }
  ),

  // ── Dev & Automation ─────────────────────────────────────────────────
  "paste-to-code": dynamic(
    () => import("@/app/tools/paste-to-code/client-page"),
    { ssr: false }
  ),
  "regex-studio": dynamic(
    () => import("@/app/tools/dev-automation/regex-studio/client-page"),
    { ssr: false }
  ),
  "api-request-lab": dynamic(
    () => import("@/app/tools/dev-automation/api-request-lab/client-page"),
    { ssr: false }
  ),
  "core-encoder": dynamic(
    () => import("@/app/tools/dev-automation/core-encoder/client-page"),
    { ssr: false }
  ),
};

/* ───────────────────────────────────────────────────────────────────── */
/*  Loading Spinner                                                      */
/* ───────────────────────────────────────────────────────────────────── */

function ToolLoadingState({ name }: { name?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-muted/40">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 className="size-8" />
      </motion.div>
      <span className="text-[10px] font-black uppercase tracking-[0.3em]">
        {name ? `Loading ${name}…` : "Loading module…"}
      </span>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/*  Workspace Panel                                                      */
/* ───────────────────────────────────────────────────────────────────── */

interface WorkspacePanelProps {
  /** Default content shown when no tool is active (tools grid) */
  children: React.ReactNode;
}

export default function WorkspacePanel({ children }: WorkspacePanelProps) {
  const { activeTool } = useWorkspace();

  // Memoize the component reference to avoid re-creating on every render
  const ToolComponent = useMemo(() => {
    if (!activeTool) return null;
    return TOOL_MODULES[activeTool.slug] ?? null;
  }, [activeTool?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="workspace-panel relative flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {activeTool && ToolComponent ? (
          <motion.div
            key={activeTool.slug}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            <Suspense fallback={<ToolLoadingState name={activeTool.slug} />}>
              <ToolComponent />
            </Suspense>
          </motion.div>
        ) : (
          <motion.div
            key="tools-grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
