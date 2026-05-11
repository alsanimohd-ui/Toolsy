import { getCategory, findTool } from "@/lib/tools";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import PcapAnalyzerClient from "./client-page";

export function generateMetadata(): Metadata {
  const category = getCategory("network-security");
  const tool = findTool("network-security", "pcap-analyzer");

  if (!category || !tool) {
    return {
      title: "Tool Not Found | Toolsy",
    };
  }

  return {
    title: `${tool.name} | Toolsy`,
    description: tool.description,
  };
}

export default function PcapAnalyzerPage() {
  const tool = findTool("network-security", "pcap-analyzer");

  if (!tool) {
    notFound();
  }

  return <PcapAnalyzerClient />;
}
