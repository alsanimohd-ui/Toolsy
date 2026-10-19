export interface LocalScanResult {
  host: string;
  port: number;
  protocol: "tcp" | "udp";
  status: "OPEN" | "CLOSED" | "TIMEOUT" | "BLOCKED" | "ERROR";
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

/** True for loopback and private-network targets, which only the browser can reach. */
export function isLocalTarget(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return false;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h === "::1") return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

// Ports browsers refuse to fetch (Chromium/Firefox "restricted ports" list).
const BROWSER_BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
  103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465,
  512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993,
  995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668,
  6669, 6679, 6697, 10080,
]);

export function isBrowserBlockedPort(port: number): boolean {
  return BROWSER_BLOCKED_PORTS.has(port);
}

/** Command a user can run in their own terminal for an exact TCP check. */
export function terminalCommand(host: string, port: number): string {
  return `Test-NetConnection ${host} -Port ${port}   # PowerShell\nnc -zv ${host} ${port}                 # macOS / Linux`;
}

const FALLBACK_REFUSED_MS = 35;
const CALIBRATION_PORT = 64873;

/**
 * Measures how long this machine takes to get "connection refused" from the host.
 * A failed fetch that is much slower than this means something accepted the
 * TCP connection but does not speak HTTP.
 */
export async function calibrateRefusedLatency(host: string): Promise<number> {
  const start = Date.now();
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 1500);
  try {
    await fetch(`http://${host}:${CALIBRATION_PORT}/`, {
      mode: "no-cors",
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    // expected: nothing listens on the calibration port
  } finally {
    clearTimeout(id);
  }
  return Date.now() - start;
}

/**
 * Probes a TCP port from the browser with fetch.
 * A browser cannot open raw sockets, so the result is a best-effort signal:
 * - HTTP answer            -> OPEN
 * - fails as fast as a refused connection -> CLOSED
 * - fails slower than that -> OPEN (accepts TCP, not HTTP)
 * - no answer in time      -> TIMEOUT
 */
export async function scanPortLocally(
  host: string,
  port: number,
  timeoutMs: number,
  refusedBaselineMs?: number
): Promise<LocalScanResult> {
  if (isBrowserBlockedPort(port)) {
    return {
      host,
      port,
      protocol: "tcp",
      status: "BLOCKED",
      latency: 0,
      message: "Browsers refuse to connect to this port. Use the terminal command instead.",
    };
  }

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
      message: `Answered an HTTP request in ${latency}ms`,
    };
  } catch (err: unknown) {
    clearTimeout(id);
    const latency = Date.now() - start;

    const error = err as Error;
    if (error.name === "AbortError" || error.message?.includes("aborted")) {
      return {
        host,
        port,
        protocol: "tcp",
        status: "TIMEOUT",
        latency: timeoutMs,
        message: `No answer within ${timeoutMs}ms (filtered, or a service holding the connection)`,
      };
    }

    const threshold =
      refusedBaselineMs === undefined ? FALLBACK_REFUSED_MS : Math.max(refusedBaselineMs * 2, refusedBaselineMs + 15);

    if (latency <= threshold) {
      return {
        host,
        port,
        protocol: "tcp",
        status: "CLOSED",
        latency,
        message: `Connection refused in ${latency}ms`,
      };
    }
    return {
      host,
      port,
      protocol: "tcp",
      status: "OPEN",
      latency,
      message: "Accepts TCP connections but does not answer HTTP (likely a database or other non-web service)",
    };
  }
}
