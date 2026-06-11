import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import {
  cleanupConfig,
  createAlbum,
  createArtist,
  createAuthenticatedApp,
  createPlay,
  createTestConfig,
} from "./helpers.js";

async function createAuthenticatedAppWithReportData() {
  const alphaArtist = createArtist("artist-alpha", "Alpha Artist");
  const betaArtist = createArtist("artist-beta", "Beta Artist");
  const gammaArtist = createArtist("artist-gamma", "Gamma Artist");

  const alphaAlbum = createAlbum("album-alpha", "Alpha Album", "https://image/alpha", [alphaArtist], {
    album_type: "album",
    release_date: "1998-05-01",
    release_date_precision: "day",
  });
  const betaAlbum = createAlbum("album-beta", "Beta Single", "https://image/beta", [betaArtist], {
    album_type: "single",
    release_date: "2018-06-01",
    release_date_precision: "day",
  });
  const gammaAlbum = createAlbum("album-gamma", "Gamma Mystery", "https://image/gamma", [gammaArtist], {
    album_type: "compilation",
    release_date: "",
    release_date_precision: "year",
  });

  const seedItems = [
    createPlay({
      playedAt: "2026-05-20T01:00:00.000Z",
      trackId: "track-alpha",
      trackName: "Alpha Song",
      album: alphaAlbum,
      artists: [alphaArtist],
      durationMs: 180_000,
    }),
    createPlay({
      playedAt: "2026-06-01T00:30:00.000Z",
      trackId: "track-alpha",
      trackName: "Alpha Song",
      album: alphaAlbum,
      artists: [alphaArtist],
      durationMs: 180_000,
    }),
    createPlay({
      playedAt: "2026-06-01T05:30:00.000Z",
      trackId: "track-alpha",
      trackName: "Alpha Song",
      album: alphaAlbum,
      artists: [alphaArtist],
      durationMs: 180_000,
    }),
    createPlay({
      playedAt: "2026-06-03T01:00:00.000Z",
      trackId: "track-beta",
      trackName: "Beta Song",
      album: betaAlbum,
      artists: [betaArtist],
      durationMs: 200_000,
      explicit: true,
    }),
    createPlay({
      playedAt: "2026-06-03T02:00:00.000Z",
      trackId: "track-beta",
      trackName: "Beta Song",
      album: betaAlbum,
      artists: [betaArtist],
      durationMs: 200_000,
      explicit: true,
    }),
    createPlay({
      playedAt: "2026-06-04T03:00:00.000Z",
      trackId: "track-beta",
      trackName: "Beta Song",
      album: betaAlbum,
      artists: [betaArtist],
      durationMs: 200_000,
      explicit: true,
    }),
    createPlay({
      playedAt: "2026-06-05T22:00:00.000Z",
      trackId: "track-gamma",
      trackName: "Gamma Song",
      album: gammaAlbum,
      artists: [gammaArtist],
      durationMs: 240_000,
      explicit: false,
    }),
  ];

  const { app, config, sessionCookie } = await createAuthenticatedApp({
    seedItems,
  });

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
      "https://open.spotify.com/artist/artist-beta",
      55,
      1_000,
      "[]",
      JSON.stringify([{ url: "https://image/artist-beta", width: 640, height: 640 }]),
      "[]",
      "2026-06-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
      "artist-beta",
    );

  return {
    app,
    config,
    sessionCookie,
  };
}

