import { getCategory, findTool } from "@/lib/tools";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import PortCheckerClient from "./client-page";

export function generateMetadata(): Metadata {
  const category = getCategory("network-security");
  const tool = findTool("network-security", "port-checker");

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

export default function PortCheckerPage() {
  const tool = findTool("network-security", "port-checker");

  if (!tool) {
    notFound();
  }

  return <PortCheckerClient />;
}
