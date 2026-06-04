import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";
import { searchKaraokePreview } from "@/lib/spotify";

export async function GET(req: Request) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const artist = searchParams.get("artist");

  if (!name || !artist) {
    return NextResponse.json(
      { error: "name and artist are required" },
      { status: 400 },
    );
  }

  try {
    const previewUrl = await searchKaraokePreview(name, artist, token);
    return NextResponse.json({ previewUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed" },
      { status: 500 },
    );
  }
}
