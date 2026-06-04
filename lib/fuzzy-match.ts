import Fuse from "fuse.js";

export function checkAnswer(
  guess: string,
  songName: string,
  artistName: string,
): boolean {
  const normalized = guess.trim().toLowerCase();
  if (!normalized) return false;

  const song = songName.toLowerCase();
  const artist = artistName.toLowerCase();

  if (
    song.includes(normalized) ||
    normalized.includes(song) ||
    artist.includes(normalized) ||
    normalized.includes(artist)
  ) {
    return true;
  }

  const candidates = [songName, artistName, `${songName} ${artistName}`];
  const fuse = new Fuse(candidates, {
    threshold: 0.4,
    ignoreLocation: true,
  });

  return fuse.search(normalized).length > 0;
}
