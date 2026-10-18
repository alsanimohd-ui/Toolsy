import {
  Activity,
  Binary,
  Braces,
  ClipboardPaste,
  Lock,
  Network,
  Plug,
  QrCode,
  Regex,
  ScrollText,
  Send,
  ShieldAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const TOOL_ICONS: Record<string, LucideIcon> = {
  "qr-generator": QrCode,
  "ssl-toolkit": Lock,
  "threat-inspector": ShieldAlert,
  "port-checker": Plug,
  "pcap-analyzer": Activity,
  jsonlego: Braces,
  "log-analyzer": ScrollText,
  "paste-to-code": ClipboardPaste,
  "regex-studio": Regex,
  "api-request-lab": Send,
  "running-config-decoder": Network,
  "core-encoder": Binary,
};

export function getToolIcon(slug: string): LucideIcon {
  return TOOL_ICONS[slug] ?? Wrench;
}

export default function ToolIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = getToolIcon(slug);
  return <Icon className={className} aria-hidden="true" />;
}
