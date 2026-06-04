const SPOTIFY_API = "https://api.spotify.com/v1";

export async function spotifyFetch<T>(
  path: string,
  accessToken: string,
): Promise<T> {
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Spotify API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export interface SpotifyPlaylistItem {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
}

export interface SpotifyPlaylistsResponse {
  items: SpotifyPlaylistItem[];
  next: string | null;
}

export interface SpotifyPlaylistTrackItem {
  track: {
    id: string;
    name: string;
    preview_url: string | null;
    artists: { name: string }[];
  } | null;
}

export interface SpotifyPlaylistTracksResponse {
  items: SpotifyPlaylistTrackItem[];
  next: string | null;
}

export interface SpotifySearchTrack {
  id: string;
  name: string;
  preview_url: string | null;
  artists: { name: string }[];
}

export interface SpotifySearchResponse {
  tracks: { items: SpotifySearchTrack[] };
}

export async function fetchAllPlaylists(
  accessToken: string,
): Promise<SpotifyPlaylistItem[]> {
  const playlists: SpotifyPlaylistItem[] = [];
  let path: string | null = "/me/playlists?limit=50";

  while (path) {
    const page: SpotifyPlaylistsResponse = await spotifyFetch(
      path,
      accessToken,
    );
    playlists.push(...page.items);
    path = page.next ? page.next.replace(SPOTIFY_API, "") : null;
  }

  return playlists;
}

export async function fetchPlaylistTracks(
  playlistId: string,
  accessToken: string,
): Promise<NonNullable<SpotifyPlaylistTrackItem["track"]>[]> {
  const tracks: NonNullable<SpotifyPlaylistTrackItem["track"]>[] = [];
  let path: string | null =
    `/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,preview_url,artists(name)))`;

  while (path) {
    const page: SpotifyPlaylistTracksResponse = await spotifyFetch(
      path,
      accessToken,
    );
    for (const item of page.items) {
      if (item.track?.name && item.track.artists[0]?.name) {
        tracks.push(item.track);
      }
    }
    path = page.next ? page.next.replace(SPOTIFY_API, "") : null;
  }

  return tracks;
}

export async function searchKaraokePreview(
  songName: string,
  artistName: string,
  accessToken: string,
): Promise<string | null> {
  const query = encodeURIComponent(`${songName} ${artistName} karaoke`);
  const data = await spotifyFetch<SpotifySearchResponse>(
    `/search?q=${query}&type=track&limit=10`,
    accessToken,
  );

  const withPreview = data.tracks.items.find((t) => t.preview_url);
  return withPreview?.preview_url ?? null;
}
