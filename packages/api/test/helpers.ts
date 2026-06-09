import { Buffer } from "node:buffer";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect } from "vitest";

import { buildApp } from "../src/app.js";
import { createSession } from "../src/auth/session.js";
import type { AppConfig } from "../src/config.js";
import type { DatabaseContext } from "../src/db/index.js";
import { persistRecentlyPlayedItems, storeConnectedAccount } from "../src/services/repository.js";
import type { SpotifyClient } from "../src/auth/spotify.js";
import type { SpotifyRecentlyPlayedItem } from "../src/types/spotify.js";

export type TestApp = Awaited<ReturnType<typeof buildApp>>;
export type MultipartTestFile = {
  filename: string;
  contentType: string;
  content: Buffer;
};

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const configDir = mkdtempSync(join(tmpdir(), "spot-hist-"));
  return {
    spotifyClientId: "client-id",
    spotifyClientSecret: "client-secret",
    spotifyRedirectUri: "http://localhost:3000/api/auth/callback",
    encryptionKey: Buffer.alloc(32, 1),
    pollIntervalMs: 300_000,
    port: 3000,
    logLevel: "silent",
    configDir,
    sessionIdleTimeoutMs: 60_000,
    ...overrides,
  };
}

export function cleanupConfig(config: AppConfig) {
  rmSync(config.configDir, { recursive: true, force: true });
}

export function createArtist(id: string, name: string) {
  return {
    id,
    name,
    uri: `spotify:artist:${id}`,
    href: `https://api.spotify.com/v1/artists/${id}`,
  };
}

export function createSpotifyImage(url: string) {
  return {
    url,
    width: 640,
    height: 640,
  };
}

export function createSpotifyArtistPayload(id: string, name: string) {
  return {
    id,
    name,
    uri: `spotify:artist:${id}`,
    href: `https://api.spotify.com/v1/artists/${id}`,
  };
}

export function createAlbum(
  id: string,
  name: string,
  imageUrl: string,
  albumArtists: ReturnType<typeof createArtist>[],
  overrides: Partial<{
    album_type: string;
    total_tracks: number;
    release_date: string;
    release_date_precision: string;
  }> = {},
) {
  return {
    id,
    name,
    album_type: overrides.album_type ?? "album",
    total_tracks: overrides.total_tracks ?? 10,
    release_date: overrides.release_date ?? "2024-01-01",
    release_date_precision: overrides.release_date_precision ?? "day",
    uri: `spotify:album:${id}`,
    href: `https://api.spotify.com/v1/albums/${id}`,
    images: imageUrl ? [{ url: imageUrl, height: 640, width: 640 }] : [],
    artists: albumArtists,
  };
}

export function createPlay(input: {
  playedAt: string;
  trackId: string;
  trackName: string;
  album: ReturnType<typeof createAlbum>;
  artists: ReturnType<typeof createArtist>[];
  explicit?: boolean;
  durationMs?: number;
  discNumber?: number;
  trackNumber?: number;
  isrc?: string;
  previewUrl?: string | null;
  contextType?: string | null;
  contextUri?: string | null;
}) {
  return {
    played_at: input.playedAt,
    context:
      input.contextType === null
        ? null
        : {
            type: input.contextType ?? "playlist",
            uri: input.contextUri ?? "spotify:playlist:test-list",
          },
    track: {
      id: input.trackId,
      name: input.trackName,
      album: input.album,
      artists: input.artists,
      disc_number: input.discNumber ?? 1,
      track_number: input.trackNumber ?? 1,
      duration_ms: input.durationMs ?? 180_000,
      explicit: input.explicit ?? false,
      external_ids: {
        isrc: input.isrc ?? `${input.trackId.toUpperCase()}-ISRC`,
      },
      uri: `spotify:track:${input.trackId}`,
      href: `https://api.spotify.com/v1/tracks/${input.trackId}`,
      preview_url: input.previewUrl ?? `https://preview/${input.trackId}.mp3`,
    },
  } satisfies SpotifyRecentlyPlayedItem;
}

