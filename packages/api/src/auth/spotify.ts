import { Buffer } from "node:buffer";

import type { AppConfig } from "../config.js";
import { decryptString, encryptString } from "./encryption.js";
import type {
  SpotifyAlbumDetail,
  SpotifyArtistAlbumsResponse,
  SpotifyArtistDetail,
  SpotifyRecentlyPlayedResponse,
  SpotifyTracksResponse,
  SpotifyTrackDetail,
  SpotifyTokenResponse,
  SpotifyUserProfile,
} from "../types/spotify.js";

export interface SpotifyClient {
  buildAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<SpotifyTokenResponse>;
  refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse>;
  fetchProfile(accessToken: string): Promise<SpotifyUserProfile>;
  fetchRecentlyPlayed(accessToken: string, after?: number): Promise<SpotifyRecentlyPlayedResponse>;
  fetchArtist(accessToken: string, artistId: string): Promise<SpotifyArtistDetail>;
  fetchArtistAlbums(
    accessToken: string,
    artistId: string,
    options?: { includeGroups?: string[] },
  ): Promise<SpotifyArtistAlbumsResponse>;
  fetchAlbum(accessToken: string, albumId: string): Promise<SpotifyAlbumDetail>;
  fetchTrack(accessToken: string, trackId: string): Promise<SpotifyTrackDetail>;
  fetchTracks(accessToken: string, trackIds: string[]): Promise<SpotifyTrackDetail[]>;
  encrypt(value: string): string;
  decrypt(value: string): string;
}

export function createSpotifyClient(config: AppConfig): SpotifyClient {
  const basicAuth = Buffer.from(
    `${config.spotifyClientId}:${config.spotifyClientSecret}`,
    "utf8",
  ).toString("base64");

  async function requestToken(body: URLSearchParams) {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Spotify token request failed with ${response.status}`);
    }

    return (await response.json()) as SpotifyTokenResponse;
  }

  async function spotifyGetUrl<T>(accessToken: string, url: URL) {
    return spotifyFetchJson<T>(accessToken, url, `Spotify API request failed with`);
  }

  async function spotifyFetchJson<T>(accessToken: string, url: URL, errorPrefix: string) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After");
      const error = new Error(`${errorPrefix} ${response.status}${url.pathname ? ` for ${url.pathname}` : ""}`);
      (error as Error & { retryAfter?: string; status?: number }).retryAfter = retryAfter ?? undefined;
      (error as Error & { retryAfter?: string; status?: number }).status = response.status;
      throw error;
    }

    return (await response.json()) as T;
  }

  async function spotifyGet<T>(accessToken: string, path: string, search?: URLSearchParams) {
    const url = new URL(`https://api.spotify.com/v1${path}`);
    if (search) {
      url.search = search.toString();
    }

    return spotifyGetUrl<T>(accessToken, url);
  }

  return {
    buildAuthUrl(state) {
      const url = new URL("https://accounts.spotify.com/authorize");
      url.searchParams.set("client_id", config.spotifyClientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", config.spotifyRedirectUri);
      url.searchParams.set("scope", "user-read-recently-played user-read-email");
      url.searchParams.set("state", state);
      return url.toString();
    },
    async exchangeCode(code) {
      const body = new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: config.spotifyRedirectUri,
      });
      return requestToken(body);
    },
    async refreshAccessToken(refreshToken) {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
      return requestToken(body);
    },
    async fetchProfile(accessToken) {
      const response = await fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Spotify profile request failed with ${response.status}`);
      }

      return (await response.json()) as SpotifyUserProfile;
    },
    async fetchRecentlyPlayed(accessToken, after) {
      const url = new URL("https://api.spotify.com/v1/me/player/recently-played");
      url.searchParams.set("limit", "50");
      if (after) {
        url.searchParams.set("after", String(after));
      }

      return spotifyFetchJson<SpotifyRecentlyPlayedResponse>(
        accessToken,
        url,
        "Spotify recently-played request failed with",
      );
    },
    async fetchArtist(accessToken, artistId) {
      return spotifyGet<SpotifyArtistDetail>(accessToken, `/artists/${artistId}`);
    },
    async fetchArtistAlbums(accessToken, artistId, options) {
      const items: SpotifyArtistAlbumsResponse["items"] = [];
      let nextUrl: URL | null = new URL(`https://api.spotify.com/v1/artists/${artistId}/albums`);
      nextUrl.searchParams.set("limit", "50");
      if (options?.includeGroups?.length) {
        nextUrl.searchParams.set("include_groups", options.includeGroups.join(","));
      }

      while (nextUrl) {
        const page: SpotifyArtistAlbumsResponse = await spotifyGetUrl<SpotifyArtistAlbumsResponse>(accessToken, nextUrl);
        items.push(...page.items);
        nextUrl = page.next ? new URL(page.next) : null;
      }

      return {
        items,
        next: null,
      };
    },
    async fetchAlbum(accessToken, albumId) {
      const album = await spotifyGet<SpotifyAlbumDetail>(accessToken, `/albums/${albumId}`);
      const items = [...album.tracks.items];
      let nextUrl = album.tracks.next ? new URL(album.tracks.next) : null;

      while (nextUrl) {
        const page = await spotifyGetUrl<{ items: SpotifyAlbumDetail["tracks"]["items"]; next: string | null }>(
          accessToken,
          nextUrl,
        );
        items.push(...page.items);
        nextUrl = page.next ? new URL(page.next) : null;
      }

      return {
        ...album,
        tracks: {
          items,
          next: null,
        },
      };
    },
    async fetchTrack(accessToken, trackId) {
      return spotifyGet<SpotifyTrackDetail>(accessToken, `/tracks/${trackId}`);
    },
    async fetchTracks(accessToken, trackIds) {
      const items: SpotifyTrackDetail[] = [];

      for (let index = 0; index < trackIds.length; index += 50) {
        const ids = trackIds.slice(index, index + 50);
        if (ids.length === 0) {
          continue;
        }

        const response = await spotifyGet<SpotifyTracksResponse>(
          accessToken,
          "/tracks",
          new URLSearchParams({
            ids: ids.join(","),
          }),
        );

        items.push(
          ...response.tracks.filter((track): track is SpotifyTrackDetail => track !== null),
        );
      }

      return items;
    },
    encrypt(value) {
      return encryptString(value, config.encryptionKey);
    },
    decrypt(value) {
      return decryptString(value, config.encryptionKey);
    },
  };
}
