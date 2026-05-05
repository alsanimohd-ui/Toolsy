import { Suspense } from "react";
import type { Metadata } from "next";
import JsonFormatterClient from "./client-page";

export const metadata: Metadata = {
  title: "JSON Formatter Online & Prettifier - Toolsy",
  description: "Beautify, validate, minify, and clean compact JSON data online for free. Premium, secure, developer-centric toolset.",
  openGraph: {
    title: "JSON Formatter Online & Prettifier - Toolsy",
    description: "Beautify, validate, minify, and clean messy or unformatted JSON files instantly.",
  },
};

export default function JsonFormatterPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-[var(--muted)] font-mono text-xs">Loading JSON Formatter...</div>}>
      <JsonFormatterClient />
    </Suspense>
  );
}
