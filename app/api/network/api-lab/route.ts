import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url, method, headers, body } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const start = performance.now();

    const fetchOptions: RequestInit = {
      method: method || 'GET',
      headers: headers || {},
      cache: 'no-store',
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method?.toUpperCase())) {
      fetchOptions.body = body;
    }

    let response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (fetchError: unknown) {
      const err = fetchError as Error;
      return NextResponse.json({ 
        error: err.message || 'Network request failed',
        timing: performance.now() - start
      }, { status: 502 });
    }

    const end = performance.now();
    
    // Read body as text first to calculate size
    const textBody = await response.text();
    const size = new Blob([textBody]).size;

    // Try to parse JSON if it looks like JSON
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
      size: size
    });

  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
