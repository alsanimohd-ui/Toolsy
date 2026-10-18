import { ArrowUpRight } from "lucide-react";
import { MiIcon } from "@/components/ui/MiLogo";

const MAKER_AI_URL = "https://maker-ai.tech";

export default function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`border-t border-border ${className}`}>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <MiIcon className="size-4" />
          <span>
            A{" "}
            <a
              href={MAKER_AI_URL}
              className="inline-flex items-center gap-0.5 font-semibold text-foreground transition-colors hover:text-accent"
            >
              Maker AI
              <ArrowUpRight className="size-3.5" />
            </a>{" "}
            platform
          </span>
        </div>
        <span>© {new Date().getFullYear()} Maker AI. Free to use.</span>
      </div>
    </footer>
  );
}
