import { NextRequest, NextResponse } from "next/server";

const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  const hash = params.hash;

  if (!VT_API_KEY) {
    return NextResponse.json(
      { found: false, configured: false, error: "VirusTotal API key not configured on server." },
      { status: 200 }
    );
  }

  try {
    const response = await fetch(
      `https://www.virustotal.com/api/v3/files/${hash}`,
      {
        headers: {
          "x-apikey": VT_API_KEY,
        },
      }
    );

    if (response.status === 404) {
      return NextResponse.json({ found: false });
    }

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error?.message || "VirusTotal API error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ found: true, data: data.data });
  } catch (error) {
    console.error("VT Hash Lookup Error:", error);
    return NextResponse.json(
      { error: "Internal server error during hash lookup." },
      { status: 500 }
    );
  }
}
