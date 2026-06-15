"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import ToolButton from "@/components/tools/ToolButton";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="toolsy-page-shell flex items-center justify-center">
      <div className="toolsy-content items-center text-center gap-8">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center justify-center size-16 rounded-2xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="size-8 text-red-400" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              Something went wrong
            </h1>
            <p className="text-sm text-muted max-w-md">
              An unexpected error occurred. This has been logged automatically.
              You can try again or return to the home page.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ToolButton variant="primary" iconLeft={<RotateCcw className="size-4" />} onClick={reset}>
              Try Again
            </ToolButton>
            <Link
              href="/"
              className="toolsy-button toolsy-button-secondary"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
