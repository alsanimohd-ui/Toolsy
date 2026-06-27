export interface LocalScanResult {
  host: string;
  port: number;
  protocol: "tcp" | "udp";
  status: "OPEN" | "CLOSED" | "TIMEOUT" | "ERROR";
  latency: number;
  message: string;
}

export function parseClientPorts(input: string): number[] {
  const ports = new Set<number>();
  const parts = input.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= 65535 && start <= end) {
        for (let p = start; p <= end; p++) ports.add(p);
      }
    } else {
      const p = parseInt(trimmed, 10);
      if (!isNaN(p) && p >= 1 && p <= 65535) ports.add(p);
    }
  }
  return Array.from(ports).sort((a, b) => a - b);
}

/**
 * Probes a TCP port locally using browser fetch & latency heuristics.
 */
export async function scanPortLocally(
  host: string,
  port: number,
  timeoutMs: number
): Promise<LocalScanResult> {
  const start = Date.now();
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const url = `http://${host}:${port}/robots.txt?t=${start}`;

  try {
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });

    clearTimeout(id);
    const latency = Date.now() - start;
    return {
      host,
      port,
      protocol: "tcp",
      status: "OPEN",
      latency,
      message: `Connection established (local prober resolved in ${latency}ms)`,
    };
  } catch (err: any) {
    clearTimeout(id);
    const latency = Date.now() - start;

    if (err.name === "AbortError" || err.message?.includes("aborted")) {
      return {
        host,
        port,
        protocol: "tcp",
        status: "TIMEOUT",
        latency: timeoutMs,
        message: `Port connection attempt timed out after ${timeoutMs}ms`,
      };
    }

    // Heuristic: connection refused (CLOSED) returns TypeError instantly (<35ms).
    // An open port that is CORS-blocked or protocol-restricted takes slightly longer.
    if (latency < 35) {
      return {
        host,
        port,
        protocol: "tcp",
        status: "CLOSED",
        latency,
        message: `Connection refused locally in ${latency}ms`,
      };
    } else {
      return {
        host,
        port,
        protocol: "tcp",
        status: "OPEN",
        latency,
        message: `Port responds to TCP connection (CORS/protocol restricted)`,
      };
    }
  }
}
