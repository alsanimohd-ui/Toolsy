/**
 * Central Tools Registry
 *
 * Category-aware metadata powers the homepage radial system,
 * tools index, breadcrumbs, and nested platform routes.
 */

export type CategoryId = "data-analytics" | "network-security" | "dev-automation";

export interface ToolCategory {
  id: CategoryId;
  label: string;
  shortLabel: string;
  description: string;
  icon: "Braces" | "ShieldCheck" | "Workflow";
  color: string;
  glow: string;
  glowColor: string;
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;
  radialStartAngle: number;
  radialEndAngle: number;
  route: string;
}

export interface Tool {
  /** Display name */
  name: string;
  /** URL-safe identifier */
  slug: string;
  /** Nested category-aware application path */
  route: string;
  /** Legacy flat path kept for compatibility */
  legacyRoute?: string;
  /** Short description */
  description: string;
  /** Display category label */
  category: string;
  /** Canonical category id */
  categoryId: CategoryId;
  /** Emoji icon displayed on the card */
  icon: string;
  /** Flag to indicate if the tool is an external link */
  isExternal?: boolean;
  /** External URL if isExternal is true */
  externalUrl?: string;
}

export const toolCategories: Record<CategoryId, ToolCategory> = {
  "network-security": {
    id: "network-security",
    label: "Network & Security",
    shortLabel: "Security",
    description: "Offline-first systems tools for certificates, keys, and secure inspection.",
    icon: "ShieldCheck",
    color: "#ef4444",
    glow: "rgba(239, 68, 68, 0.18)",
    glowColor: "rgba(239,68,68,0.5)",
    gradientStart: "#fca5a5",
    gradientMid: "#ef4444",
    gradientEnd: "#dc2626",
    radialStartAngle: 7.5,
    radialEndAngle: 112.5,
    route: "/tools/network-security",
  },
  "data-analytics": {
    id: "data-analytics",
    label: "Data & Analytics",
    shortLabel: "Data",
    description: "Structured utilities for formatting, parsing, and analyzing information.",
    icon: "Braces",
    color: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.18)",
    glowColor: "rgba(59,130,246,0.5)",
    gradientStart: "#93c5fd",
    gradientMid: "#3b82f6",
    gradientEnd: "#2563eb",
    radialStartAngle: 127.5,
    radialEndAngle: 232.5,
    route: "/tools/data-analytics",
  },
  "dev-automation": {
    id: "dev-automation",
    label: "Dev & Automation",
    shortLabel: "Dev",
    description: "Developer workflows for conversion, generation, automation, and operations.",
    icon: "Workflow",
    color: "#a855f7",
    glow: "rgba(168, 85, 247, 0.18)",
    glowColor: "rgba(168,85,247,0.5)",
    gradientStart: "#d8b4fe",
    gradientMid: "#a855f7",
    gradientEnd: "#9333ea",
    radialStartAngle: 247.5,
    radialEndAngle: 352.5,
    route: "/tools/dev-automation",
  },
};

export const categoryList = Object.values(toolCategories);

export function getCategory(categoryId: CategoryId) {
  return toolCategories[categoryId];
}

export function getToolPath(categoryId: CategoryId, slug: string) {
  return `/tools/${categoryId}/${slug}`;
}

export const tools: Tool[] = [
  {
    name: "QR Generator",
    slug: "qr-generator",
    route: getToolPath("data-analytics", "qr-generator"),
    description: "Full-featured QR creation studio. Generate website, WiFi, vCard, and custom branded QR codes with live preview and advanced styling.",
    category: toolCategories["data-analytics"].label,
    categoryId: "data-analytics",
    icon: "QR",
  },
  {
    name: "SSL Toolkit",
    slug: "ssl-toolkit",
    route: getToolPath("network-security", "ssl-toolkit"),
    legacyRoute: "/tools/ssl-toolkit",
    description: "Extract PFX, generate certificates, and decode PEM/CRT info completely offline.",
    category: toolCategories["network-security"].label,
    categoryId: "network-security",
    icon: "SSL",
  },
  {
    name: "Threat Inspector",
    slug: "threat-inspector",
    route: getToolPath("network-security", "threat-inspector"),
    description: "Local-first file analysis & VirusTotal reputation check. Extract IOCs and detect threats securely.",
    category: toolCategories["network-security"].label,
    categoryId: "network-security",
    icon: "BIO",
  },
  {
    name: "Port Checker",
    slug: "port-checker",
    route: getToolPath("network-security", "port-checker"),
    description: "Instantly check the connectivity status, latency, and service of any port on any host.",
    category: toolCategories["network-security"].label,
    categoryId: "network-security",
    icon: "PRT",
  },
  {
    name: "JsonLego",
    slug: "jsonlego",
    route: "https://jsonlego.app",
    isExternal: true,
    externalUrl: "https://jsonlego.app",
    description: "Advanced JSON formatting, validation, and visualization with a powerful Lego-inspired interface.",
    category: toolCategories["data-analytics"].label,
    categoryId: "data-analytics",
    icon: "LEGO",
  },
  {
    name: "Log Analyzer",
    slug: "log-analyzer",
    route: getToolPath("data-analytics", "log-analyzer"),
    legacyRoute: "/tools/log-analyzer",
    description: "Instantly filter, highlight, and summarize raw server or application log outputs.",
    category: toolCategories["data-analytics"].label,
    categoryId: "data-analytics",
    icon: "LOG",
  },
  {
    name: "Paste to Code",
    slug: "paste-to-code",
    route: getToolPath("dev-automation", "paste-to-code"),
    legacyRoute: "/tools/paste-to-code",
    description: "Paste messy data (CSV, TSV, HTML tables) and instantly convert it into clean JSON, TS, SQL, or PHP code.",
    category: toolCategories["dev-automation"].label,
    categoryId: "dev-automation",
    icon: "DEV",
  },
  {
    name: "Regex Studio",
    slug: "regex-studio",
    route: getToolPath("dev-automation", "regex-studio"),
    description: "World-class regex debugging and pattern analysis workstation. Write, test, and debug regular expressions in real-time.",
    category: toolCategories["dev-automation"].label,
    categoryId: "dev-automation",
    icon: "RGX",
  },
];

export function findTool(categoryId: CategoryId, slug: string) {
  return tools.find((tool) => tool.categoryId === categoryId && tool.slug === slug);
}
