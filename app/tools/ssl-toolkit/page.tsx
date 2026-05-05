import { Suspense } from "react";
import type { Metadata } from "next";
import SSLToolkitClient from "./client-page";

export const metadata: Metadata = {
  title: "SSL Toolkit Online - Extract PFX, Generate Certs - Toolsy",
  description: "Secure, fully offline, in-browser SSL Toolkit. Extract PFX certificates, build PFX from CRT/KEY, and inspect PEM files without uploading to a server.",
  openGraph: {
    title: "SSL Toolkit Online - Secure & Offline - Toolsy",
    description: "Extract PFX, build certificates, and parse PEM data directly in your browser. No server uploads. 100% secure.",
  },
};

export default function SSLToolkitPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-[var(--muted)] font-mono text-xs">Loading SSL Toolkit...</div>}>
      <SSLToolkitClient />
    </Suspense>
  );
}
