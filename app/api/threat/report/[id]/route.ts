import { NextRequest, NextResponse } from "next/server";

const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const ANALYSIS_ID_REGEX = /^[a-zA-Z0-9\-]{1,128}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  if (!ANALYSIS_ID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "Invalid analysis ID format." },
      { status: 400 }
    );
  }

  if (!VT_API_KEY) {
    return NextResponse.json(
      { error: "VirusTotal API key not configured on server." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://www.virustotal.com/api/v3/analyses/${id}`,
      {
        headers: {
          "x-apikey": VT_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error?.message || "VirusTotal Report Error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("VT Report Error:", error);
    return NextResponse.json(
      { error: "Internal server error during report fetch." },
      { status: 500 }
    );
  }
}
