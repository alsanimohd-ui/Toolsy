import { NextRequest, NextResponse } from "next/server";
import net from "net";
import dgram from "dgram";
import { validateTarget } from "@/lib/ssrf-utils";

async function validateHost(rawHost: string): Promise<{ blocked: boolean; reason?: string }> {
  const result = await validateTarget(rawHost);
  return { blocked: !result.allowed, reason: result.reason };
}

interface ScanResult {
  host: string;
  port: number;
  protocol: "tcp" | "udp";
  status: "OPEN" | "CLOSED" | "TIMEOUT" | "UNREACHABLE" | "ERROR";
  latency: number;
  message: string;
}

function parsePorts(input: string): number[] {
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

function scanTcpPort(host: string, port: number, timeout: number): Promise<ScanResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    const respond = (status: ScanResult["status"], message: string) => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ host, port, protocol: "tcp", status, latency, message });
    };

    socket.on("connect", () => {
      respond("OPEN", `Connection established on port ${port}`);
    });

    socket.on("timeout", () => {
      respond("TIMEOUT", `Connection timed out after ${timeout}ms`);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on("error", (err: any) => {
      if (err.code === "ECONNREFUSED") {
        respond("CLOSED", `Connection refused on port ${port}`);
      } else if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
        respond("UNREACHABLE", `Host not found or unreachable`);
      } else {
        respond("ERROR", `Error: ${err.message}`);
      }
    });

    socket.connect(port, host);
  });
}

function scanUdpPort(host: string, port: number, timeout: number): Promise<ScanResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    let responded = false;

    const finish = (status: ScanResult["status"], message: string) => {
      if (responded) return;
      responded = true;
      const latency = Date.now() - start;
      socket.close();
      resolve({ host, port, protocol: "udp", status, latency, message });
    };

    socket.on("message", () => {
      finish("OPEN", `UDP response received on port ${port}`);
    });

    socket.on("error", (err: unknown) => {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ECONNREFUSED" || nodeErr.code === "ECONNRESET") {
        finish("CLOSED", `ICMP port unreachable on port ${port}`);
      } else {
        finish("ERROR", `Error: ${nodeErr.message}`);
      }
    });

    // Send an empty UDP packet to probe
    const msg = Buffer.alloc(1, 0);
    socket.send(msg, 0, msg.length, port, host, (err) => {
      if (err) {
        finish("ERROR", `Send error: ${err.message}`);
      }
    });

    setTimeout(() => {
      finish("TIMEOUT", `No response after ${timeout}ms (open|filtered)`);
    }, timeout);
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { host, port, ports: portsInput, protocol = "tcp", timeout = 3000 } = body;

    if (!host) {
      return NextResponse.json({ error: "Host is required." }, { status: 400 });
    }

    // Resolve list of ports to scan
    let portList: number[];
    if (portsInput && Array.isArray(portsInput)) {
      portList = portsInput.filter((p: number) => p >= 1 && p <= 65535);
    } else if (port) {
      portList = parsePorts(String(port));
    } else {
      return NextResponse.json({ error: "Port or ports is required." }, { status: 400 });
    }

    if (portList.length === 0) {
      return NextResponse.json({ error: "No valid ports specified." }, { status: 400 });
    }

    if (portList.length > 100) {
      return NextResponse.json({ error: "Maximum 100 ports per request." }, { status: 400 });
    }

    const hostValidation = await validateHost(host);
    if (hostValidation.blocked) {
      return NextResponse.json({ error: hostValidation.reason }, { status: 403 });
    }

    const protocolType = protocol === "udp" ? "udp" : "tcp";

    if (protocolType === "udp") {
      // UDP: scan ports sequentially (Node dgram is single-socket per port for probe)
      const results: ScanResult[] = [];
      for (const p of portList) {
        const result = await scanUdpPort(host, p, timeout);
        results.push(result);
      }
      return NextResponse.json({ host, protocol: "udp", results });
    } else {
      // TCP: scan ports sequentially
      const results: ScanResult[] = [];
      for (const p of portList) {
        const result = await scanTcpPort(host, p, timeout);
        results.push(result);
      }
      return NextResponse.json({ host, protocol: "tcp", results });
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }
}
