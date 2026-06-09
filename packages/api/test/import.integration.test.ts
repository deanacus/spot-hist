import { Buffer } from "node:buffer";

import { afterEach, describe, expect, it, vi } from "vitest";
import { zipSync } from "fflate";

import {
  cleanupConfig,
  createAlbum,
  createArtist,
  createAuthenticatedApp,
  createSpotifyHistoryImportJob,
  createPlay,
  createSpotifyMock,
  createTestConfig,
  waitForSpotifyHistoryImportJob,
} from "./helpers.js";

function makeImportRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ts: "2024-02-02T00:00:00.000Z",
    platform: "web_player",
    ms_played: 180000,
    conn_country: "AU",
    ip_addr: "127.0.0.1",
    master_metadata_track_name: "Midnight Run",
    master_metadata_album_artist_name: "North Coast",
    master_metadata_album_album_name: "Signals",
    spotify_track_uri: "spotify:track:track-1",
    episode_name: null,
    episode_show_name: null,
    spotify_episode_uri: null,
    audiobook_title: null,
    audiobook_uri: null,
    audiobook_chapter_title: null,
    audiobook_chapter_uri: null,
    reason_start: "trackdone",
    reason_end: "trackdone",
    shuffle: false,
    skipped: false,
    offline: false,
    offline_timestamp: 0,
    incognito_mode: false,
    ...overrides,
  };
}

