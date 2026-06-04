"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { checkAnswer } from "@/lib/fuzzy-match";
import type {
  Difficulty,
  GameStep,
  GameTrack,
  PlaylistSummary,
} from "@/types/game";
import { ROUNDS } from "@/types/game";

function shuffleWithPreview(tracks: GameTrack[]): GameTrack[] {
  const withPreview = tracks.filter((t) => t.previewUrl);
  const withoutPreview = tracks.filter((t) => !t.previewUrl);
  const pool = [...withPreview, ...withoutPreview];
  return pool.sort(() => Math.random() - 0.5).slice(0, ROUNDS);
}

export function GuessTrackApp() {
  const { data: session, status } = useSession();
  const [step, setStep] = useState<GameStep>("home");
  const [difficulty, setDifficulty] = useState<Difficulty>(5);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<GameTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [guess, setGuess] = useState("");
  const [roundLoading, setRoundLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTrack = tracks[roundIndex];
  const percentage = Math.round((score / ROUNDS) * 100);

  const stopAudio = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const loadPlaylists = useCallback(async () => {
    setPlaylistsLoading(true);
    setPlaylistsError(null);
    try {
      const res = await fetch("/api/playlists");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load playlists");
      setPlaylists(data);
    } catch (e) {
      setPlaylistsError(e instanceof Error ? e.message : "Failed to load playlists");
    } finally {
      setPlaylistsLoading(false);
    }
  }, []);

  const startGame = async (playlistId: string) => {
    setTracksLoading(true);
    setGameError(null);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load tracks");
      const gameTracks = shuffleWithPreview(data as GameTrack[]);
      setTracks(gameTracks);
      setRoundIndex(0);
      setScore(0);
      setGuess("");
      setFeedback(null);
      setHasPlayed(false);
      setStep("game");
    } catch (e) {
      setGameError(e instanceof Error ? e.message : "Failed to start game");
    } finally {
      setTracksLoading(false);
    }
  };

  const playRound = async () => {
    if (!currentTrack || isPlaying) return;

    setRoundLoading(true);
    setGameError(null);
    setFeedback(null);
    stopAudio();

    try {
      const params = new URLSearchParams({
        name: currentTrack.name,
        artist: currentTrack.artist,
      });
      const res = await fetch(`/api/search/karaoke?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");

      const previewUrl =
        (data.previewUrl as string | null) ?? currentTrack.previewUrl;

      if (!previewUrl) {
        setGameError("No preview available for this song. Skip to continue.");
        return;
      }

      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      await audio.play();
      setIsPlaying(true);
      setHasPlayed(true);

      stopTimerRef.current = setTimeout(() => {
        audio.pause();
        setIsPlaying(false);
      }, difficulty * 1000);
    } catch (e) {
      setGameError(e instanceof Error ? e.message : "Could not play preview");
    } finally {
      setRoundLoading(false);
    }
  };

  const submitGuess = () => {
    if (!currentTrack) return;

    const correct = checkAnswer(guess, currentTrack.name, currentTrack.artist);
    if (correct) {
      setScore((s) => s + 1);
      setFeedback(`Correct! It was "${currentTrack.name}" by ${currentTrack.artist}`);
    } else {
      setFeedback(
        `Wrong. It was "${currentTrack.name}" by ${currentTrack.artist}`,
      );
    }
  };

  const nextRound = () => {
    stopAudio();
    setGuess("");
    setFeedback(null);
    setHasPlayed(false);
    setGameError(null);

    if (roundIndex + 1 >= ROUNDS) {
      setStep("results");
      return;
    }
    setRoundIndex((i) => i + 1);
  };

  const skipRound = () => {
    stopAudio();
    setGuess("");
    setFeedback(null);
    setHasPlayed(false);
    setGameError(null);

    if (roundIndex + 1 >= ROUNDS) {
      setStep("results");
      return;
    }
    setRoundIndex((i) => i + 1);
  };

  const shareText = `My music score is ${score}/${ROUNDS} (${percentage}%). Can you beat me? GuessTrack.com`;

  const handleShare = async () => {
    setShareStatus(null);
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
        setShareStatus("Shared!");
      } else {
        await navigator.clipboard.writeText(shareText);
        setShareStatus("Copied to clipboard!");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(shareText);
        setShareStatus("Copied to clipboard!");
      } catch {
        setShareStatus("Could not share. Copy the text manually.");
      }
    }
  };

  const resetGame = () => {
    stopAudio();
    setStep("difficulty");
    setTracks([]);
    setRoundIndex(0);
    setScore(0);
    setGuess("");
    setFeedback(null);
    setGameError(null);
  };

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">
        {step === "home" && (
          <div className="flex flex-col items-center gap-8 text-center">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white">
                GuessTrack
              </h1>
              <p className="mt-3 text-lg text-zinc-400">
                Guess songs from your Spotify playlists
              </p>
            </div>

            {session ? (
              <button
                type="button"
                onClick={() => setStep("difficulty")}
                className="rounded-full bg-[#1DB954] px-8 py-3 text-lg font-semibold text-black transition hover:bg-[#1ed760]"
              >
                Start Game
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signIn("spotify")}
                className="rounded-full bg-[#1DB954] px-8 py-3 text-lg font-semibold text-black transition hover:bg-[#1ed760]"
              >
                Connect Spotify
              </button>
            )}
          </div>
        )}

        {step === "difficulty" && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Choose difficulty</h2>
              <p className="mt-2 text-zinc-400">How long should each clip play?</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([2, 5, 10] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setDifficulty(sec);
                    setStep("playlist");
                    loadPlaylists();
                  }}
                  className={`rounded-xl border py-4 text-lg font-semibold transition ${
                    difficulty === sec
                      ? "border-[#1DB954] bg-[#1DB954]/10 text-[#1DB954]"
                      : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Sign out
            </button>
          </div>
        )}

        {step === "playlist" && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Choose a playlist</h2>
              <p className="mt-2 text-zinc-400">
                {difficulty}s clips · {ROUNDS} rounds
              </p>
            </div>

            {playlistsLoading && (
              <p className="text-center text-zinc-400">Loading playlists...</p>
            )}
            {playlistsError && (
              <p className="text-center text-red-400">{playlistsError}</p>
            )}
            {gameError && (
              <p className="text-center text-red-400">{gameError}</p>
            )}
            {tracksLoading && (
              <p className="text-center text-zinc-400">Preparing game...</p>
            )}

            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  disabled={tracksLoading}
                  onClick={() => startGame(pl.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-left transition hover:border-zinc-600 disabled:opacity-50"
                >
                  {pl.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pl.imageUrl}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-800 text-xl">
                      ♪
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{pl.name}</p>
                    <p className="text-sm text-zinc-500">{pl.trackCount} tracks</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep("difficulty")}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Back
            </button>
          </div>
        )}

        {step === "game" && currentTrack && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between text-sm text-zinc-500">
              <span>
                Round {roundIndex + 1} / {ROUNDS}
              </span>
              <span>Score: {score}</span>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-full text-4xl transition ${
                  isPlaying
                    ? "animate-pulse bg-[#1DB954]/20 text-[#1DB954]"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {isPlaying ? "▶" : "♪"}
              </div>

              <button
                type="button"
                onClick={playRound}
                disabled={roundLoading || isPlaying}
                className="rounded-full bg-[#1DB954] px-6 py-2 font-semibold text-black transition hover:bg-[#1ed760] disabled:opacity-50"
              >
                {roundLoading
                  ? "Loading..."
                  : isPlaying
                    ? "Playing..."
                    : hasPlayed
                      ? "Play again"
                      : "Play clip"}
              </button>

              {gameError && (
                <p className="text-center text-sm text-amber-400">{gameError}</p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <label htmlFor="guess" className="text-sm text-zinc-400">
                Type artist or song name
              </label>
              <input
                id="guess"
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && feedback) nextRound();
                  else if (e.key === "Enter" && guess.trim()) submitGuess();
                }}
                disabled={!!feedback}
                placeholder="Your guess..."
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-[#1DB954] focus:outline-none disabled:opacity-50"
              />

              {!feedback ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitGuess}
                    disabled={!guess.trim() || !hasPlayed}
                    className="flex-1 rounded-xl bg-[#1DB954] py-3 font-semibold text-black transition hover:bg-[#1ed760] disabled:opacity-50"
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={skipRound}
                    className="rounded-xl border border-zinc-700 px-4 py-3 text-zinc-400 transition hover:border-zinc-500"
                  >
                    Skip
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p
                    className={`text-center text-sm ${feedback.startsWith("Correct") ? "text-[#1DB954]" : "text-red-400"}`}
                  >
                    {feedback}
                  </p>
                  <button
                    type="button"
                    onClick={nextRound}
                    className="rounded-xl bg-[#1DB954] py-3 font-semibold text-black transition hover:bg-[#1ed760]"
                  >
                    {roundIndex + 1 >= ROUNDS ? "See results" : "Next round"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "results" && (
          <div className="flex flex-col items-center gap-8 text-center">
            <div>
              <h2 className="text-3xl font-bold text-white">Game over!</h2>
              <p className="mt-6 text-6xl font-bold text-[#1DB954]">
                {score}/{ROUNDS}
              </p>
              <p className="mt-2 text-2xl text-zinc-400">{percentage}%</p>
            </div>

            <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
              <p className="text-lg leading-relaxed text-zinc-300">{shareText}</p>
              <button
                type="button"
                onClick={handleShare}
                className="mt-4 w-full rounded-full bg-[#1DB954] py-3 font-semibold text-black transition hover:bg-[#1ed760]"
              >
                Share
              </button>
              {shareStatus && (
                <p className="mt-2 text-sm text-zinc-500">{shareStatus}</p>
              )}
            </div>

            <button
              type="button"
              onClick={resetGame}
              className="text-[#1DB954] hover:underline"
            >
              Play again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
