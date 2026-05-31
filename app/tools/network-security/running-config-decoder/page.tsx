import { getCategory, findTool } from "@/lib/tools";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import RunningConfigDecoderClient from "./client-page";

export function generateMetadata(): Metadata {
  const category = getCategory("network-security");
  const tool = findTool("network-security", "running-config-decoder");

  if (!category || !tool) {
    return {
      title: "Tool Not Found | Mi",
    };
  }

  return {
    title: `${tool.name} | Mi`,
    description: tool.description,
  };
}

export default function RunningConfigDecoderPage() {
  const tool = findTool("network-security", "running-config-decoder");

  if (!tool) {
    notFound();
  }

  return <RunningConfigDecoderClient />;
}
