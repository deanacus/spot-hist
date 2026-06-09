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

function createAlbum(id: string, name: string, artist: ReturnType<typeof createArtist>) {
  return {
    id,
    name,
    album_type: "album",
    total_tracks: 10,
    release_date: "2024-01-01",
    release_date_precision: "day",
    uri: `spotify:album:${id}`,
    href: `https://api.spotify.com/v1/albums/${id}`,
    images: [{ url: `https://image/${id}`, height: 640, width: 640 }],
    artists: [artist],
  };
}

function createPlay(input: {
  playedAt: string;
  trackId: string;
  trackName: string;
  album: ReturnType<typeof createAlbum>;
  artist: ReturnType<typeof createArtist>;
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
      artists: [input.artist],
      disc_number: 1,
      track_number: 1,
      duration_ms: 180_000,
      explicit: false,
      external_ids: {
        isrc: `${input.trackId.toUpperCase()}-ISRC`,
      },
      uri: `spotify:track:${input.trackId}`,
      href: `https://api.spotify.com/v1/tracks/${input.trackId}`,
      preview_url: null,
    },
  } satisfies SpotifyRecentlyPlayedItem;
}

async function createAuthenticatedAppWithHistory() {
  const config = createTestConfig();
  const app = await buildApp({
    config,
    skipPoller: true,
  });

  const artist = createArtist("artist-1", "North Coast");
  const album = createAlbum("album-1", "Signals", artist);

  await persistRecentlyPlayedItems(app.locals.database, [
    createPlay({
      playedAt: "2024-01-01T00:00:00.000Z",
      trackId: "track-1",
      trackName: "First Light",
      album,
      artist,
    }),
    createPlay({
      playedAt: "2024-01-01T01:00:00.000Z",
      trackId: "track-2",
      trackName: "Midnight Run",
      album,
      artist,
    }),
    createPlay({
      playedAt: "2024-01-01T01:00:00.000Z",
      trackId: "track-2b",
      trackName: "Midnight Run II",
      album,
      artist,
    }),
    createPlay({
      playedAt: "2024-01-01T02:00:00.000Z",
      trackId: "track-3",
      trackName: "Dawn Echo",
      album,
      artist,
    }),
  ]);

  const session = await createSession(app.locals.database, config);

  return {
    app,
    config,
    sessionCookie: session.token,
  };
}

describe("history endpoint", () => {
  const configs: ReturnType<typeof createTestConfig>[] = [];

  afterEach(() => {
    for (const config of configs.splice(0)) {
      cleanupConfig(config);
    }
  });

  it("returns offset pages in deterministic reverse chronological order", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedAppWithHistory();
    configs.push(config);

    const firstPageResponse = await app.inject({
      method: "GET",
      url: "/api/history?limit=2",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(firstPageResponse.statusCode).toBe(200);
    expect(firstPageResponse.json()).toMatchObject({
      items: [
        {
          playedAt: "2024-01-01T02:00:00.000Z",
          track: { id: "track-3", name: "Dawn Echo" },
        },
        {
          playedAt: "2024-01-01T01:00:00.000Z",
          track: { id: "track-2b", name: "Midnight Run II" },
        },
      ],
      total: 4,
      offset: 0,
      limit: 2,
    });

    const secondPageResponse = await app.inject({
      method: "GET",
      url: "/api/history?offset=2&limit=2",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(secondPageResponse.statusCode).toBe(200);
    expect(secondPageResponse.json()).toMatchObject({
      items: [
        {
          playedAt: "2024-01-01T01:00:00.000Z",
          track: { id: "track-2", name: "Midnight Run" },
        },
        {
          playedAt: "2024-01-01T00:00:00.000Z",
          track: { id: "track-1", name: "First Light" },
        },
      ],
      total: 4,
      offset: 2,
      limit: 2,
    });

    await app.close();
  });

  it("returns 400 for invalid history pagination params", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedAppWithHistory();
    configs.push(config);

    const invalidRequests = [
      "/api/history?limit=0",
      "/api/history?limit=1.5",
      "/api/history?limit=nope",
      "/api/history?offset=-1",
      "/api/history?offset=1.25",
      "/api/history?offset=nope",
    ];

    for (const url of invalidRequests) {
      const response = await app.inject({
        method: "GET",
        url,
        cookies: {
          spot_hist_session: sessionCookie,
        },
      });

      expect(response.statusCode, url).toBe(400);
    }

    await app.close();
  });

  it("deletes a history item and excludes it from subsequent history responses", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedAppWithHistory();
    configs.push(config);

    const historyBeforeResponse = await app.inject({
      method: "GET",
      url: "/api/history",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(historyBeforeResponse.statusCode).toBe(200);
    const historyBefore = historyBeforeResponse.json() as {
      items: Array<{ id: number; track: { id: string } }>;
      total: number;
    };
    const playToDelete = historyBefore.items.find((item) => item.track.id === "track-2b");

    expect(playToDelete).toBeDefined();

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/history/${playToDelete?.id}`,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(deleteResponse.statusCode).toBe(204);
    expect(deleteResponse.body).toBe("");

    const historyAfterResponse = await app.inject({
      method: "GET",
      url: "/api/history",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(historyAfterResponse.statusCode).toBe(200);
    expect(historyAfterResponse.json()).toMatchObject({
      items: [
        {
          playedAt: "2024-01-01T02:00:00.000Z",
          track: { id: "track-3", name: "Dawn Echo" },
        },
        {
          playedAt: "2024-01-01T01:00:00.000Z",
          track: { id: "track-2", name: "Midnight Run" },
        },
        {
          playedAt: "2024-01-01T00:00:00.000Z",
          track: { id: "track-1", name: "First Light" },
        },
      ],
      total: 3,
      offset: 0,
      limit: 50,
    });

    expect(
      (historyAfterResponse.json() as { items: Array<{ id: number; track: { id: string } }> }).items,
    ).not.toContainEqual(expect.objectContaining({ id: playToDelete?.id }));

    await app.close();
  });

  it("returns 404 when deleting a missing history item", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedAppWithHistory();
    configs.push(config);

    const response = await app.inject({
      method: "DELETE",
      url: "/api/history/999999",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "History item not found",
    });

    await app.close();
  });

  it("returns 400 for an invalid history item id", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedAppWithHistory();
    configs.push(config);

    const invalidRequests = ["/api/history/nope", "/api/history/1.5", "/api/history/0"];

    for (const url of invalidRequests) {
      const response = await app.inject({
        method: "DELETE",
        url,
        cookies: {
          spot_hist_session: sessionCookie,
        },
      });

      expect(response.statusCode, url).toBe(400);
      expect(response.json()).toEqual({
        error: "Invalid id",
      });
    }

    await app.close();
  });
});