describe("spotify history import jobs", () => {
  const configs: Array<ReturnType<typeof createTestConfig>> = [];

  afterEach(() => {
    vi.restoreAllMocks();

    for (const config of configs.splice(0)) {
      cleanupConfig(config);
    }
  });

  it("creates a background job, resolves local tracks first, and leaves poll cursor untouched", async () => {
    const artist = createArtist("artist-1", "North Coast");
    const album = createAlbum("album-1", "Signals", "https://image/album-1", [artist]);
    const localPlay = createPlay({
      playedAt: "2024-02-01T00:00:00.000Z",
      trackId: "track-1",
      trackName: "Midnight Run",
      album,
      artists: [artist],
    });

    const remoteTrackPlay = createPlay({
      playedAt: "2024-02-03T00:00:00.000Z",
      trackId: "track-2",
      trackName: "First Light",
      album,
      artists: [artist],
    });

    const spotify = createSpotifyMock({
      fetchTracks: vi.fn(async (_accessToken: string, trackIds: string[]) =>
        trackIds.includes("track-2")
          ? [
              {
                ...remoteTrackPlay.track,
                external_urls: {
                  spotify: "https://open.spotify.com/track/track-2",
                },
                popularity: 44,
              },
            ]
          : [],
      ),
    });

    const { app, config, sessionCookie } = await createAuthenticatedApp({
      seedItems: [localPlay],
      spotify,
    });
    configs.push(config);

    app.locals.database.client
      .prepare("UPDATE account SET poll_cursor = ? WHERE id = 1")
      .run(17_000);

    const createResponse = await createSpotifyHistoryImportJob(app, sessionCookie, [
      {
        filename: "Streaming_History_Audio_2024.json",
        contentType: "application/json",
        content: Buffer.from(
          JSON.stringify([
            makeImportRow({
              ts: "2024-02-02T00:00:00.000Z",
              spotify_track_uri: "spotify:track:track-1",
            }),
            makeImportRow({
              ts: "2024-02-03T00:00:00.000Z",
              spotify_track_uri: "spotify:track:track-2",
            }),
            makeImportRow({
              ts: "2024-02-04T00:00:00.000Z",
              spotify_track_uri: "spotify:track:track-2",
              skipped: true,
            }),
            makeImportRow({
              ts: "2024-02-05T00:00:00.000Z",
              spotify_track_uri: null,
              spotify_episode_uri: "spotify:episode:episode-1",
              episode_name: "Podcast",
            }),
            makeImportRow({
              ts: "not-a-date",
              spotify_track_uri: "spotify:track:track-2",
            }),
          ]),
          "utf8",
        ),
      },
    ]);

    expect(createResponse.statusCode).toBe(202);
    const createdJob = createResponse.json() as { id: string; status: string };
    expect(["queued", "running"]).toContain(createdJob.status);

    const completedJob = await waitForSpotifyHistoryImportJob(app, sessionCookie, createdJob.id);
    expect(completedJob).toMatchObject({
      status: "completed",
      phase: "completed",
      filesProcessed: 1,
      rowsScanned: 5,
      imported: 2,
      duplicatesSkipped: 0,
      nonMusicSkipped: 1,
      skippedTracksSkipped: 1,
      invalidRowsSkipped: 1,
      totalTrackIds: 2,
      resolvedTrackIds: 2,
    });

    const latestResponse = await app.inject({
      method: "GET",
      url: "/api/imports/spotify-history/latest",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(latestResponse.statusCode).toBe(200);
    expect(latestResponse.json()).toMatchObject({
      id: createdJob.id,
      status: "completed",
    });

    const plays = app.locals.database.client
      .prepare("SELECT played_at FROM plays ORDER BY played_at ASC")
      .all() as Array<{ played_at: string }>;
    expect(plays.map((play) => play.played_at)).toEqual([
      "2024-02-01T00:00:00.000Z",
      "2024-02-02T00:00:00.000Z",
      "2024-02-03T00:00:00.000Z",
    ]);

    const pollCursorRow = app.locals.database.client
      .prepare("SELECT poll_cursor FROM account WHERE id = 1")
      .get() as { poll_cursor: number | null };
    expect(pollCursorRow.poll_cursor).toBe(17_000);
    expect(spotify.fetchTracks).toHaveBeenCalledWith("access-token", ["track-2"]);

    await app.close();
  });

  it("imports JSON files from ZIPs, excludes video rows, and ignores duplicates already in plays", async () => {
    const artist = createArtist("artist-2", "Signals");
    const album = createAlbum("album-2", "Afterglow", "https://image/album-2", [artist], {
      album_type: "single",
    });
    const seededPlay = createPlay({
      playedAt: "2024-03-01T00:00:00.000Z",
      trackId: "track-3",
      trackName: "Afterglow",
      album,
      artists: [artist],
    });

    const spotify = createSpotifyMock({
      fetchTracks: vi.fn(async () => [
        {
          ...seededPlay.track,
          external_urls: {
            spotify: "https://open.spotify.com/track/track-3",
          },
          popularity: 51,
        },
      ]),
    });

    const { app, config, sessionCookie } = await createAuthenticatedApp({
      seedItems: [seededPlay],
      spotify,
    });
    configs.push(config);

    const archive = zipSync({
      "Spotify Extended Streaming History/Streaming_History_Audio_2024.json": Buffer.from(
        JSON.stringify([
          makeImportRow({
            ts: "2024-03-01T00:00:00.000Z",
            spotify_track_uri: "spotify:track:track-3",
          }),
        ]),
        "utf8",
      ),
      "Spotify Extended Streaming History/Streaming_History_Video_2024.json": Buffer.from(
        JSON.stringify([
          makeImportRow({
            ts: "2024-03-02T00:00:00.000Z",
            spotify_track_uri: null,
            spotify_episode_uri: null,
            master_metadata_track_name: null,
          }),
        ]),
        "utf8",
      ),
    });

    const createResponse = await createSpotifyHistoryImportJob(app, sessionCookie, [
      {
        filename: "spotify-export.zip",
        contentType: "application/zip",
        content: Buffer.from(archive),
      },
    ]);

    expect(createResponse.statusCode).toBe(202);
    const createdJob = createResponse.json() as { id: string };
    const completedJob = await waitForSpotifyHistoryImportJob(app, sessionCookie, createdJob.id);

    expect(completedJob).toMatchObject({
      status: "completed",
      filesProcessed: 2,
      rowsScanned: 2,
      imported: 0,
      duplicatesSkipped: 1,
      nonMusicSkipped: 1,
      skippedTracksSkipped: 0,
      invalidRowsSkipped: 0,
    });

    await app.close();
  });

  it("rejects a new import while another import job is still active", async () => {
    let resolveFetch: (() => void) | null = null;
    const fetchStarted = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });

    const spotify = createSpotifyMock({
      fetchTracks: vi.fn(async () => {
        await fetchStarted;
        return [];
      }),
    });

    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify,
    });
    configs.push(config);

    const files = [
      {
        filename: "Streaming_History_Audio_2024.json",
        contentType: "application/json",
        content: Buffer.from(
          JSON.stringify([
            makeImportRow({
              spotify_track_uri: "spotify:track:track-9",
            }),
          ]),
          "utf8",
        ),
      },
    ];

    const firstResponse = await createSpotifyHistoryImportJob(app, sessionCookie, files);

    expect(firstResponse.statusCode).toBe(202);

    const secondResponse = await createSpotifyHistoryImportJob(app, sessionCookie, files);

    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.json()).toMatchObject({
      message: "A Spotify history import is already running.",
    });

    resolveFetch?.();
    const createdJob = firstResponse.json() as { id: string };
    await waitForSpotifyHistoryImportJob(app, sessionCookie, createdJob.id);

    await app.close();
  });

  it("returns a 413 when an uploaded file exceeds 10 MB", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedApp();
    configs.push(config);

    const response = await createSpotifyHistoryImportJob(app, sessionCookie, [
      {
        filename: "Streaming_History_Audio_2024.json",
        contentType: "application/json",
        content: Buffer.alloc(10 * 1024 * 1024 + 1, 97),
      },
    ]);

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      message: "Spotify history uploads are limited to 10 MB per file.",
    });

    await app.close();
  });
});
