import { desc, eq } from "drizzle-orm";

import type { DatabaseContext } from "../db/index.js";
import {
  account,
  albumArtists,
  albums,
  appConfig,
  artists,
  plays,
  trackArtists,
  tracks,
} from "../db/schema.js";
import type { SpotifyClient } from "../auth/spotify.js";
import type { SpotifyRecentlyPlayedItem, SpotifyUserProfile } from "../types/spotify.js";

function isoNow() {
  return new Date().toISOString();
}

async function getAppConfig(database: DatabaseContext) {
  return database.db.query.appConfig.findFirst({
    where: eq(appConfig.id, 1),
  });
}

async function getAccount(database: DatabaseContext) {
  return database.db.query.account.findFirst({
    where: eq(account.id, 1),
  });
}

export async function ensurePassword(database: DatabaseContext, passwordHash: string) {
  const current = await getAppConfig(database);

  if (current?.setupComplete) {
    throw new Error("Setup already complete");
  }

  if (current?.passwordHash) {
    throw new Error("Password already set");
  }

  if (current) {
    await database.db
      .update(appConfig)
      .set({
        passwordHash,
      })
      .where(eq(appConfig.id, 1));
    return;
  }

  await database.db.insert(appConfig).values({
    id: 1,
    passwordHash,
    setupComplete: false,
    createdAt: isoNow(),
  });
}

async function updateSetupComplete(database: DatabaseContext, setupComplete: boolean) {
  const current = await getAppConfig(database);

  if (!current) {
    await database.db.insert(appConfig).values({
      id: 1,
      passwordHash: null,
      setupComplete,
      createdAt: isoNow(),
    });
    return;
  }

  await database.db
    .update(appConfig)
    .set({ setupComplete })
    .where(eq(appConfig.id, 1));
}

export async function getSetupStatus(database: DatabaseContext) {
  const [config, connectedAccount] = await Promise.all([getAppConfig(database), getAccount(database)]);

  return {
    setupComplete: Boolean(config?.setupComplete && connectedAccount),
    spotifyConnected: Boolean(connectedAccount),
    passwordSet: Boolean(config?.passwordHash),
  };
}

