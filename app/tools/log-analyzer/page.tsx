import { Suspense } from "react";
import type { Metadata } from "next";
import LogAnalyzerClient from "./client-page";

export const metadata: Metadata = {
  title: "Server Log Analyzer Online - Toolsy",
  description: "Analyze, filter, and trace raw server logs instantly. Extract error traces and pinpoint bug sources.",
  openGraph: {
    title: "Server Log Analyzer Online - Toolsy",
    description: "Analyze, filter, and trace raw server logs instantly online.",
  },
};

export default function LogAnalyzerPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-[var(--muted)] font-mono text-xs">Loading Log Analyzer...</div>}>
      <LogAnalyzerClient />
    </Suspense>
  );
}
