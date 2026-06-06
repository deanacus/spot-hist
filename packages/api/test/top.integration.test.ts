import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { createSession } from "../src/auth/session.js";
import { persistRecentlyPlayedItems } from "../src/services/repository.js";
import type { SpotifyRecentlyPlayedItem } from "../src/types/spotify.js";
import { cleanupConfig, createTestConfig } from "./helpers.js";

function createArtist(id: string, name: string) {
  return {
    id,
    name,
    uri: `spotify:artist:${id}`,
    href: `https://api.spotify.com/v1/artists/${id}`,
  };
}

function createAlbum(
  id: string,
  name: string,
  imageUrl: string,
  albumArtists: ReturnType<typeof createArtist>[],
) {
  return {
    id,
    name,
    album_type: "album",
    total_tracks: 10,
    release_date: "2024-01-01",
    release_date_precision: "day",
    uri: `spotify:album:${id}`,
    href: `https://api.spotify.com/v1/albums/${id}`,
    images: [{ url: imageUrl, height: 640, width: 640 }],
    artists: albumArtists,
  };
}

function createPlay(input: {
  playedAt: string;
  trackId: string;
  trackName: string;
  album: ReturnType<typeof createAlbum>;
  artists: ReturnType<typeof createArtist>[];
  explicit?: boolean;
}) {
  return {
    played_at: input.playedAt,
    context: {
      type: "playlist",
      uri: "spotify:playlist:test-list",
    },
    track: {
      id: input.trackId,
      name: input.trackName,
      album: input.album,
      artists: input.artists,
      disc_number: 1,
      track_number: 1,
      duration_ms: 180_000,
      explicit: input.explicit ?? false,
      external_ids: {
        isrc: `${input.trackId.toUpperCase()}-ISRC`,
      },
      uri: `spotify:track:${input.trackId}`,
      href: `https://api.spotify.com/v1/tracks/${input.trackId}`,
      preview_url: `https://preview/${input.trackId}.mp3`,
    },
  } satisfies SpotifyRecentlyPlayedItem;
}

async function createAuthenticatedAppWithSeedData() {
  const config = createTestConfig();
  const app = await buildApp({
    config,
    skipPoller: true,
  });

  const alphaArtist = createArtist("artist-alpha", "Alpha Artist");
  const betaArtist = createArtist("artist-beta", "Beta Artist");
  const alphaAlbum = createAlbum("album-alpha", "Alpha Album", "https://image/alpha", [alphaArtist]);
  const betaAlbum = createAlbum("album-beta", "Beta Album", "https://image/beta", [betaArtist]);
  const gammaAlbum = createAlbum("album-gamma", "Gamma Album", "https://image/gamma", [
    alphaArtist,
    betaArtist,
  ]);

  await persistRecentlyPlayedItems(app.locals.database, [
    createPlay({
      playedAt: "2024-01-01T00:00:00.000Z",
      trackId: "track-alpha",
      trackName: "Alpha Song",
      album: alphaAlbum,
      artists: [alphaArtist],
    }),
    createPlay({
      playedAt: "2024-01-01T01:00:00.000Z",
      trackId: "track-alpha",
      trackName: "Alpha Song",
      album: alphaAlbum,
      artists: [alphaArtist],
    }),
    createPlay({
      playedAt: "2024-01-01T02:00:00.000Z",
      trackId: "track-alpha",
      trackName: "Alpha Song",
      album: alphaAlbum,
      artists: [alphaArtist],
    }),
    createPlay({
      playedAt: "2024-01-01T03:00:00.000Z",
      trackId: "track-beta",
      trackName: "Beta Song",
      album: betaAlbum,
      artists: [betaArtist],
    }),
    createPlay({
      playedAt: "2024-01-01T04:00:00.000Z",
      trackId: "track-beta",
      trackName: "Beta Song",
      album: betaAlbum,
      artists: [betaArtist],
    }),
    createPlay({
      playedAt: "2024-01-01T05:00:00.000Z",
      trackId: "track-beta",
      trackName: "Beta Song",
      album: betaAlbum,
      artists: [betaArtist],
    }),
    createPlay({
      playedAt: "2024-01-01T06:00:00.000Z",
      trackId: "track-shared",
      trackName: "Shared Song",
      album: gammaAlbum,
      artists: [alphaArtist, betaArtist],
      explicit: true,
    }),
  ]);

  const session = await createSession(app.locals.database, config);

  return {
    app,
    config,
    sessionCookie: session.token,
  };
}