export async function storeConnectedAccount(
  database: DatabaseContext,
  spotify: SpotifyClient,
  profile: SpotifyUserProfile,
  tokens: { accessToken: string; refreshToken: string; expiresAt: string },
) {
  const current = await getAccount(database);
  const timestamp = isoNow();

  const values = {
    id: 1,
    spotifyId: profile.id,
    displayName: profile.display_name,
    email: profile.email ?? null,
    accessToken: spotify.encrypt(tokens.accessToken),
    refreshToken: spotify.encrypt(tokens.refreshToken),
    tokenExpiresAt: tokens.expiresAt,
    pollCursor: current?.pollCursor ?? null,
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  if (current) {
    await database.db.update(account).set(values).where(eq(account.id, 1));
  } else {
    await database.db.insert(account).values(values);
  }

  await updateSetupComplete(database, true);
}

export async function clearConnectedAccount(database: DatabaseContext) {
  await database.db.delete(account).where(eq(account.id, 1));
  await updateSetupComplete(database, false);
}

async function refreshAccountTokens(
  database: DatabaseContext,
  spotify: SpotifyClient,
  newTokens: { accessToken: string; refreshToken?: string; expiresAt: string },
) {
  const current = await getAccount(database);
  if (!current) {
    return null;
  }

  const refreshToken = newTokens.refreshToken
    ? spotify.encrypt(newTokens.refreshToken)
    : current.refreshToken;

  await database.db
    .update(account)
    .set({
      accessToken: spotify.encrypt(newTokens.accessToken),
      refreshToken,
      tokenExpiresAt: newTokens.expiresAt,
      updatedAt: isoNow(),
    })
    .where(eq(account.id, 1));

  return {
    ...current,
    accessToken: spotify.encrypt(newTokens.accessToken),
    refreshToken,
    tokenExpiresAt: newTokens.expiresAt,
  };
}

function upsertArtist(database: { db: any }, artist: SpotifyRecentlyPlayedItem["track"]["artists"][number]) {
  const timestamp = isoNow();
  database.db
    .insert(artists)
    .values({
      spotifyId: artist.id,
      name: artist.name,
      uri: artist.uri,
      href: artist.href,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: artists.spotifyId,
      set: {
        name: artist.name,
        uri: artist.uri,
        href: artist.href,
        updatedAt: timestamp,
      },
    });

  const row = database.db.query.artists.findFirst({
    where: eq(artists.spotifyId, artist.id),
  });
  if (!row) {
    throw new Error(`Artist ${artist.id} missing after upsert`);
  }
  return row;
}

function upsertAlbum(database: { db: any }, item: SpotifyRecentlyPlayedItem) {
  const timestamp = isoNow();
  const album = item.track.album;
  database.db
    .insert(albums)
    .values({
      spotifyId: album.id,
      name: album.name,
      albumType: album.album_type,
      totalTracks: album.total_tracks,
      releaseDate: album.release_date,
      releaseDatePrecision: album.release_date_precision,
      uri: album.uri,
      href: album.href,
      imageUrl: album.images[0]?.url ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: albums.spotifyId,
      set: {
        name: album.name,
        albumType: album.album_type,
        totalTracks: album.total_tracks,
        releaseDate: album.release_date,
        releaseDatePrecision: album.release_date_precision,
        uri: album.uri,
        href: album.href,
        imageUrl: album.images[0]?.url ?? null,
        updatedAt: timestamp,
      },
    });

  const row = database.db.query.albums.findFirst({
    where: eq(albums.spotifyId, album.id),
  });
  if (!row) {
    throw new Error(`Album ${album.id} missing after upsert`);
  }
  return row;
}

function upsertTrack(database: { db: any }, item: SpotifyRecentlyPlayedItem, albumId: number) {
  const track = item.track;
  const timestamp = isoNow();
  database.db
    .insert(tracks)
    .values({
      spotifyId: track.id,
      name: track.name,
      albumId,
      discNumber: track.disc_number,
      trackNumber: track.track_number,
      durationMs: track.duration_ms,
      explicit: track.explicit,
      isrc: track.external_ids?.isrc ?? null,
      uri: track.uri,
      href: track.href,
      previewUrl: track.preview_url,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: tracks.spotifyId,
      set: {
        name: track.name,
        albumId,
        discNumber: track.disc_number,
        trackNumber: track.track_number,
        durationMs: track.duration_ms,
        explicit: track.explicit,
        isrc: track.external_ids?.isrc ?? null,
        uri: track.uri,
        href: track.href,
        previewUrl: track.preview_url,
        updatedAt: timestamp,
      },
    });

  const row = database.db.query.tracks.findFirst({
    where: eq(tracks.spotifyId, track.id),
  });
  if (!row) {
    throw new Error(`Track ${track.id} missing after upsert`);
  }
  return row;
}

type IdRow = { id: number };

function requireIdRow(row: IdRow | undefined, message: string) {
  if (!row) {
    throw new Error(message);
  }

  return row.id;
}

function createArtistUpsertParams(
  artist: SpotifyRecentlyPlayedItem["track"]["artists"][number],
  timestamp: string,
) {
  return {
    spotify_id: artist.id,
    name: artist.name,
    uri: artist.uri,
    href: artist.href,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function upsertRelatedArtist(
  artist: SpotifyRecentlyPlayedItem["track"]["artists"][number],
  ownerId: number,
  timestamp: string,
  statements: {
    upsertArtist: { run: (params: ReturnType<typeof createArtistUpsertParams>) => unknown };
    selectArtist: { get: (spotifyId: string) => unknown };
    linkArtist: { run: (ownerId: number, artistId: number) => unknown };
  },
) {
  statements.upsertArtist.run(createArtistUpsertParams(artist, timestamp));

  const artistId = requireIdRow(
    statements.selectArtist.get(artist.id) as IdRow | undefined,
    `Artist ${artist.id} missing after upsert`,
  );

  statements.linkArtist.run(ownerId, artistId);
}

function persistSpotifyPlayedItems(
  database: DatabaseContext,
  items: SpotifyRecentlyPlayedItem[],
  options: { updatePollCursor: boolean },
) {
  const ordered = [...items].sort(
    (left, right) => Date.parse(left.played_at) - Date.parse(right.played_at),
  );

  const upsertArtistStmt = database.client.prepare(`
    INSERT INTO artists (spotify_id, name, uri, href, created_at, updated_at)
    VALUES (@spotify_id, @name, @uri, @href, @created_at, @updated_at)
    ON CONFLICT(spotify_id) DO UPDATE SET
      name = excluded.name,
      uri = excluded.uri,
      href = excluded.href,
      updated_at = excluded.updated_at
  `);
  const selectArtistStmt = database.client.prepare(
    "SELECT id FROM artists WHERE spotify_id = ?",
  );
  const upsertAlbumStmt = database.client.prepare(`
    INSERT INTO albums (
      spotify_id, name, album_type, total_tracks, release_date,
      release_date_precision, uri, href, image_url, created_at, updated_at
    )
    VALUES (
      @spotify_id, @name, @album_type, @total_tracks, @release_date,
      @release_date_precision, @uri, @href, @image_url, @created_at, @updated_at
    )
    ON CONFLICT(spotify_id) DO UPDATE SET
      name = excluded.name,
      album_type = excluded.album_type,
      total_tracks = excluded.total_tracks,
      release_date = excluded.release_date,
      release_date_precision = excluded.release_date_precision,
      uri = excluded.uri,
      href = excluded.href,
      image_url = excluded.image_url,
      updated_at = excluded.updated_at
  `);
  const selectAlbumStmt = database.client.prepare(
    "SELECT id FROM albums WHERE spotify_id = ?",
  );
  const upsertTrackStmt = database.client.prepare(`
    INSERT INTO tracks (
      spotify_id, name, album_id, disc_number, track_number, duration_ms,
      explicit, isrc, uri, href, preview_url, created_at, updated_at
    )
    VALUES (
      @spotify_id, @name, @album_id, @disc_number, @track_number, @duration_ms,
      @explicit, @isrc, @uri, @href, @preview_url, @created_at, @updated_at
    )
    ON CONFLICT(spotify_id) DO UPDATE SET
      name = excluded.name,
      album_id = excluded.album_id,
      disc_number = excluded.disc_number,
      track_number = excluded.track_number,
      duration_ms = excluded.duration_ms,
      explicit = excluded.explicit,
      isrc = excluded.isrc,
      uri = excluded.uri,
      href = excluded.href,
      preview_url = excluded.preview_url,
      updated_at = excluded.updated_at
  `);
  const selectTrackStmt = database.client.prepare(
    "SELECT id FROM tracks WHERE spotify_id = ?",
  );
  const insertAlbumArtistStmt = database.client.prepare(
    "INSERT OR IGNORE INTO album_artists (album_id, artist_id) VALUES (?, ?)",
  );
  const insertTrackArtistStmt = database.client.prepare(
    "INSERT OR IGNORE INTO track_artists (track_id, artist_id) VALUES (?, ?)",
  );
  const insertPlayStmt = database.client.prepare(`
    INSERT OR IGNORE INTO plays (track_id, played_at, context_type, context_uri, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const updateCursorStmt = database.client.prepare(
    "UPDATE account SET poll_cursor = ?, updated_at = ? WHERE id = 1",
  );

  const transaction = database.client.transaction((batch: SpotifyRecentlyPlayedItem[]) => {
    let insertedPlayCount = 0;

    for (const item of batch) {
      const timestamp = isoNow();
      const album = item.track.album;
      upsertAlbumStmt.run({
        spotify_id: album.id,
        name: album.name,
        album_type: album.album_type,
        total_tracks: album.total_tracks,
        release_date: album.release_date,
        release_date_precision: album.release_date_precision,
        uri: album.uri,
        href: album.href,
        image_url: album.images[0]?.url ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      });
      const albumId = requireIdRow(
        selectAlbumStmt.get(album.id) as IdRow | undefined,
        `Album ${album.id} missing after upsert`,
      );

      for (const artist of item.track.album.artists) {
        upsertRelatedArtist(artist, albumId, timestamp, {
          upsertArtist: upsertArtistStmt,
          selectArtist: selectArtistStmt,
          linkArtist: insertAlbumArtistStmt,
        });
      }

      upsertTrackStmt.run({
        spotify_id: item.track.id,
        name: item.track.name,
        album_id: albumId,
        disc_number: item.track.disc_number,
        track_number: item.track.track_number,
        duration_ms: item.track.duration_ms,
        explicit: item.track.explicit ? 1 : 0,
        isrc: item.track.external_ids?.isrc ?? null,
        uri: item.track.uri,
        href: item.track.href,
        preview_url: item.track.preview_url,
        created_at: timestamp,
        updated_at: timestamp,
      });
      const trackId = requireIdRow(
        selectTrackStmt.get(item.track.id) as IdRow | undefined,
        `Track ${item.track.id} missing after upsert`,
      );

      for (const artist of item.track.artists) {
        upsertRelatedArtist(artist, trackId, timestamp, {
          upsertArtist: upsertArtistStmt,
          selectArtist: selectArtistStmt,
          linkArtist: insertTrackArtistStmt,
        });
      }

      const insertPlayResult = insertPlayStmt.run(
        trackId,
        item.played_at,
        item.context?.type ?? null,
        item.context?.uri ?? null,
        timestamp,
      );

      insertedPlayCount += Number(insertPlayResult.changes ?? 0);
    }
    return insertedPlayCount;
  });
  const insertedPlayCount = transaction(ordered) as number;

  const newest = ordered.at(-1);
  if (options.updatePollCursor && newest) {
    updateCursorStmt.run(Date.parse(newest.played_at), isoNow());
  }

  return {
    insertedPlayCount,
  };
}

export async function persistRecentlyPlayedItems(
  database: DatabaseContext,
  items: SpotifyRecentlyPlayedItem[],
) {
  return persistSpotifyPlayedItems(database, items, { updatePollCursor: true });
}

export async function persistImportedPlayedItems(
  database: DatabaseContext,
  items: SpotifyRecentlyPlayedItem[],
) {
  return persistSpotifyPlayedItems(database, items, { updatePollCursor: false });
}

export async function getHistoryPage(
  database: DatabaseContext,
  limit: number,
  offset: number,
) {
  const total = getTotalCount(
    database,
    `
    SELECT COUNT(*) AS total
    FROM plays
    `,
  );

  const rows = getPagedRows<{
      play_id: number;
      played_at: string;
      context_type: string | null;
      context_uri: string | null;
      track_name: string;
      track_spotify_id: string;
      track_duration_ms: number;
      track_explicit: number;
      track_uri: string;
      track_preview_url: string | null;
      album_name: string;
      album_spotify_id: string;
      album_image_url: string | null;
      artists_json: string;
    }>(
    database,
    `
    SELECT
      plays.id AS play_id,
      plays.played_at AS played_at,
      plays.context_type AS context_type,
      plays.context_uri AS context_uri,
      tracks.name AS track_name,
      tracks.spotify_id AS track_spotify_id,
      tracks.duration_ms AS track_duration_ms,
      tracks.explicit AS track_explicit,
      tracks.uri AS track_uri,
      tracks.preview_url AS track_preview_url,
      albums.name AS album_name,
      albums.spotify_id AS album_spotify_id,
      albums.image_url AS album_image_url,
      (
        SELECT json_group_array(
          json_object(
            'id', artists.spotify_id,
            'name', artists.name
          )
        )
        FROM track_artists
        JOIN artists ON artists.id = track_artists.artist_id
        WHERE track_artists.track_id = tracks.id
      ) AS artists_json
    FROM plays
    JOIN tracks ON tracks.id = plays.track_id
    JOIN albums ON albums.id = tracks.album_id
    ORDER BY plays.played_at DESC, plays.id DESC
    LIMIT ?
    OFFSET ?
    `,
    limit,
    offset,
  );

  return buildPaginatedResult(
    rows.map((row) => ({
      id: row.play_id,
      playedAt: row.played_at,
      contextType: row.context_type,
      contextUri: row.context_uri,
      track: {
        id: row.track_spotify_id,
        name: row.track_name,
        durationMs: row.track_duration_ms,
        explicit: Boolean(row.track_explicit),
      },
      album: {
        id: row.album_spotify_id,
        name: row.album_name,
        imageUrl: row.album_image_url,
      },
      artists: JSON.parse(row.artists_json ?? "[]") as Array<{
        id: string;
        name: string;
      }>,
    })),
    total,
    offset,
    limit,
  );
}

export async function deleteHistoryItem(database: DatabaseContext, playId: number) {
  const result = database.client
    .prepare(
      `
      DELETE FROM plays
      WHERE id = ?
      `,
    )
    .run(playId);

  return Number(result.changes ?? 0) > 0;
}

interface TopArtistListItem {
  artist: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  playCount: number;
  lastPlayedAt: string | null;
}

interface TopAlbumListItem {
  album: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  artists: Array<{
    id: string;
    name: string;
  }>;
  playCount: number;
  lastPlayedAt: string | null;
}

interface TopTrackListItem {
  track: {
    id: string;
    name: string;
    durationMs: number;
    explicit: boolean;
  };
  album: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  artists: Array<{
    id: string;
    name: string;
  }>;
  playCount: number;
  lastPlayedAt: string | null;
}

type PaginatedResult<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};

function createPlaceholders(count: number) {
  return Array.from({ length: count }, () => "?").join(", ");
}

function parseFirstImageUrl(imagesJson: string | null) {
  if (!imagesJson) {
    return null;
  }

  try {
    const images = JSON.parse(imagesJson) as Array<{ url?: unknown }> | null;
    const firstUrl = images?.find((image) => typeof image?.url === "string")?.url;
    return typeof firstUrl === "string" ? firstUrl : null;
  } catch {
    return null;
  }
}

function getTotalCount(database: DatabaseContext, countSql: string, ...params: unknown[]) {
  const row = database.client.prepare(countSql).get(...params) as { total: number };
  return row.total;
}

function getPagedRows<TRow>(
  database: DatabaseContext,
  rowsSql: string,
  limit: number,
  offset: number,
) {
  return database.client.prepare(rowsSql).all(limit, offset) as TRow[];
}

function buildPaginatedResult<T>(
  items: T[],
  total: number,
  offset: number,
  limit: number,
): PaginatedResult<T> {
  return {
    items,
    total,
    offset,
    limit,
  };
}

function getOwnerArtistMap(
  database: DatabaseContext,
  relationTable: "track_artists" | "album_artists",
  ownerColumn: "track_id" | "album_id",
  ownerIds: number[],
) {
  if (ownerIds.length === 0) {
    return new Map<number, Array<{ id: string; name: string }>>();
  }

  const rows = database.client
    .prepare(
      `
      SELECT
        ${relationTable}.${ownerColumn} AS owner_id,
        artists.spotify_id AS spotify_id,
        artists.name AS name
      FROM ${relationTable}
      JOIN artists ON artists.id = ${relationTable}.artist_id
      WHERE ${relationTable}.${ownerColumn} IN (${createPlaceholders(ownerIds.length)})
      ORDER BY ${relationTable}.${ownerColumn} ASC, artists.name ASC, artists.spotify_id ASC
      `,
    )
    .all(...ownerIds) as Array<{
      owner_id: number;
      spotify_id: string;
      name: string;
    }>;

  const artistMap = new Map<number, Array<{ id: string; name: string }>>();
  for (const row of rows) {
    const current = artistMap.get(row.owner_id) ?? [];
    current.push({
      id: row.spotify_id,
      name: row.name,
    });
    artistMap.set(row.owner_id, current);
  }

  return artistMap;
}

function getTrackArtistMap(database: DatabaseContext, trackIds: number[]) {
  return getOwnerArtistMap(database, "track_artists", "track_id", trackIds);
}

function getAlbumArtistMap(database: DatabaseContext, albumIds: number[]) {
  return getOwnerArtistMap(database, "album_artists", "album_id", albumIds);
}

export async function getTopArtists(database: DatabaseContext, limit: number, offset: number) {
  const total = getTotalCount(
    database,
    `
    SELECT COUNT(DISTINCT artists.id) AS total
    FROM plays
    JOIN tracks ON tracks.id = plays.track_id
    JOIN track_artists ON track_artists.track_id = tracks.id
    JOIN artists ON artists.id = track_artists.artist_id
    `,
  );

  const rows = getPagedRows<{
      artist_spotify_id: string;
      artist_name: string;
      artist_images_json: string | null;
      play_count: number;
      last_played_at: string | null;
    }>(
    database,
    `
    SELECT
      artists.id AS artist_id,
      artists.spotify_id AS artist_spotify_id,
      artists.name AS artist_name,
      artist_details.images_json AS artist_images_json,
      COUNT(plays.id) AS play_count,
      MAX(plays.played_at) AS last_played_at
    FROM plays
    JOIN tracks ON tracks.id = plays.track_id
    JOIN track_artists ON track_artists.track_id = tracks.id
    JOIN artists ON artists.id = track_artists.artist_id
    LEFT JOIN artist_details ON artist_details.artist_id = artists.id
    GROUP BY artists.id
    ORDER BY play_count DESC, artists.name COLLATE NOCASE ASC, artists.spotify_id ASC
    LIMIT ?
    OFFSET ?
    `,
    limit,
    offset,
  );

  return buildPaginatedResult(
    rows.map((row) => ({
      artist: {
        id: row.artist_spotify_id,
        name: row.artist_name,
        imageUrl: parseFirstImageUrl(row.artist_images_json),
      },
      playCount: row.play_count,
      lastPlayedAt: row.last_played_at,
    })) satisfies TopArtistListItem[],
    total,
    offset,
    limit,
  );
}

export async function getTopAlbums(database: DatabaseContext, limit: number, offset: number) {
  const total = getTotalCount(
    database,
    `
    SELECT COUNT(DISTINCT albums.id) AS total
    FROM plays
    JOIN tracks ON tracks.id = plays.track_id
    JOIN albums ON albums.id = tracks.album_id
    `,
  );

  const rows = getPagedRows<{
      album_id: number;
      album_spotify_id: string;
      album_name: string;
      album_image_url: string | null;
      play_count: number;
      last_played_at: string | null;
    }>(
    database,
    `
    SELECT
      albums.id AS album_id,
      albums.spotify_id AS album_spotify_id,
      albums.name AS album_name,
      albums.image_url AS album_image_url,
      COUNT(plays.id) AS play_count,
      MAX(plays.played_at) AS last_played_at
    FROM plays
    JOIN tracks ON tracks.id = plays.track_id
    JOIN albums ON albums.id = tracks.album_id
    GROUP BY albums.id
    ORDER BY play_count DESC, albums.name COLLATE NOCASE ASC, albums.spotify_id ASC
    LIMIT ?
    OFFSET ?
    `,
    limit,
    offset,
  );

  const artistMap = getAlbumArtistMap(
    database,
    rows.map((row) => row.album_id),
  );

  return buildPaginatedResult(
    rows.map((row) => ({
      album: {
        id: row.album_spotify_id,
        name: row.album_name,
        imageUrl: row.album_image_url,
      },
      artists: artistMap.get(row.album_id) ?? [],
      playCount: row.play_count,
      lastPlayedAt: row.last_played_at,
    })) satisfies TopAlbumListItem[],
    total,
    offset,
    limit,
  );
}

export async function getTopTracks(database: DatabaseContext, limit: number, offset: number) {
  const total = getTotalCount(
    database,
    `
    SELECT COUNT(DISTINCT tracks.id) AS total
    FROM plays
    JOIN tracks ON tracks.id = plays.track_id
    `,
  );

  const rows = getPagedRows<{
      track_id: number;
      track_spotify_id: string;
      track_name: string;
      track_duration_ms: number;
      track_explicit: number;
      album_spotify_id: string;
      album_name: string;
      album_image_url: string | null;
      play_count: number;
      last_played_at: string | null;
    }>(
    database,
    `
    SELECT
      tracks.id AS track_id,
      tracks.spotify_id AS track_spotify_id,
      tracks.name AS track_name,
      tracks.duration_ms AS track_duration_ms,
      tracks.explicit AS track_explicit,
      albums.spotify_id AS album_spotify_id,
      albums.name AS album_name,
      albums.image_url AS album_image_url,
      COUNT(plays.id) AS play_count,
      MAX(plays.played_at) AS last_played_at
    FROM plays
    JOIN tracks ON tracks.id = plays.track_id
    JOIN albums ON albums.id = tracks.album_id
    GROUP BY tracks.id
    ORDER BY play_count DESC, tracks.name COLLATE NOCASE ASC, tracks.spotify_id ASC
    LIMIT ?
    OFFSET ?
    `,
    limit,
    offset,
  );

  const artistMap = getTrackArtistMap(
    database,
    rows.map((row) => row.track_id),
  );

  return buildPaginatedResult(
    rows.map((row) => ({
      track: {
        id: row.track_spotify_id,
        name: row.track_name,
        durationMs: row.track_duration_ms,
        explicit: Boolean(row.track_explicit),
      },
      album: {
        id: row.album_spotify_id,
        name: row.album_name,
        imageUrl: row.album_image_url,
      },
      artists: artistMap.get(row.track_id) ?? [],
      playCount: row.play_count,
      lastPlayedAt: row.last_played_at,
    })) satisfies TopTrackListItem[],
    total,
    offset,
    limit,
  );
}

export async function getStats(database: DatabaseContext) {
  const row = database.client
    .prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM plays) AS total_plays,
        (SELECT COUNT(*) FROM tracks) AS unique_tracks,
        (SELECT COUNT(*) FROM artists) AS unique_artists,
        (SELECT COUNT(*) FROM albums) AS unique_albums,
        (SELECT MAX(played_at) FROM plays) AS latest_played_at
      `,
    )
    .get() as {
      total_plays: number;
      unique_tracks: number;
      unique_artists: number;
      unique_albums: number;
      latest_played_at: string | null;
    };

  return {
    totalPlays: row.total_plays,
    uniqueTracks: row.unique_tracks,
    uniqueArtists: row.unique_artists,
    uniqueAlbums: row.unique_albums,
    latestPlayedAt: row.latest_played_at,
  };
}

export async function verifyPassword(database: DatabaseContext, password: string) {
  const config = await getAppConfig(database);
  return {
    passwordHash: config?.passwordHash ?? null,
    account: await getAccount(database),
  };
}

export async function getStatus(database: DatabaseContext) {
  return {
    config: await getAppConfig(database),
    account: await getAccount(database),
    latestPlay: await database.db.query.plays.findFirst({
      columns: {
        playedAt: true,
      },
      orderBy: desc(plays.playedAt),
    }),
  };
}

export async function getAccessToken(
  database: DatabaseContext,
  spotify: SpotifyClient,
) {
  const current = await getAccount(database);

  if (!current) {
    return null;
  }

  const refreshToken = spotify.decrypt(current.refreshToken);
  const expiresAtMs = Date.parse(current.tokenExpiresAt);
  if (expiresAtMs - Date.now() > 5 * 60_000) {
    return {
      accessToken: spotify.decrypt(current.accessToken),
      refreshToken,
      account: current,
    };
  }

  const refreshed = await spotify.refreshAccessToken(refreshToken);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await refreshAccountTokens(database, spotify, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt,
  });

  return {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? refreshToken,
    account: (await getAccount(database)) ?? current,
  };
}
