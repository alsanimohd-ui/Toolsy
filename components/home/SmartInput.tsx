"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

interface SmartInputProps {
  onTypeDetected?: (type: string | null) => void;
}

export default function SmartInput({ onTypeDetected }: SmartInputProps) {
  const [value, setValue] = useState("");
  const [suggestion, setSuggestion] = useState<{ name: string; route: string; isExternal?: boolean; type: string } | null>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setSuggestion(null);
      onTypeDetected?.(null);
      return;
    }

    // JSON detection
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      setSuggestion({ name: "JSON Lego", route: "https://jsonlego.app", isExternal: true, type: "data" });
      onTypeDetected?.("data");
      return;
    }

    // PEM/Cert detection
    if (trimmed.includes("-----BEGIN CERTIFICATE-----") || trimmed.includes("-----BEGIN PRIVATE KEY-----")) {
      setSuggestion({ name: "SSL Toolkit", route: "/tools/ssl-toolkit", type: "security" });
      onTypeDetected?.("security");
      return;
    }

    // Log detection
    if (trimmed.match(/(info|warn|error|debug|fatal|trace)/i)) {
      setSuggestion({ name: "Log Analyzer", route: "/tools/log-analyzer", type: "logs" });
      onTypeDetected?.("logs");
      return;
    }

    // CSV detection
    if (trimmed.includes(",") && trimmed.split("\n").length > 1) {
      setSuggestion({ name: "CSV Tool", route: "/tools/csv-tool", type: "data" });
      onTypeDetected?.("data");
      return;
    }

    setSuggestion(null);
    onTypeDetected?.(null);
  }, [value, onTypeDetected]);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 px-6 relative z-30">
      <div className="relative group">
        {/* Glow Background - Reduced for clarity */}
        <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 via-purple-500/20 to-accent/20 rounded-2xl blur-xl opacity-5 group-focus-within:opacity-10 transition duration-1000"></div>
        
        <div className="relative flex items-center bg-surface-overlay backdrop-blur-2xl border border-border-subtle rounded-2xl px-6 py-4" style={{ boxShadow: "var(--card-shadow)" }}>
          <Search className="w-5 h-5 text-muted mr-3" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste anything... JSON, logs, SSL, CSV..."
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted text-sm font-medium"
          />
          <div className="flex items-center gap-2 text-[11px] font-bold text-muted bg-surface px-2 py-1 rounded-md border border-border-subtle">
            <Sparkles className="w-3 h-3" />
            SMART ENGINE
          </div>
        </div>
      </div>

      <AnimatePresence>
        {suggestion && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between p-4 rounded-xl bg-surface-overlay border border-border-subtle backdrop-blur-md"
          >
            <div className="flex items-center gap-3">
<div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30">
              <Sparkles className="w-4 h-4 text-accent" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-muted font-bold uppercase tracking-widest">Matched System</span>
                <span className="text-sm font-bold text-foreground">Detected: {suggestion.name}</span>
              </div>
            </div>
            <Link
              href={suggestion.route}
              target={suggestion.isExternal ? "_blank" : undefined}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent-glow"
            >
              Open Tool
              <ArrowRight className="w-3 h-3" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
