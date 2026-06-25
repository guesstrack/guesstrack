import type { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

const scopes = [
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: requireEnv("SPOTIFY_CLIENT_ID"),
      clientSecret: requireEnv("SPOTIFY_CLIENT_SECRET"),
      authorization: {
        params: {
          scope: scopes,
        },
      },
      profile(profile) {
        return {
          id: profile.id,
          name: profile.display_name,
          email: profile.email,
          image: profile.images?.[0]?.url,
        };
      },
      userinfo: {
        url: "https://api.spotify.com/v1/me",
        async request({ tokens }) {
          const res = await fetch("https://api.spotify.com/v1/me", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(
              `Spotify profile request failed (${res.status}): ${body}`,
            );
          }

          return res.json();
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
  secret: requireEnv("NEXTAUTH_SECRET"),
  debug: process.env.NODE_ENV === "development",
};
