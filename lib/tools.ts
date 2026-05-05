/**
 * Central Tools Registry
 *
 * Each tool has a name, description, category, route, and visual metadata.
 */

export interface Tool {
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Category visually grouping the tool */
  category: string;
  /** Full application path to the tool page */
  route: string;
  /** URL-safe identifier for compatibility */
  slug: string;
  /** Emoji icon displayed on the card */
  icon: string;
  /** Flag to indicate if the tool is an external link */
  isExternal?: boolean;
  /** External URL if isExternal is true */
  externalUrl?: string;
}

export const tools: Tool[] = [
  {
    name: "Paste to Code",
    slug: "paste-to-code",
    route: "/tools/paste-to-code",
    description: "Paste messy data (CSV, TSV, HTML tables) → instantly convert it into clean JSON, TS, SQL, or PHP code.",
    category: "Data",
    icon: "📋",
  },
  {
    name: "SSL Toolkit",
    slug: "ssl-toolkit",
    route: "/tools/ssl-toolkit",
    description: "Extract PFX, generate certificates, and decode PEM/CRT info completely offline.",
    category: "Security",
    icon: "🔐",
  },
  {
    name: "JSON Lego",
    slug: "json-lego",
    route: "https://jsonlego.app",
    description: "Build, format, and manipulate JSON visually.",
    category: "Data",
    icon: "📦",
    isExternal: true,
    externalUrl: "https://jsonlego.app"
  },
  {
    name: "Log Analyzer",
    slug: "log-analyzer",
    route: "/tools/log-analyzer",
    description: "Instantly filter, highlight, and summarize raw server or application log outputs.",
    category: "Logs",
    icon: "📋",
  }
];