export function createSpotifyArtistRelease(input: {
  id: string;
  name: string;
  albumType: string;
  albumGroup: string;
  totalTracks: number;
  releaseDate: string;
  imageUrl: string;
  artists: Array<ReturnType<typeof createSpotifyArtistPayload>>;
  spotifyUrl: string;
}) {
  return {
    id: input.id,
    name: input.name,
    album_type: input.albumType,
    album_group: input.albumGroup,
    total_tracks: input.totalTracks,
    release_date: input.releaseDate,
    release_date_precision: "day",
    uri: `spotify:album:${input.id}`,
    href: `https://api.spotify.com/v1/albums/${input.id}`,
    images: [createSpotifyImage(input.imageUrl)],
    artists: input.artists,
    external_urls: {
      spotify: input.spotifyUrl,
    },
  };
}

export function createSpotifyAlbumTrack(input: {
  id: string;
  name: string;
  discNumber: number;
  trackNumber: number;
  durationMs: number;
  explicit?: boolean;
  previewUrl?: string | null;
  artists: Array<ReturnType<typeof createSpotifyArtistPayload>>;
}) {
  return {
    id: input.id,
    name: input.name,
    disc_number: input.discNumber,
    track_number: input.trackNumber,
    duration_ms: input.durationMs,
    explicit: input.explicit ?? false,
    preview_url: input.previewUrl ?? `https://preview/${input.id}.mp3`,
    uri: `spotify:track:${input.id}`,
    href: `https://api.spotify.com/v1/tracks/${input.id}`,
    artists: input.artists,
  };
}

export type TestSpotifyClient = SpotifyClient & {
  fetchArtist?: (...args: any[]) => Promise<any>;
  fetchArtistAlbums?: (...args: any[]) => Promise<any>;
  fetchAlbum?: (...args: any[]) => Promise<any>;
  fetchTrack?: (...args: any[]) => Promise<any>;
  fetchTracks?: (...args: any[]) => Promise<any>;
};

export function createSpotifyMock(overrides: Partial<TestSpotifyClient> = {}): TestSpotifyClient {
  return {
    buildAuthUrl: () => "https://example.com/authorize",
    exchangeCode: async () => ({
      access_token: "access-token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "refresh-token",
      scope: "user-read-recently-played user-read-email",
    }),
    refreshAccessToken: async () => ({
      access_token: "access-token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "refresh-token",
      scope: "user-read-recently-played user-read-email",
    }),
    fetchProfile: async () => ({
      id: "spotify-user",
      display_name: "Listener",
      email: "listener@example.com",
    }),
    fetchRecentlyPlayed: async () => ({
      items: [],
      next: null,
    }),
    async fetchArtist() {
      throw new Error("fetchArtist mock not configured");
    },
    async fetchArtistAlbums() {
      throw new Error("fetchArtistAlbums mock not configured");
    },
    async fetchAlbum() {
      throw new Error("fetchAlbum mock not configured");
    },
    async fetchTrack() {
      throw new Error("fetchTrack mock not configured");
    },
    async fetchTracks() {
      throw new Error("fetchTracks mock not configured");
    },
    encrypt: (value) => value,
    decrypt: (value) => value,
    ...overrides,
  };
}

async function seedRecentlyPlayed(database: DatabaseContext, items: SpotifyRecentlyPlayedItem[]) {
  await persistRecentlyPlayedItems(database, items);
}

export async function createAuthenticatedApp(options: {
  configOverrides?: Partial<AppConfig>;
  spotify?: TestSpotifyClient;
  seedItems?: SpotifyRecentlyPlayedItem[];
  storeAccount?: boolean;
} = {}) {
  const config = createTestConfig(options.configOverrides);
  const spotify = options.spotify ?? createSpotifyMock();
  const app = await buildApp({
    config,
    spotify: spotify as SpotifyClient,
    skipPoller: true,
  });

  if (options.seedItems?.length) {
    await seedRecentlyPlayed(app.locals.database, options.seedItems);
  }

  if (options.storeAccount !== false) {
    await storeConnectedAccount(
      app.locals.database,
      spotify,
      {
        id: "spotify-user",
        display_name: "Listener",
        email: "listener@example.com",
      },
      {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    );
  }

  const session = await createSession(app.locals.database, config);

  return {
    app,
    config,
    sessionCookie: session.token,
    spotify,
  };
}

export async function setPassword(app: TestApp, password = "secret") {
  const response = await app.inject({
    method: "POST",
    url: "/api/setup/password",
    payload: { password },
  });

  expect(response.statusCode).toBe(204);
  return response;
}

export async function connectSpotifyAccount(app: TestApp, password = "secret") {
  await setPassword(app, password);

  const loginRedirect = await app.inject({
    method: "GET",
    url: "/api/auth/login",
  });
  const stateCookie = loginRedirect.cookies.find((cookie) => cookie.name === "spot_hist_oauth_state");

  expect(loginRedirect.statusCode).toBe(302);
  expect(stateCookie).toBeTruthy();

  const callback = await app.inject({
    method: "GET",
    url: `/api/auth/callback?code=code123&state=${stateCookie?.value}`,
    cookies: {
      spot_hist_oauth_state: stateCookie?.value ?? "",
    },
  });

  expect(callback.statusCode).toBe(302);

  return {
    callback,
    state: stateCookie?.value ?? "",
  };
}

export async function createAuthenticatedSession(app: TestApp, password = "secret") {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/session",
    payload: { password },
  });
  const sessionCookie = response.cookies.find((cookie) => cookie.name === "spot_hist_session");

  expect(response.statusCode).toBe(204);
  expect(sessionCookie).toBeTruthy();

  return sessionCookie?.value ?? "";
}

