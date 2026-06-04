export type Difficulty = 2 | 5 | 10;

export type GameStep =
  | "home"
  | "difficulty"
  | "playlist"
  | "game"
  | "results";

export interface PlaylistSummary {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
}

export interface GameTrack {
  id: string;
  name: string;
  artist: string;
  previewUrl: string | null;
}

export const ROUNDS = 10;
