import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";
import { fetchAllPlaylists } from "@/lib/spotify";

export async function GET() {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const playlists = await fetchAllPlaylists(token);
    return NextResponse.json(
      playlists.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.images[0]?.url ?? null,
        trackCount: p.tracks.total,
      })),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch playlists" },
      { status: 500 },
    );
  }
}
