import { NextResponse } from "next/server";
import { promises as dns } from "dns";
import { isPrivateIP, isPrivateHostname, isIPv4Literal } from "@/lib/ssrf-utils";

async function validateUrl(targetUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return "Invalid URL format";
  }

  const { protocol, hostname } = parsed;

  if (protocol !== "http:" && protocol !== "https:") {
    return `Protocol "${protocol}" is not allowed. Only HTTP/HTTPS are permitted.`;
  }

  const host = hostname.toLowerCase();

  if (isPrivateHostname(host)) {
    return "Requests to local/loopback addresses are not allowed";
  }

  if (isIPv4Literal(host) && isPrivateIP(host)) {
    return "Requests to private IP ranges are not allowed";
  }

  try {
    const addresses = await dns.resolve4(host);
    for (const addr of addresses) {
      if (isPrivateIP(addr)) {
        return `Target resolves to a private IP (${addr})`;
      }
    }
  } catch {
    // DNS resolution failed — the request will fail downstream
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const { url, method, headers, body } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const ssrfError = await validateUrl(url);
    if (ssrfError) {
      return NextResponse.json({ error: ssrfError }, { status: 403 });
    }

    const start = performance.now();

    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: headers || {},
      cache: "no-store",
    };

    if (body && ["POST", "PUT", "PATCH"].includes(method?.toUpperCase())) {
      fetchOptions.body = body;
    }

    let response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (fetchError: unknown) {
      const err = fetchError as Error;
      return NextResponse.json(
        {
          error: err.message || "Network request failed",
          timing: performance.now() - start,
        },
        { status: 502 }
      );
    }

    const end = performance.now();

    const textBody = await response.text();
    const size = new Blob([textBody]).size;

    let parsedBody = null;
    try {
      parsedBody = JSON.parse(textBody);
    } catch {
      // Not JSON
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: parsedBody || textBody,
      rawBody: textBody,
      timing: Math.round(end - start),
      size,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
