import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";
import { fetchPlaylistTracks } from "@/lib/spotify";
import { ROUNDS } from "@/types/game";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const tracks = await fetchPlaylistTracks(id, token);

    if (tracks.length < ROUNDS) {
      return NextResponse.json(
        {
          error: `Playlist needs at least ${ROUNDS} songs (found ${tracks.length})`,
        },
        { status: 400 },
      );
    }

    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, ROUNDS).map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artists[0].name,
      previewUrl: t.preview_url,
    }));

    return NextResponse.json(picked);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch tracks" },
      { status: 500 },
    );
  }
}
