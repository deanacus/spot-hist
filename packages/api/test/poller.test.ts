import { afterEach, describe, expect, it } from "vitest";

import { createPoller } from "../src/poller/index.js";
import { createDatabase } from "../src/db/index.js";
import { createSpotifyClient } from "../src/auth/spotify.js";
import { getHistoryPage, storeConnectedAccount } from "../src/services/repository.js";
import { createTestConfig, cleanupConfig } from "./helpers.js";
import type { SpotifyRecentlyPlayedItem } from "../src/types/spotify.js";

describe("poller", () => {
  const configs: ReturnType<typeof createTestConfig>[] = [];

  afterEach(() => {
    for (const config of configs.splice(0)) {
      cleanupConfig(config);
    }
  });

  it("fetches recently played items and persists them", async () => {
    const config = createTestConfig();
    configs.push(config);

    const database = createDatabase(config);
    const spotify = createSpotifyClient(config);
    await storeConnectedAccount(
      database,
      spotify,
      {
        id: "spotify-user",
        display_name: "Listener",
        email: "listener@example.com",
      },
      {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    );

    const item: SpotifyRecentlyPlayedItem = {
      played_at: "2024-01-01T00:00:00.000Z",
      context: null,
      track: {
        id: "track-1",
        name: "Song",
        album: {
          id: "album-1",
          name: "Album",
          album_type: "album",
          total_tracks: 10,
          release_date: "2024-01-01",
          release_date_precision: "day",
          uri: "spotify:album:1",
          href: "https://api.spotify.com/v1/albums/1",
          images: [{ url: "https://image", height: 640, width: 640 }],
          artists: [
            {
              id: "artist-1",
              name: "Artist",
              uri: "spotify:artist:1",
              href: "https://api.spotify.com/v1/artists/1",
            },
          ],
        },
        artists: [
          {
            id: "artist-1",
            name: "Artist",
            uri: "spotify:artist:1",
            href: "https://api.spotify.com/v1/artists/1",
          },
        ],
        disc_number: 1,
        track_number: 1,
        duration_ms: 120000,
        explicit: false,
        external_ids: {
          isrc: "ABC123",
        },
        uri: "spotify:track:1",
        href: "https://api.spotify.com/v1/tracks/1",
        preview_url: null,
      },
    };

    const poller = createPoller(
      database,
      {
        buildAuthUrl: () => "https://example.com",
        exchangeCode: async () => {
          throw new Error("Not used in poller test");
        },
        refreshAccessToken: async () => ({
          access_token: "new-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh-token",
          scope: "user-read-recently-played user-read-email",
        }),
        fetchProfile: async () => {
          throw new Error("Not used in poller test");
        },
        fetchRecentlyPlayed: async () => ({
          items: [item],
          next: null,
        }),
        encrypt: (value) => value,
        decrypt: (value) => value,
      },
      config,
    );

    await poller.trigger();

    const page = await getHistoryPage(database, 10, undefined);
    expect(page.items).toHaveLength(1);
    expect(poller.getState().lastSuccessAt).not.toBeNull();

    database.client.close();
  });
});
