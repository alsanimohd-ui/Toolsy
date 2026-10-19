"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ToolContainer, ToolHeader, ToolSection, ToolInput, ToolButton } from "@/components/tools";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Network,
  ShieldOff,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { PORT_ENCYCLOPEDIA } from "@/lib/port-intelligence";
import {
  calibrateRefusedLatency,
  isLocalTarget,
  isLoopbackTarget,
  parseClientPorts,
  scanPortLocally,
  terminalCommand,
} from "@/lib/local-port-scanner";

type Status = "OPEN" | "CLOSED" | "TIMEOUT" | "UNREACHABLE" | "BLOCKED" | "ERROR";

interface ScanResult {
  host: string;
  port: number;
  protocol: "tcp" | "udp";
  status: Status;
  latency: number;
  message: string;
}

type Mode = "browser" | "server";

const MAX_PORTS = 100;

const PRESETS = [
  { port: 3000, label: "3000" },
  { port: 5173, label: "5173" },
  { port: 8080, label: "8080" },
  { port: 80, label: "HTTP 80" },
  { port: 443, label: "HTTPS 443" },
  { port: 22, label: "SSH 22" },
  { port: 3306, label: "MySQL 3306" },
  { port: 5432, label: "Postgres 5432" },
  { port: 6379, label: "Redis 6379" },
  { port: 27017, label: "Mongo 27017" },
  { port: 3389, label: "RDP 3389" },
];

