"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * Tool module registry for the workspace.
 *
 * Each tool's client page is code-split. `preloadTool` fetches a tool's chunk
 * ahead of time (e.g. on hover) so opening it feels instant.
 */

type Loader = () => Promise<{ default: ComponentType }>;

const TOOL_LOADERS: Record<string, Loader> = {
  // Network & Security
  "port-checker": () => import("@/app/tools/network-security/port-checker/client-page"),
  "pcap-analyzer": () => import("@/app/tools/network-security/pcap-analyzer/client-page"),
  "threat-inspector": () => import("@/app/tools/network-security/threat-inspector/client-page"),
  "ssl-toolkit": () => import("@/app/tools/ssl-toolkit/client-page"),
  // Data & Analytics
  "qr-generator": () => import("@/app/tools/qr-generator/client-page"),
  "log-analyzer": () => import("@/app/tools/data-analytics/log-analyzer/client-page"),
  // Dev & Automation
  "paste-to-code": () => import("@/app/tools/paste-to-code/client-page"),
  "regex-studio": () => import("@/app/tools/dev-automation/regex-studio/client-page"),
  "api-request-lab": () => import("@/app/tools/dev-automation/api-request-lab/client-page"),
  "core-encoder": () => import("@/app/tools/dev-automation/core-encoder/client-page"),
};

export function ToolLoadingState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8" role="status" aria-live="polite">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <div className="toolsy-skeleton h-8 w-full rounded-xl" />
        <div className="toolsy-skeleton h-6 w-3/4 rounded-lg" />
        <div className="toolsy-skeleton mt-4 h-40 w-full rounded-2xl" />
      </div>
      <span className="text-sm text-muted">Loading tool…</span>
    </div>
  );
}

export const TOOL_MODULES: Record<string, ComponentType> = Object.fromEntries(
  Object.entries(TOOL_LOADERS).map(([slug, load]) => [
    slug,
    dynamic(load, { ssr: false, loading: () => <ToolLoadingState /> }),
  ])
);

export function preloadTool(slug: string) {
  TOOL_LOADERS[slug]?.().catch(() => {});
}
