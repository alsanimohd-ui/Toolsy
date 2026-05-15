import { Suspense } from "react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { CategoryId, findTool, getCategory, tools } from "@/lib/tools";

interface ToolRouteParams {
  params: {
    category: CategoryId;
    slug: string;
  };
}

const implementedTools = {
  "log-analyzer": dynamic(() => import("../../data-analytics/log-analyzer/client-page")),
  "paste-to-code": dynamic(() => import("../../paste-to-code/client-page")),
  "qr-generator": dynamic(() => import("../../qr-generator/client-page")),
  "ssl-toolkit": dynamic(() => import("../../ssl-toolkit/client-page")),
  "threat-inspector": dynamic(() => import("../../network-security/threat-inspector/client-page")),
  "pcap-analyzer": dynamic(() => import("../../network-security/pcap-analyzer/client-page")),
  "port-checker": dynamic(() => import("../../network-security/port-checker/client-page")),
  "regex-studio": dynamic(() => import("../../dev-automation/regex-studio/client-page")),
  "api-request-lab": dynamic(() => import("../../dev-automation/api-request-lab/client-page")),
  "core-encoder": dynamic(() => import("../../dev-automation/core-encoder/client-page")),
} as const;

export function generateStaticParams() {
  return tools
    .filter((tool) => tool.slug in implementedTools)
    .map((tool) => ({
      category: tool.categoryId,
      slug: tool.slug,
    }));
}

export function generateMetadata({ params }: ToolRouteParams): Metadata {
  const tool = findTool(params.category, params.slug);
  if (!tool) {
    return {
      title: "Toolsy",
    };
  }

  const category = getCategory(tool.categoryId);
  return {
    title: `${tool.name} | ${category.label} | Toolsy`,
    description: tool.description,
  };
}

export default function NestedToolPage({ params }: ToolRouteParams) {
  const tool = findTool(params.category, params.slug);
  if (!tool || !(tool.slug in implementedTools)) notFound();

  const ToolClient = implementedTools[tool.slug as keyof typeof implementedTools];

  return (
    <Suspense fallback={<div className="text-center py-12 text-muted font-mono text-xs">Loading {tool.name}...</div>}>
      <ToolClient />
    </Suspense>
  );
}
