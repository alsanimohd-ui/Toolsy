import { Lock, Wallet, Zap } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import ToolsExplorer from "@/components/home/ToolsExplorer";

const POINTS = [
  { icon: Lock, title: "Private by design", text: "Most tools run in your browser. Your files and data stay on your device." },
  { icon: Zap, title: "Fast and focused", text: "No sign-up, no clutter. Open a tool and get the job done." },
  { icon: Wallet, title: "Free to use", text: "Built by an IT team for everyday work, and open to everyone." },
];

export default function HomePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />

      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(14,179,186,0.18),transparent)]"
          />
          <div className="relative mx-auto max-w-3xl px-4 pb-14 pt-16 text-center sm:px-6 sm:pt-24">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">Free IT tools</p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
              Everyday IT tools, <span className="text-accent">all in one place.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Certificates, ports, logs, regex, encoding and more. Pick a tool and start working.
            </p>
          </div>
        </section>

        <section id="tools" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <ToolsExplorer />
        </section>

        <section className="border-t border-border bg-surface/50">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex flex-col gap-2">
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="size-5" />
                </span>
                <h2 className="font-semibold text-foreground">{title}</h2>
                <p className="text-sm leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
