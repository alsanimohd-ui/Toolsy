import { NextRequest, NextResponse } from "next/server";

const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY;

export async function POST(request: NextRequest) {
  if (!VT_API_KEY) {
    return NextResponse.json(
      { error: "VirusTotal API key not configured on server." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Proxy the file to VirusTotal
    const vtFormData = new FormData();
    vtFormData.append("file", file);

    const response = await fetch("https://www.virustotal.com/api/v3/files", {
      method: "POST",
      headers: {
        "x-apikey": VT_API_KEY,
      },
      body: vtFormData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error?.message || "VirusTotal Upload Error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Returns analysis ID
    return NextResponse.json(data);
  } catch (error) {
    console.error("VT Upload Error:", error);
    return NextResponse.json(
      { error: "Internal server error during file upload." },
      { status: 500 }
    );
  }
}
