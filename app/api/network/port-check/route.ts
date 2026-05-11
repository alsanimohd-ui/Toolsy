import { NextRequest, NextResponse } from "next/server";
import net from "net";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { host, port, timeout = 3000 } = body;

    if (!host || !port) {
      return NextResponse.json(
        { error: "Host and port are required." },
        { status: 400 }
      );
    }

    const portNumber = parseInt(port, 10);
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
      return NextResponse.json(
        { error: "Invalid port number." },
        { status: 400 }
      );
    }

    const start = Date.now();
    
    return new Promise<NextResponse>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      const respond = (status: string, message: string) => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve(
          NextResponse.json({
            host,
            port: portNumber,
            status,
            latency,
            message,
          })
        );
      };

      socket.on("connect", () => {
        respond("OPEN", `Connection established on port ${portNumber}`);
      });

      socket.on("timeout", () => {
        respond("TIMEOUT", `Connection timed out after ${timeout}ms`);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on("error", (err: any) => {
        if (err.code === "ECONNREFUSED") {
          respond("CLOSED", `Connection refused on port ${portNumber}`);
        } else if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
          respond("UNREACHABLE", `Host not found or unreachable`);
        } else {
          respond("ERROR", `Error: ${err.message}`);
        }
      });

      socket.connect(portNumber, host);
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }
}