describe("top list endpoints", () => {
  const configs: ReturnType<typeof createTestConfig>[] = [];

  afterEach(() => {
    for (const config of configs.splice(0)) {
      cleanupConfig(config);
    }
  });

  it("requires an authenticated session", async () => {
    const config = createTestConfig();
    configs.push(config);

    const app = await buildApp({
      config,
      skipPoller: true,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/top/tracks",
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("returns top artists ordered by play count and stable name tie-breaks", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedAppWithSeedData();
    configs.push(config);

    app.locals.database.client
      .prepare(
        `
        INSERT INTO artist_details (artist_id, spotify_url, popularity, followers_total, genres_json, images_json, catalog_albums_json, fetched_at, refresh_after)
        SELECT id, ?, ?, ?, ?, ?, ?, ?, ?
        FROM artists
        WHERE spotify_id = ?
        `,
      )
      .run(
        "https://open.spotify.com/artist/artist-alpha",
        55,
        1000,
        "[]",
        JSON.stringify([{ url: "https://image/artist-alpha", width: 640, height: 640 }]),
        "[]",
        "2024-01-01T00:00:00.000Z",
        "2024-02-01T00:00:00.000Z",
        "artist-alpha",
      );

    const response = await app.inject({
      method: "GET",
      url: "/api/top/artists?limit=2",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          artist: {
            id: "artist-alpha",
            name: "Alpha Artist",
            imageUrl: "https://image/artist-alpha",
          },
          playCount: 4,
          lastPlayedAt: "2024-01-01T06:00:00.000Z",
        },
        {
          artist: {
            id: "artist-beta",
            name: "Beta Artist",
            imageUrl: null,
          },
          playCount: 4,
          lastPlayedAt: "2024-01-01T06:00:00.000Z",
        },
      ],
    });

    await app.close();
  });

  it("returns top albums and tracks with nested entity metadata", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedAppWithSeedData();
    configs.push(config);

    const albumsResponse = await app.inject({
      method: "GET",
      url: "/api/top/albums?limit=3",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });
    const tracksResponse = await app.inject({
      method: "GET",
      url: "/api/top/tracks?limit=3",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(albumsResponse.statusCode).toBe(200);
    expect(albumsResponse.json()).toEqual({
      items: [
        {
          album: {
            id: "album-alpha",
            name: "Alpha Album",
            imageUrl: "https://image/alpha",
          },
          artists: [
            {
              id: "artist-alpha",
              name: "Alpha Artist",
            },
          ],
          playCount: 3,
          lastPlayedAt: "2024-01-01T02:00:00.000Z",
        },
        {
          album: {
            id: "album-beta",
            name: "Beta Album",
            imageUrl: "https://image/beta",
          },
          artists: [
            {
              id: "artist-beta",
              name: "Beta Artist",
            },
          ],
          playCount: 3,
          lastPlayedAt: "2024-01-01T05:00:00.000Z",
        },
        {
          album: {
            id: "album-gamma",
            name: "Gamma Album",
            imageUrl: "https://image/gamma",
          },
          artists: [
            {
              id: "artist-alpha",
              name: "Alpha Artist",
            },
            {
              id: "artist-beta",
              name: "Beta Artist",
            },
          ],
          playCount: 1,
          lastPlayedAt: "2024-01-01T06:00:00.000Z",
        },
      ],
    });

    expect(tracksResponse.statusCode).toBe(200);
    expect(tracksResponse.json()).toEqual({
      items: [
        {
          track: {
            id: "track-alpha",
            name: "Alpha Song",
            durationMs: 180000,
            explicit: false,
          },
          album: {
            id: "album-alpha",
            name: "Alpha Album",
            imageUrl: "https://image/alpha",
          },
          artists: [
            {
              id: "artist-alpha",
              name: "Alpha Artist",
            },
          ],
          playCount: 3,
          lastPlayedAt: "2024-01-01T02:00:00.000Z",
        },
        {
          track: {
            id: "track-beta",
            name: "Beta Song",
            durationMs: 180000,
            explicit: false,
          },
          album: {
            id: "album-beta",
            name: "Beta Album",
            imageUrl: "https://image/beta",
          },
          artists: [
            {
              id: "artist-beta",
              name: "Beta Artist",
            },
          ],
          playCount: 3,
          lastPlayedAt: "2024-01-01T05:00:00.000Z",
        },
        {
          track: {
            id: "track-shared",
            name: "Shared Song",
            durationMs: 180000,
            explicit: true,
          },
          album: {
            id: "album-gamma",
            name: "Gamma Album",
            imageUrl: "https://image/gamma",
          },
          artists: [
            {
              id: "artist-alpha",
              name: "Alpha Artist",
            },
            {
              id: "artist-beta",
              name: "Beta Artist",
            },
          ],
          playCount: 1,
          lastPlayedAt: "2024-01-01T06:00:00.000Z",
        },
      ],
    });

    await app.close();
  });

  it("returns 400 for an invalid limit", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedAppWithSeedData();
    configs.push(config);

    const response = await app.inject({
      method: "GET",
      url: "/api/top/albums?limit=banana",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });
});
