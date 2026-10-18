import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MiIcon } from "@/components/ui/MiLogo";
import ThemeToggle from "@/components/home/ThemeToggle";

export const MAKER_AI_URL = "https://maker-ai.tech";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Mi home">
          <MiIcon className="size-8" />
          <span className="text-xl font-bold tracking-tight text-foreground">Mi</span>
          <span className="hidden border-l border-border pl-3 text-sm text-muted sm:inline">by Maker AI</span>
        </Link>

        <nav className="flex items-center gap-2" aria-label="Primary">
          <a
            href={MAKER_AI_URL}
            className="hidden items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground sm:flex"
          >
            Maker AI
            <ArrowUpRight className="size-3.5" />
          </a>
          <ThemeToggle />
          <Link
            href="/tools"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04181a] transition-colors hover:bg-accent-hover"
          >
            Open tools
          </Link>
        </nav>
      </div>
    </header>
  );
}