const STATUS_STYLE: Record<Status, { label: string; icon: LucideIcon; className: string }> = {
  OPEN: { label: "Open", icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
  CLOSED: { label: "Closed", icon: XCircle, className: "text-red-600 dark:text-red-400" },
  TIMEOUT: { label: "No response", icon: Clock, className: "text-amber-600 dark:text-amber-400" },
  UNREACHABLE: { label: "Unreachable", icon: AlertTriangle, className: "text-red-600 dark:text-red-400" },
  BLOCKED: { label: "Browser-blocked", icon: ShieldOff, className: "text-amber-600 dark:text-amber-400" },
  ERROR: { label: "Error", icon: AlertTriangle, className: "text-red-600 dark:text-red-400" },
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-border bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o.id ? "bg-accent text-[#04181a]" : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function PortCheckerClient() {
  const [host, setHost] = useState("");
  const [portInput, setPortInput] = useState("");
  const [protocol, setProtocol] = useState<"tcp" | "udp">("tcp");
  const [timeoutMs, setTimeoutMs] = useState(3000);
  const [modeOverride, setModeOverride] = useState<Mode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ScanResult[]>([]);
  const [scanned, setScanned] = useState<{ host: string; protocol: "tcp" | "udp"; mode: Mode } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isHttps, setIsHttps] = useState(false);

  useEffect(() => setIsHttps(window.location.protocol === "https:"), []);

  const autoMode: Mode = isLocalTarget(host) ? "browser" : "server";
  const mode = modeOverride ?? autoMode;
  const ports = useMemo(() => parseClientPorts(portInput), [portInput]);
  const selected = useMemo(() => new Set(portInput.split(",").map((p) => p.trim())), [portInput]);

  const canScan = !isScanning && host.trim() !== "" && ports.length > 0;
  // An https page cannot reach http://<private-ip> (mixed content), so every port would look closed.
  const browserBlocked =
    mode === "browser" &&
    protocol === "tcp" &&
    isHttps &&
    !isLoopbackTarget(host);

  const handleScan = async () => {
    if (!canScan) return;
    setError(null);
    setResults([]);
    setExpanded(null);

    if (ports.length > MAX_PORTS) {
      setError(`Too many ports (${ports.length}). Check at most ${MAX_PORTS} at a time.`);
      return;
    }

    const target = host.trim();
    if (browserBlocked) {
      setError(
        `This page is served over HTTPS, so your browser blocks checks to ${target}. Run this in a terminal on your PC instead: ${terminalCommand(target, ports[0]).split("\n")[0].split("   #")[0]}`
      );
      return;
    }
    setIsScanning(true);
    setProgress({ done: 0, total: ports.length });
    setScanned({ host: target, protocol, mode });

    try {
      if (mode === "server") {
        const res = await fetch("/api/network/port-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host: target, port: portInput, protocol, timeout: timeoutMs }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(
            res.status === 403
              ? `${data.error} The server cannot see your local network. Switch to "My browser" to check it.`
              : data.error ?? "The check failed."
          );
        } else {
          setResults(data.results);
        }
      } else if (protocol === "udp") {
        setError("A browser cannot send UDP packets. Use the server for public hosts, or run nmap -sU locally.");
      } else {
        const baseline = await calibrateRefusedLatency(target);
        const queue = [...ports];
        let done = 0;
        const worker = async () => {
          for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
            const r = await scanPortLocally(target, p, timeoutMs, baseline);
            setResults((prev) => [...prev, r]);
            setProgress({ done: ++done, total: ports.length });
          }
        };
        await Promise.all(Array.from({ length: Math.min(6, ports.length) }, worker));
      }
    } catch {
      setError("The check failed. Check your connection and try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const togglePreset = (port: number) => {
    const list = portInput.split(",").map((p) => p.trim()).filter(Boolean);
    const key = String(port);
    setPortInput((list.includes(key) ? list.filter((p) => p !== key) : [...list, key]).join(", "));
  };

  const copyCommand = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const sorted = useMemo(() => [...results].sort((a, b) => a.port - b.port), [results]);
  const count = (s: Status) => results.filter((r) => r.status === s).length;

  return (
    <ToolContainer categoryId="network-security">
      <ToolHeader
        title="Port Checker"
        description="Check whether a TCP port is reachable: your own machine and local network from the browser, public hosts from our server."
        categoryId="network-security"
      />

      <ToolSection>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ToolInput
            label="Host or IP"
            placeholder="localhost, 192.168.1.10 or example.com"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            spellCheck={false}
            className="font-mono"
          />
          <ToolInput
            label="Ports"
            hint="comma or range"
            placeholder="3000, 5432, 8000-8010"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            spellCheck={false}
            className="font-mono"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.port}
              type="button"
              onClick={() => togglePreset(p.port)}
              aria-pressed={selected.has(String(p.port))}
              className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition-colors ${
                selected.has(String(p.port))
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="flex flex-col gap-2">
            <span className="toolsy-label">Check from</span>
            <Segmented
              label="Check from"
              value={mode}
              onChange={(m) => setModeOverride(m)}
              options={[
                { id: "browser", label: "My browser" },
                { id: "server", label: "Our server" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="toolsy-label">Protocol</span>
            <Segmented
              label="Protocol"
              value={protocol}
              onChange={setProtocol}
              options={[
                { id: "tcp", label: "TCP" },
                { id: "udp", label: "UDP" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="toolsy-label">Timeout</span>
            <select
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className="toolsy-input h-9 px-3 text-xs"
              aria-label="Timeout"
            >
              {[1000, 2000, 3000, 5000, 10000].map((t) => (
                <option key={t} value={t}>
                  {t / 1000}s
                </option>
              ))}
            </select>
          </div>
          <ToolButton
            onClick={handleScan}
            disabled={!canScan}
            loading={isScanning}
            iconLeft={<Network className="size-4" />}
            className="md:ml-auto"
          >
            {isScanning ? "Checking…" : "Check ports"}
          </ToolButton>
        </div>

        {browserBlocked && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Browsers block secure (HTTPS) pages from reaching other machines on your network, so this check would wrongly report every port as closed. Only localhost works here. For a company IP, use the terminal command: <span className="font-mono">Test-NetConnection {host.trim()} -Port {ports[0] ?? "&lt;port&gt;"}</span>
            </span>
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted">
          {mode === "browser"
            ? "Runs in your browser, so it can reach localhost and your local network. A browser cannot open raw TCP connections, so it detects services by how they react to an HTTP request. For an exact answer, use the command shown under each port."
            : "Runs on our server, so it only reaches public hosts. localhost and private addresses are blocked."}
        </p>
      </ToolSection>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {(isScanning || results.length > 0) && scanned && (
        <ToolSection>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold">
              <span className="text-emerald-600 dark:text-emerald-400">{count("OPEN")} open</span>
              <span className="text-red-600 dark:text-red-400">{count("CLOSED")} closed</span>
              <span className="text-amber-600 dark:text-amber-400">
                {count("TIMEOUT") + count("BLOCKED")} no answer / blocked
              </span>
            </div>
            <span className="font-mono text-xs text-muted">
              {scanned.host} · {scanned.protocol.toUpperCase()} · {isScanning ? `${progress.done}/${progress.total}` : `${results.length} checked`}
            </span>
          </div>

          {isScanning && (
            <div className="h-1 overflow-hidden rounded-full bg-border" aria-hidden>
              <div
                className="h-full bg-accent transition-[width] duration-150"
                style={{ width: scanned.mode === "browser" ? `${(progress.done / Math.max(progress.total, 1)) * 100}%` : "40%" }}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="w-8 py-2" />
                  <th className="py-2 pr-4 font-semibold">Port</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-4 font-semibold">Time</th>
                  <th className="py-2 font-semibold">Service</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const s = STATUS_STYLE[r.status];
                  const Icon = s.icon;
                  const intel = PORT_ENCYCLOPEDIA[r.port];
                  const open = expanded === r.port;
                  const cmd = terminalCommand(scanned.host, r.port);
                  return (
                    <Fragment key={r.port}>
                      <tr
                        onClick={() => setExpanded(open ? null : r.port)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpanded(open ? null : r.port);
                          }
                        }}
                        tabIndex={0}
                        aria-expanded={open}
                        className="cursor-pointer border-b border-border/60 hover:bg-surface focus-visible:bg-surface"
                      >
                        <td className="py-3 text-muted">
                          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </td>
                        <td className="py-3 pr-4 font-mono font-semibold">{r.port}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1.5 font-semibold ${s.className}`}>
                            <Icon className="size-4" />
                            {s.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-muted">{r.latency}ms</td>
                        <td className="py-3 text-muted">{intel ? intel.name : "—"}</td>
                      </tr>
                      {open && (
                        <tr className="border-b border-border/60 bg-surface">
                          <td />
                          <td colSpan={4} className="space-y-3 py-4 pr-4 text-sm">
                            <p>{r.message}</p>
                            {intel && (
                              <div className="space-y-2 text-muted">
                                <p>{intel.description}</p>
                                {intel.warning && (
                                  <p className="text-amber-700 dark:text-amber-300">{intel.warning}</p>
                                )}
                                {intel.hardening.length > 0 && (
                                  <ul className="list-disc space-y-1 pl-5">
                                    {intel.hardening.map((h) => (
                                      <li key={h}>{h}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                            {scanned.mode === "browser" && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="toolsy-label">Exact check in your terminal</span>
                                  <button
                                    type="button"
                                    onClick={() => copyCommand(cmd)}
                                    className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
                                  >
                                    <Copy className="size-3.5" />
                                    {copied ? "Copied" : "Copy"}
                                  </button>
                                </div>
                                <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs">{cmd}</pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ToolSection>
      )}
    </ToolContainer>
  );
}
