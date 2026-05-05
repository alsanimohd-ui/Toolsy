"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  ToolContainer,
  ToolHeader,
  ToolSection,
  ToolButton,
  ToolTextarea,
} from "@/components/tools";

const sampleJson = `{"id":1001,"user":{"name":"Sarah Lin","active":true,"tags":["admin","engineer"]},"meta":{"login_at":"2026-05-03 23:12:00"}}`;

export default function JsonFormatterClient() {
  const [input, setInput] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const searchParams = useSearchParams();

  useEffect(() => {
    const prefill = searchParams.get("input");
    if (prefill) {
      setInput(prefill);
      try {
        const parsed = JSON.parse(prefill);
        setOutput(JSON.stringify(parsed, null, 2));
      } catch {
        // Suppress on initial load
      }
    } else {
      try {
        const stored = localStorage.getItem("toolsy_json_formatter_input");
        if (stored) {
          setInput(stored);
        }
      } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    if (input) {
      try {
        localStorage.setItem("toolsy_json_formatter_input", input);
      } catch {}
    }
  }, [input]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleFormat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [input]);

  const handleFormat = () => {
    try {
      setError("");
      if (!input.trim()) {
        setStatus("Input is empty.");
        setTimeout(() => setStatus(""), 2000);
        return;
      }
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
      setStatus("Prettified successfully!");
      setTimeout(() => setStatus(""), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? `Syntax Error: ${e.message}` : "Invalid JSON syntax.");
    }
  };

  const handleMinify = () => {
    try {
      setError("");
      if (!input.trim()) return;
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setStatus("Minified successfully!");
      setTimeout(() => setStatus(""), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? `Syntax Error: ${e.message}` : "Invalid JSON syntax.");
    }
  };

  const loadSample = () => {
    setInput(sampleJson);
    setError("");
    setOutput("");
    setStatus("Sample loaded.");
    setTimeout(() => setStatus(""), 2000);
  };

  const handleClear = () => {
    setInput("");
    setOutput("");
    setError("");
    setStatus("Cleared.");
    setTimeout(() => setStatus(""), 2000);
    try {
      localStorage.removeItem("toolsy_json_formatter_input");
    } catch {}
  };

  const handleCopy = () => {
    if (!output) return;
    try {
      navigator.clipboard.writeText(output);
      setStatus("Copied to clipboard!");
      setTimeout(() => setStatus(""), 2500);
    } catch {
      setError("Failed to copy results.");
    }
  };

  return (
    <ToolContainer>
      <ToolHeader
        title="JSON Formatter"
        description="Format, prettify, minify, and validate messy or compact JSON data."
        badge="Data"
      />

      <div className="flex flex-col gap-6 animate-fadeIn">
        <ToolSection
          title="JSON Input Data"
          description="Paste raw JSON here, then press Ctrl+Enter to format."
        >
          <ToolTextarea
            label="Input"
            placeholder='e.g. {"key": "value"} or click Load Sample'
            showCount
            value={input}
            onChange={(e) => setInput(e.target.value)}
            error={error}
            className="min-h-[160px] font-mono"
          />

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <ToolButton variant="primary" onClick={handleFormat} disabled={!input}>
                Format (Prettify)
              </ToolButton>
              <ToolButton variant="secondary" onClick={handleMinify} disabled={!input}>
                Minify JSON
              </ToolButton>
              <ToolButton variant="ghost" onClick={loadSample}>
                Load Sample
              </ToolButton>
              <ToolButton variant="ghost" onClick={handleClear} disabled={!input && !output}>
                Clear
              </ToolButton>
            </div>

            {status && (
              <span className="text-xs font-semibold text-[var(--accent-hover)] bg-[var(--accent-glow)]/10 px-3 py-1.5 rounded-lg animate-pulse">
                {status}
              </span>
            )}
          </div>
        </ToolSection>

        {output ? (
          <ToolSection title="Transformed Result" className="animate-fadeIn">
            <div className="flex flex-col gap-3">
              <ToolTextarea
                label="Output"
                readOnly
                showCount
                value={output}
                className="min-h-[220px] font-mono"
              />
              <div className="flex self-end">
                <ToolButton variant="secondary" onClick={handleCopy}>
                  Copy Result
                </ToolButton>
              </div>
            </div>
          </ToolSection>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-[var(--border-subtle)] rounded-xl text-center text-[var(--muted)] animate-fadeIn">
            <span className="text-3xl mb-1 select-none">⌨️</span>
            <p className="text-sm">Ready for input. Paste your JSON data or use the Sample data.</p>
            <p className="text-xs mt-1 text-[var(--muted)]/70">Press Ctrl+Enter to format instantly.</p>
          </div>
        )}

        {/* Structured SEO educational content section */}
        <section className="mt-8 border-t border-[var(--border)] pt-8 flex flex-col gap-6 select-text">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold text-[var(--foreground)]">What is a JSON Formatter?</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              A JSON formatter converts messy or compact JavaScript Object Notation data into a readable format.
              It parses strings, removes unnecessary whitespace, and formats elements using proper indentation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-[var(--foreground)] tracking-wide uppercase">How to Use This Tool</h3>
              <ol className="text-sm text-[var(--muted)] leading-relaxed list-decimal list-inside flex flex-col gap-1.5">
                <li>Paste your compact or unformatted JSON into the source field.</li>
                <li>Press <strong>Ctrl+Enter</strong> or click the <strong>Format JSON</strong> button.</li>
                <li>Instantly copy the prettified JSON via the copy button.</li>
              </ol>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-[var(--foreground)] tracking-wide uppercase">Benefits & Use Cases</h3>
              <ul className="text-sm text-[var(--muted)] leading-relaxed list-disc list-inside flex flex-col gap-1.5">
                <li>Enhance readability when analyzing server or database API responses.</li>
                <li>Quickly minify files to save bandwidth and maximize network payload efficiency.</li>
                <li>Identify Syntax Errors instantly with structural highlights.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </ToolContainer>
  );
}
