import { afterEach, describe, expect, it } from "vitest";

import { createDatabase } from "../src/db/index.js";
import { createSpotifyClient } from "../src/auth/spotify.js";
import { persistRecentlyPlayedItems, storeConnectedAccount, getHistoryPage } from "../src/services/repository.js";
import { createTestConfig, cleanupConfig } from "./helpers.js";
import type { SpotifyRecentlyPlayedItem } from "../src/types/spotify.js";

describe("recently played persistence", () => {
  const configs: ReturnType<typeof createTestConfig>[] = [];

  afterEach(() => {
    for (const config of configs.splice(0)) {
      cleanupConfig(config);
    }
  });

  it("deduplicates overlapping play inserts", async () => {
    const config = createTestConfig();
    configs.push(config);

    const database = createDatabase(config);
    const spotify = createSpotifyClient(config);
    await storeConnectedAccount(database, spotify, {
      id: "spotify-user",
      display_name: "Listener",
      email: "listener@example.com",
    }, {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const item: SpotifyRecentlyPlayedItem = {
      played_at: "2024-01-01T00:00:00.000Z",
      context: {
        type: "playlist",
        uri: "spotify:playlist:1",
      },
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

    await persistRecentlyPlayedItems(database, [item, item]);
    const page = await getHistoryPage(database, 10, 0);
    expect(page.items).toHaveLength(1);

    database.client.close();
  });
});