describe("reports endpoint", () => {
  const configs: Array<ReturnType<typeof createTestConfig>> = [];
  const timeZone = "Australia/Brisbane";

  afterEach(() => {
    vi.useRealTimers();

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
      url: `/api/reports?timeframe=month&offset=0&timeZone=${encodeURIComponent(timeZone)}`,
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("returns a full current-month report payload with summary, discovery, rankings, and composition data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00+10:00"));

    const { app, config, sessionCookie } = await createAuthenticatedAppWithReportData();
    configs.push(config);

    const response = await app.inject({
      method: "GET",
      url: `/api/reports?timeframe=month&offset=0&timeZone=${encodeURIComponent(timeZone)}`,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      periodStart: string;
      periodEnd: string;
      topArtists: Array<{ artist: { id: string; imageUrl: string | null }; playCount: number; listeningTimeMs: number; shareOfScrobbles: number }>;
      topAlbums: Array<{ album: { id: string }; playCount: number; listeningTimeMs: number }>;
      topTracks: Array<{ track: { id: string; explicit: boolean }; playCount: number; listeningTimeMs: number }>;
      patterns: {
        listeningClock: Array<{ key: string; label: string; count: number; share: number }>;
        weekdayActivity: Array<{ key: string; label: string; count: number; share: number }>;
        byDecade: Array<{ key: string; label: string; count: number; share: number }>;
      };
      composition: {
        releaseFormatMix: Array<{ key: string; label: string; count: number; share: number }>;
        explicitMix: Array<{ key: string; label: string; count: number; share: number }>;
      };
    };

    expect(body).toMatchObject({
      timeframe: "month",
      offset: 0,
      label: "June 2026",
      isCurrentPeriod: true,
      hasPreviousPeriod: true,
      hasNextPeriod: false,
      summary: {
        totalScrobbles: 6,
        totalListeningTimeMs: 1_200_000,
        averageScrobblesPerDay: 6 / 11,
        averageListeningTimePerDayMs: 1_200_000 / 11,
        mostActiveDay: {
          date: "2026-06-03",
          playCount: 2,
          listeningTimeMs: 400_000,
        },
        longestStreakDays: 2,
      },
      discovery: {
        uniqueArtists: 3,
        newArtists: 2,
        uniqueAlbums: 3,
        newAlbums: 2,
        uniqueTracks: 3,
        newTracks: 2,
      },
    });

    expect(body.periodStart).toBe(new Date(2026, 5, 1, 0, 0, 0, 0).toISOString());
    expect(body.periodEnd).toBe(new Date("2026-06-11T12:00:00+10:00").toISOString());
    expect(body.topArtists[0]).toMatchObject({
      artist: {
        id: "artist-beta",
        imageUrl: "https://image/artist-beta",
      },
      playCount: 3,
      listeningTimeMs: 600_000,
      shareOfScrobbles: 0.5,
    });
    expect(body.topAlbums[0]).toMatchObject({
      album: { id: "album-beta" },
      playCount: 3,
      listeningTimeMs: 600_000,
    });
    expect(body.topTracks[0]).toMatchObject({
      track: { id: "track-beta", explicit: true },
      playCount: 3,
      listeningTimeMs: 600_000,
    });
    expect(body.patterns.listeningClock.find((bucket) => bucket.label === "8AM")?.count).toBe(1);
    expect(body.patterns.listeningClock.find((bucket) => bucket.label === "10AM")?.count).toBe(1);
    expect(body.patterns.listeningClock.find((bucket) => bucket.label === "11AM")?.count).toBe(1);
    expect(body.patterns.weekdayActivity.map(({ label, count }) => ({ label, count }))).toEqual([
      { label: "Mon", count: 2 },
      { label: "Tue", count: 0 },
      { label: "Wed", count: 2 },
      { label: "Thu", count: 1 },
      { label: "Fri", count: 0 },
      { label: "Sat", count: 1 },
      { label: "Sun", count: 0 },
    ]);
    expect(body.patterns.byDecade.map(({ label, count }) => ({ label, count }))).toEqual([
      { label: "1990s", count: 2 },
      { label: "2010s", count: 3 },
      { label: "Unknown", count: 1 },
    ]);
    expect(body.composition.releaseFormatMix.map(({ label, count }) => ({ label, count }))).toEqual([
      { label: "Albums", count: 2 },
      { label: "Singles", count: 3 },
      { label: "Other", count: 1 },
    ]);
    expect(body.composition.explicitMix.map(({ label, count }) => ({ label, count }))).toEqual([
      { label: "Explicit", count: 3 },
      { label: "Clean", count: 3 },
    ]);

    await app.close();
  });

  it("returns prior bounded periods and collapses all-time navigation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00+10:00"));

    const { app, config, sessionCookie } = await createAuthenticatedAppWithReportData();
    configs.push(config);

    const previousMonthResponse = await app.inject({
      method: "GET",
      url: `/api/reports?timeframe=month&offset=1&timeZone=${encodeURIComponent(timeZone)}`,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });
    const fiveYearResponse = await app.inject({
      method: "GET",
      url: `/api/reports?timeframe=5y&offset=0&timeZone=${encodeURIComponent(timeZone)}`,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });
    const previousFiveYearResponse = await app.inject({
      method: "GET",
      url: `/api/reports?timeframe=5y&offset=1&timeZone=${encodeURIComponent(timeZone)}`,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });
    const allTimeResponse = await app.inject({
      method: "GET",
      url: `/api/reports?timeframe=all&offset=4&timeZone=${encodeURIComponent(timeZone)}`,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(previousMonthResponse.statusCode).toBe(200);
    expect(previousMonthResponse.json()).toMatchObject({
      timeframe: "month",
      offset: 1,
      label: "May 2026",
      isCurrentPeriod: false,
      hasPreviousPeriod: false,
      hasNextPeriod: true,
      summary: {
        totalScrobbles: 1,
        totalListeningTimeMs: 180_000,
      },
    });
    expect((previousMonthResponse.json() as { periodStart: string; periodEnd: string }).periodStart).toBe(
      new Date(2026, 4, 1, 0, 0, 0, 0).toISOString(),
    );
    expect((previousMonthResponse.json() as { periodStart: string; periodEnd: string }).periodEnd).toBe(
      new Date(2026, 4, 31, 23, 59, 59, 999).toISOString(),
    );

    expect(fiveYearResponse.statusCode).toBe(200);
    expect(fiveYearResponse.json()).toMatchObject({
      timeframe: "5y",
      offset: 0,
      label: "2022–2026",
      isCurrentPeriod: true,
      hasPreviousPeriod: false,
      hasNextPeriod: false,
      summary: {
        totalScrobbles: 7,
        totalListeningTimeMs: 1_380_000,
      },
    });
    expect((fiveYearResponse.json() as { periodStart: string; periodEnd: string }).periodStart).toBe(
      "2021-12-31T14:00:00.000Z",
    );

    expect(previousFiveYearResponse.statusCode).toBe(200);
    expect(previousFiveYearResponse.json()).toMatchObject({
      timeframe: "5y",
      offset: 1,
      label: "2017–2021",
      isCurrentPeriod: false,
      hasPreviousPeriod: false,
      hasNextPeriod: true,
      summary: {
        totalScrobbles: 0,
        totalListeningTimeMs: 0,
      },
    });

    expect(allTimeResponse.statusCode).toBe(200);
    expect(allTimeResponse.json()).toMatchObject({
      timeframe: "all",
      offset: 0,
      label: "All time",
      isCurrentPeriod: true,
      hasPreviousPeriod: false,
      hasNextPeriod: false,
      summary: {
        totalScrobbles: 7,
        totalListeningTimeMs: 1_380_000,
      },
      discovery: {
        newArtists: 3,
        newAlbums: 3,
        newTracks: 3,
      },
    });

    await app.close();
  });

  it("validates timeframe and offset query params", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00+10:00"));

    const { app, config, sessionCookie } = await createAuthenticatedAppWithReportData();
    configs.push(config);

    const invalidTimeframe = await app.inject({
      method: "GET",
      url: `/api/reports?timeframe=quarter&timeZone=${encodeURIComponent(timeZone)}`,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });
    const invalidOffset = await app.inject({
      method: "GET",
      url: `/api/reports?timeframe=month&offset=-1&timeZone=${encodeURIComponent(timeZone)}`,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });
    const invalidTimeZone = await app.inject({
      method: "GET",
      url: "/api/reports?timeframe=month&timeZone=Not%2FAZone",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(invalidTimeframe.statusCode).toBe(400);
    expect(invalidTimeframe.json()).toEqual({ error: "Invalid timeframe" });
    expect(invalidOffset.statusCode).toBe(400);
    expect(invalidOffset.json()).toEqual({ error: "Invalid offset" });
    expect(invalidTimeZone.statusCode).toBe(400);
    expect(invalidTimeZone.json()).toEqual({ error: "Invalid time zone" });

    await app.close();
  });
});