export function createMultipartPayload(files: MultipartTestFile[]) {
  const boundary = "spot-hist-test-boundary";
  const chunks: Buffer[] = [];

  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
          `Content-Type: ${file.contentType}\r\n\r\n`,
        "utf8",
      ),
    );
    chunks.push(file.content);
    chunks.push(Buffer.from("\r\n", "utf8"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));

  return {
    boundary,
    payload: Buffer.concat(chunks),
  };
}

export async function postMultipartFiles(
  app: TestApp,
  sessionCookie: string,
  url: string,
  files: MultipartTestFile[],
) {
  const multipart = createMultipartPayload(files);

  return app.inject({
    method: "POST",
    url,
    cookies: {
      spot_hist_session: sessionCookie,
    },
    headers: {
      "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
    },
    payload: multipart.payload,
  });
}

export async function createSpotifyHistoryImportJob(
  app: TestApp,
  sessionCookie: string,
  files: MultipartTestFile[],
) {
  return postMultipartFiles(app, sessionCookie, "/api/imports/spotify-history", files);
}

export async function waitForSpotifyHistoryImportJob(app: TestApp, sessionCookie: string, jobId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await app.inject({
      method: "GET",
      url: `/api/imports/spotify-history/${jobId}`,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const job = response.json() as {
      status: string;
      phase: string | null;
      [key: string]: unknown;
    };

    if (job.status === "completed" || job.status === "failed") {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for import job ${jobId} to finish.`);
}

export async function expectAuthenticatedRequestsToReturnStatus(
  app: Awaited<ReturnType<typeof createAuthenticatedApp>>["app"],
  sessionCookie: string,
  method: "GET" | "DELETE",
  urls: string[],
  expectedStatus: number,
) {
  for (const url of urls) {
    const response = await app.inject({
      method,
      url,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(response.statusCode, url).toBe(expectedStatus);
  }
}

const detailTableByEntity = {
  artist: {
    baseTable: "artists",
    detailTable: "artist_details",
    foreignKey: "artist_id",
  },
  album: {
    baseTable: "albums",
    detailTable: "album_details",
    foreignKey: "album_id",
  },
  track: {
    baseTable: "tracks",
    detailTable: "track_details",
    foreignKey: "track_id",
  },
} as const;

export type DetailEntityType = keyof typeof detailTableByEntity;

export function getDetailRow(
  database: DatabaseContext,
  entityType: DetailEntityType,
  spotifyId: string,
) {
  const target = detailTableByEntity[entityType];
  return database.client
    .prepare(
      `SELECT detail.* FROM ${target.detailTable} AS detail
       INNER JOIN ${target.baseTable} AS base ON base.id = detail.${target.foreignKey}
       WHERE base.spotify_id = ?`,
    )
    .get(spotifyId) as Record<string, unknown> | undefined;
}

export function markDetailRowStale(
  database: DatabaseContext,
  entityType: DetailEntityType,
  spotifyId: string,
  staleFetchedAt = "2024-01-01T00:00:00.000Z",
  staleRefreshAfter = "2024-01-15T00:00:00.000Z",
) {
  const target = detailTableByEntity[entityType];
  database.client
    .prepare(
      `UPDATE ${target.detailTable}
       SET fetched_at = ?, refresh_after = ?
       WHERE ${target.foreignKey} = (
         SELECT id FROM ${target.baseTable} WHERE spotify_id = ?
       )`,
    )
    .run(staleFetchedAt, staleRefreshAfter, spotifyId);
}
