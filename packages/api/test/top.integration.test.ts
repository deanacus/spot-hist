import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import {
  cleanupConfig,
  createAlbum,
  createArtist,
  createAuthenticatedApp,
  createPlay,
  createTestConfig,
  expectAuthenticatedRequestsToReturnStatus,
} from "./helpers.js";

async function createAuthenticatedAppWithSeedData() {
  const alphaArtist = createArtist("artist-alpha", "Alpha Artist");
  const betaArtist = createArtist("artist-beta", "Beta Artist");
  const alphaAlbum = createAlbum("album-alpha", "Alpha Album", "https://image/alpha", [alphaArtist]);
  const betaAlbum = createAlbum("album-beta", "Beta Album", "https://image/beta", [betaArtist]);
  const gammaAlbum = createAlbum("album-gamma", "Gamma Album", "https://image/gamma", [
    alphaArtist,
    betaArtist,
  ]);

  const seedItems = [
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
  ];

  const { app, config, sessionCookie } = await createAuthenticatedApp({
    seedItems,
  });

  return {
    app,
    config,
    sessionCookie,
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
      total: 2,
      offset: 0,
      limit: 2,
    });

    await app.close();
  });

  it("returns paged top albums and tracks with nested entity metadata", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedAppWithSeedData();
    configs.push(config);

    const albumsResponse = await app.inject({
      method: "GET",
      url: "/api/top/albums?limit=2&offset=1",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });
    const tracksResponse = await app.inject({
      method: "GET",
      url: "/api/top/tracks?limit=2&offset=1",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(albumsResponse.statusCode).toBe(200);
    expect(albumsResponse.json()).toEqual({
      items: [
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
      total: 3,
      offset: 1,
      limit: 2,
    });

    expect(tracksResponse.statusCode).toBe(200);
    expect(tracksResponse.json()).toEqual({
      items: [
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
      total: 3,
      offset: 1,
      limit: 2,
    });

    await app.close();
  });

  it("returns 400 for invalid top-list pagination params", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedAppWithSeedData();
    configs.push(config);

    const requests = [
      "/api/top/artists?limit=banana",
      "/api/top/albums?limit=0",
      "/api/top/tracks?offset=-1",
      "/api/top/tracks?offset=1.5",
    ];

    await expectAuthenticatedRequestsToReturnStatus(app, sessionCookie, "GET", requests, 400);

    await app.close();
  });
});
