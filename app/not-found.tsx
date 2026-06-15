import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="toolsy-page-shell flex items-center justify-center">
      <div className="toolsy-content items-center text-center gap-8">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center justify-center size-16 rounded-2xl bg-accent/10 border border-accent/20">
            <FileQuestion className="size-8 text-accent" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              Page not found
            </h1>
            <p className="text-sm text-muted max-w-md">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white transition-all hover:-translate-y-0.5"
              style={{
                backgroundColor: "var(--accent)",
                boxShadow: "0 14px 35px var(--accent-glow)",
              }}
            >
              <Home className="size-4" />
              Home
            </Link>
            <Link
              href="/tools"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-foreground border border-border-subtle bg-[var(--surface)] hover:-translate-y-0.5 transition-all"
            >
              <ArrowLeft className="size-4" />
              Tools
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}