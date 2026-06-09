import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupConfig,
  createAlbum,
  createArtist,
  createAuthenticatedApp,
  createPlay,
  createTestConfig,
  expectAuthenticatedRequestsToReturnStatus,
} from "./helpers.js";

async function createAuthenticatedAppWithHistory() {
  const artist = createArtist("artist-1", "North Coast");
  const album = createAlbum("album-1", "Signals", `https://image/album-1`, [artist]);

  return createAuthenticatedApp({
    seedItems: [
    createPlay({
      playedAt: "2024-01-01T00:00:00.000Z",
      trackId: "track-1",
      trackName: "First Light",
      album,
      artists: [artist],
      previewUrl: null,
    }),
    createPlay({
      playedAt: "2024-01-01T01:00:00.000Z",
      trackId: "track-2",
      trackName: "Midnight Run",
      album,
      artists: [artist],
      previewUrl: null,
    }),
    createPlay({
      playedAt: "2024-01-01T01:00:00.000Z",
      trackId: "track-2b",
      trackName: "Midnight Run II",
      album,
      artists: [artist],
      previewUrl: null,
    }),
    createPlay({
      playedAt: "2024-01-01T02:00:00.000Z",
      trackId: "track-3",
      trackName: "Dawn Echo",
      album,
      artists: [artist],
      previewUrl: null,
    }),
    ],
  });
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

    await expectAuthenticatedRequestsToReturnStatus(app, sessionCookie, "GET", invalidRequests, 400);

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
