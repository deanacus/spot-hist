import { eq } from "drizzle-orm";

import type { SpotifyClient } from "../auth/spotify.js";
import type { DatabaseContext } from "../db/index.js";
import {
  albumDetails,
  albumArtists,
  albums,
  artistDetails,
  artists,
  plays,
  trackArtists,
  trackDetails,
  tracks,
} from "../db/schema.js";
import {
  getAccessToken,
  encodeCursor,
  decodeCursor,
} from "./repository.js";
import type {
  SpotifyAlbum,
  SpotifyAlbumDetail,
  SpotifyArtistDetail,
  SpotifyImage,
  SpotifyTrackDetail,
} from "../types/spotify.js";

const DETAIL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const refreshJobs = new Map<string, Promise<void>>();

type DetailStatus = "fresh" | "stale" | "missing";

type ImageSummary = {
  url: string;
  height: number | null;
  width: number | null;
};

type ArtistSummary = {
  id: string;
  name: string;
};

type AlbumSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  routeId?: string | null;
};

type TrackSummary = {
  id: string;
  name: string;
  durationMs: number;
  explicit: boolean;
  routeId?: string | null;
};

type RecentPlayItem = {
  id: number;
  playedAt: string;
  contextType: string | null;
  contextUri: string | null;
  track: TrackSummary;
  album: AlbumSummary;
  artists: ArtistSummary[];
};

type ArtistDetailPage = {
  detailStatus: DetailStatus;
  lastEnrichedAt: string | null;
  artist: {
    id: string;
    name: string;
    uri: string;
    href: string;
  };
  spotify: {
    url: string | null;
    popularity: number | null;
    followersTotal: number | null;
    genres: string[];
    images: ImageSummary[];
  };
  stats: {
    totalPlays: number;
    rank: number | null;
    uniqueTracks: number;
    uniqueAlbums: number;
    firstPlayedAt: string | null;
    lastPlayedAt: string | null;
  };
  topTracks: Array<{
    track: TrackSummary;
    album: AlbumSummary;
    playCount: number;
    lastPlayedAt: string | null;
  }>;
  topAlbums: Array<{
    album: AlbumSummary;
    albumType: string;
    artists: ArtistSummary[];
    playCount: number;
    lastPlayedAt: string | null;
  }>;
  recentPlays: RecentPlayItem[];
  catalogAlbums: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    releaseDate: string;
    releaseDatePrecision: string;
    albumType: string;
    totalTracks: number;
    spotifyUrl: string | null;
    artists: ArtistSummary[];
    routeId: string | null;
  }>;
};

type AlbumDetailPage = {
  detailStatus: DetailStatus;
  lastEnrichedAt: string | null;
  album: {
    id: string;
    name: string;
    imageUrl: string | null;
    uri: string;
    href: string;
    releaseDate: string;
    releaseDatePrecision: string;
    albumType: string;
    totalTracks: number;
  };
  artists: ArtistSummary[];
  spotify: {
    url: string | null;
    label: string | null;
    popularity: number | null;
    genres: string[];
    images: ImageSummary[];
    copyrights: Array<{
      text: string;
      type: string;
    }>;
  };
  stats: {
    totalPlays: number;
    rank: number | null;
    uniquePlayedTracks: number;
    firstPlayedAt: string | null;
    lastPlayedAt: string | null;
  };
  tracklist: Array<{
    id: string;
    name: string;
    durationMs: number;
    explicit: boolean;
    discNumber: number;
    trackNumber: number;
    artists: ArtistSummary[];
    playCount: number;
    routeId: string | null;
  }>;
  recentPlays: RecentPlayItem[];
};

type TrackDetailPage = {
  detailStatus: DetailStatus;
  lastEnrichedAt: string | null;
  track: {
    id: string;
    name: string;
    durationMs: number;
    explicit: boolean;
    uri: string;
    href: string;
    previewUrl: string | null;
    isrc: string | null;
  };
  album: AlbumSummary & {
    uri: string;
    href: string;
    releaseDate: string;
    releaseDatePrecision: string;
    albumType: string;
    totalTracks: number;
  };
  artists: ArtistSummary[];
  spotify: {
    url: string | null;
    popularity: number | null;
    previewUrl: string | null;
    externalIds: Record<string, string>;
  };
  stats: {
    totalPlays: number;
    rank: number | null;
    firstPlayedAt: string | null;
    lastPlayedAt: string | null;
  };
  contextBreakdown: Array<{
    contextType: string;
    playCount: number;
  }>;
  recentPlays: RecentPlayItem[];
  albumTracklist: Array<{
    id: string;
    name: string;
    durationMs: number;
    explicit: boolean;
    discNumber: number;
    trackNumber: number;
    artists: ArtistSummary[];
    playCount: number;
    routeId: string | null;
    isCurrentTrack: boolean;
  }>;
};

type AlbumTracklistItem = AlbumDetailPage["tracklist"][number];
type TrackPageAlbumTracklistItem = TrackDetailPage["albumTracklist"][number];

type LocalArtistRow = typeof artists.$inferSelect;
type LocalAlbumRow = typeof albums.$inferSelect;
type LocalTrackRow = typeof tracks.$inferSelect;
type LocalArtistDetailRow = typeof artistDetails.$inferSelect;
type LocalAlbumDetailRow = typeof albumDetails.$inferSelect;
type LocalTrackDetailRow = typeof trackDetails.$inferSelect;

function isoNow() {
  return new Date().toISOString();
}

function nextRefreshAt(now = Date.now()) {
  return new Date(now + DETAIL_TTL_MS).toISOString();
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getDetailStatus(row: { refreshAfter: string } | null | undefined): DetailStatus {
  if (!row) {
    return "missing";
  }

  return Date.parse(row.refreshAfter) <= Date.now() ? "stale" : "fresh";
}

async function runRefreshJob(key: string, task: () => Promise<void>) {
  const existing = refreshJobs.get(key);
  if (existing) {
    await existing;
    return;
  }

  const promise = task().finally(() => {
    refreshJobs.delete(key);
  });
  refreshJobs.set(key, promise);
  await promise;
}

function mapImages(images: SpotifyImage[] | undefined): ImageSummary[] {
  return (images ?? []).map((image) => ({
    url: image.url,
    height: image.height,
    width: image.width,
  }));
}

async function getArtistBySpotifyId(database: DatabaseContext, spotifyId: string) {
  return database.db.query.artists.findFirst({
    where: eq(artists.spotifyId, spotifyId),
  });
}

async function getAlbumBySpotifyId(database: DatabaseContext, spotifyId: string) {
  return database.db.query.albums.findFirst({
    where: eq(albums.spotifyId, spotifyId),
  });
}

async function getTrackBySpotifyId(database: DatabaseContext, spotifyId: string) {
  return database.db.query.tracks.findFirst({
    where: eq(tracks.spotifyId, spotifyId),
  });
}

async function getArtistDetailRow(database: DatabaseContext, artistId: number) {
  return database.db.query.artistDetails.findFirst({
    where: eq(artistDetails.artistId, artistId),
  });
}

async function getAlbumDetailRow(database: DatabaseContext, albumId: number) {
  return database.db.query.albumDetails.findFirst({
    where: eq(albumDetails.albumId, albumId),
  });
}

async function getTrackDetailRow(database: DatabaseContext, trackId: number) {
  return database.db.query.trackDetails.findFirst({
    where: eq(trackDetails.trackId, trackId),
  });
}

async function requireSpotifyAccessToken(database: DatabaseContext, spotify: SpotifyClient) {
  const token = await getAccessToken(database, spotify);
  if (!token) {
    throw new Error("Spotify account is not connected");
  }

  return token.accessToken;
}

async function upsertArtistDetailCache(
  database: DatabaseContext,
  artistId: number,
  payload: {
    spotifyUrl: string | null;
    popularity: number | null;
    followersTotal: number | null;
    genresJson: string;
    imagesJson: string;
    catalogAlbumsJson: string;
    fetchedAt: string;
    refreshAfter: string;
  },
) {
  await database.db
    .insert(artistDetails)
    .values({
      artistId,
      ...payload,
    })
    .onConflictDoUpdate({
      target: artistDetails.artistId,
      set: payload,
    });
}

async function upsertAlbumDetailCache(
  database: DatabaseContext,
  albumId: number,
  payload: {
    spotifyUrl: string | null;
    label: string | null;
    popularity: number | null;
    genresJson: string;
    imagesJson: string;
    copyrightsJson: string;
    tracklistJson: string;
    fetchedAt: string;
    refreshAfter: string;
  },
) {
  await database.db
    .insert(albumDetails)
    .values({
      albumId,
      ...payload,
    })
    .onConflictDoUpdate({
      target: albumDetails.albumId,
      set: payload,
    });
}

async function upsertTrackDetailCache(
  database: DatabaseContext,
  trackId: number,
  payload: {
    spotifyUrl: string | null;
    popularity: number | null;
    previewUrl: string | null;
    externalIdsJson: string;
    fetchedAt: string;
    refreshAfter: string;
  },
) {
  await database.db
    .insert(trackDetails)
    .values({
      trackId,
      ...payload,
    })
    .onConflictDoUpdate({
      target: trackDetails.trackId,
      set: payload,
    });
}

function mapCatalogAlbum(
  album: SpotifyAlbum,
  localAlbumIds: Set<string>,
): ArtistDetailPage["catalogAlbums"][number] {
  return {
    id: album.id,
    name: album.name,
    imageUrl: album.images[0]?.url ?? null,
    releaseDate: album.release_date ?? "",
    releaseDatePrecision: album.release_date_precision ?? "day",
    albumType: album.album_type ?? "album",
    totalTracks: album.total_tracks ?? 0,
    spotifyUrl: album.external_urls?.spotify ?? null,
    artists: (album.artists ?? []).map((artist) => ({
      id: artist.id,
      name: artist.name,
    })),
    routeId: localAlbumIds.has(album.id) ? album.id : null,
  };
}

function isOwnReleaseType(albumType: string | null | undefined) {
  return albumType === "album" || albumType === "single";
}

function isPrimaryArtistCredit(
  artistId: string,
  creditedArtists: Array<{ id: string }> | null | undefined,
) {
  return (creditedArtists?.[0]?.id ?? null) === artistId;
}

function isOwnCatalogAlbum(artistId: string, album: SpotifyAlbum) {
  const releaseType = album.album_group ?? album.album_type;
  return isOwnReleaseType(releaseType) && isPrimaryArtistCredit(artistId, album.artists);
}

function isConservativeLocalOwnTopAlbum(
  artistId: string,
  item: {
    albumType: string;
    artists: ArtistSummary[];
  },
) {
  return (
    isOwnReleaseType(item.albumType) &&
    item.artists.length === 1 &&
    isPrimaryArtistCredit(artistId, item.artists)
  );
}

async function getAlbumIdSet(database: DatabaseContext, spotifyIds: string[]) {
  if (spotifyIds.length === 0) {
    return new Set<string>();
  }

  const placeholders = spotifyIds.map(() => "?").join(", ");
  const rows = database.client
    .prepare(`SELECT spotify_id FROM albums WHERE spotify_id IN (${placeholders})`)
    .all(...spotifyIds) as Array<{ spotify_id: string }>;

  return new Set(rows.map((row) => row.spotify_id));
}

async function refreshArtistCache(database: DatabaseContext, spotify: SpotifyClient, artist: LocalArtistRow) {
  const accessToken = await requireSpotifyAccessToken(database, spotify);
  const [artistDetail, artistAlbums] = await Promise.all([
    spotify.fetchArtist(accessToken, artist.spotifyId),
    spotify.fetchArtistAlbums(accessToken, artist.spotifyId, {
      includeGroups: ["album", "single"],
    }),
  ]);
  const ownArtistAlbums = artistAlbums.items.filter((album) => isOwnCatalogAlbum(artist.spotifyId, album));
  const localAlbumIds = await getAlbumIdSet(
    database,
    ownArtistAlbums.map((item) => item.id),
  );
  const fetchedAt = isoNow();

  await upsertArtistDetailCache(database, artist.id, {
    spotifyUrl: artistDetail.external_urls?.spotify ?? null,
    popularity: artistDetail.popularity,
    followersTotal: artistDetail.followers.total,
    genresJson: JSON.stringify(artistDetail.genres),
    imagesJson: JSON.stringify(mapImages(artistDetail.images)),
    catalogAlbumsJson: JSON.stringify(
      ownArtistAlbums.map((album) => mapCatalogAlbum(album, localAlbumIds)),
    ),
    fetchedAt,
    refreshAfter: nextRefreshAt(),
  });
}

async function refreshAlbumCacheByRow(
  database: DatabaseContext,
  spotify: SpotifyClient,
  album: LocalAlbumRow,
) {
  const accessToken = await requireSpotifyAccessToken(database, spotify);
  const albumDetail = await spotify.fetchAlbum(accessToken, album.spotifyId);
  const trackIds = await getLocalTrackIdSet(
    database,
    albumDetail.tracks.items.map((item) => item.id),
  );
  const fetchedAt = isoNow();

  await upsertAlbumDetailCache(database, album.id, {
    spotifyUrl: albumDetail.external_urls?.spotify ?? null,
    label: albumDetail.label ?? null,
    popularity: albumDetail.popularity,
    genresJson: JSON.stringify(albumDetail.genres),
    imagesJson: JSON.stringify(mapImages(albumDetail.images)),
    copyrightsJson: JSON.stringify(albumDetail.copyrights ?? []),
    tracklistJson: JSON.stringify(
      albumDetail.tracks.items.map((item) => ({
        id: item.id,
        name: item.name,
        durationMs: item.duration_ms,
        explicit: item.explicit,
        discNumber: item.disc_number,
        trackNumber: item.track_number,
        artists: item.artists.map((artist) => ({
          id: artist.id,
          name: artist.name,
        })),
        routeId: trackIds.has(item.id) ? item.id : null,
      })),
    ),
    fetchedAt,
    refreshAfter: nextRefreshAt(),
  });
}

async function refreshTrackCacheByRow(
  database: DatabaseContext,
  spotify: SpotifyClient,
  track: LocalTrackRow,
) {
  const accessToken = await requireSpotifyAccessToken(database, spotify);
  const trackDetail = await spotify.fetchTrack(accessToken, track.spotifyId);
  const fetchedAt = isoNow();

  await upsertTrackDetailCache(database, track.id, {
    spotifyUrl: trackDetail.external_urls?.spotify ?? null,
    popularity: trackDetail.popularity,
    previewUrl: trackDetail.preview_url,
    externalIdsJson: JSON.stringify(trackDetail.external_ids ?? {}),
    fetchedAt,
    refreshAfter: nextRefreshAt(),
  });

  const album = await database.db.query.albums.findFirst({
    where: eq(albums.id, track.albumId),
  });
  if (!album) {
    return;
  }

  const existingAlbumDetail = await getAlbumDetailRow(database, album.id);
  if (getDetailStatus(existingAlbumDetail) !== "fresh") {
    try {
      await runRefreshJob(`album:${album.spotifyId}`, () => refreshAlbumCacheByRow(database, spotify, album));
    } catch {
      // Track detail refresh should still succeed even if album enrichment is unavailable.
    }
  }
}

async function getArtistStats(database: DatabaseContext, artistId: number) {
  const row = database.client
    .prepare(
      `
      WITH ranked AS (
        SELECT
          artists.id AS artist_id,
          COUNT(plays.id) AS total_plays,
          COUNT(DISTINCT tracks.id) AS unique_tracks,
          COUNT(DISTINCT tracks.album_id) AS unique_albums,
          MIN(plays.played_at) AS first_played_at,
          MAX(plays.played_at) AS last_played_at,
          ROW_NUMBER() OVER (
            ORDER BY COUNT(plays.id) DESC, artists.name COLLATE NOCASE ASC, artists.spotify_id ASC
          ) AS rank
        FROM artists
        LEFT JOIN track_artists ON track_artists.artist_id = artists.id
        LEFT JOIN tracks ON tracks.id = track_artists.track_id
        LEFT JOIN plays ON plays.track_id = tracks.id
        GROUP BY artists.id
      )
      SELECT * FROM ranked WHERE artist_id = ?
      `,
    )
    .get(artistId) as
      | {
          total_plays: number;
          unique_tracks: number;
          unique_albums: number;
          first_played_at: string | null;
          last_played_at: string | null;
          rank: number | null;
        }
      | undefined;

  return {
    totalPlays: row?.total_plays ?? 0,
    rank: row?.rank ?? null,
    uniqueTracks: row?.unique_tracks ?? 0,
    uniqueAlbums: row?.unique_albums ?? 0,
    firstPlayedAt: row?.first_played_at ?? null,
    lastPlayedAt: row?.last_played_at ?? null,
  };
}

async function getAlbumStats(database: DatabaseContext, albumId: number) {
  const row = database.client
    .prepare(
      `
      WITH ranked AS (
        SELECT
          albums.id AS album_id,
          COUNT(plays.id) AS total_plays,
          COUNT(DISTINCT CASE WHEN plays.id IS NOT NULL THEN tracks.id END) AS unique_played_tracks,
          MIN(plays.played_at) AS first_played_at,
          MAX(plays.played_at) AS last_played_at,
          ROW_NUMBER() OVER (
            ORDER BY COUNT(plays.id) DESC, albums.name COLLATE NOCASE ASC, albums.spotify_id ASC
          ) AS rank
        FROM albums
        LEFT JOIN tracks ON tracks.album_id = albums.id
        LEFT JOIN plays ON plays.track_id = tracks.id
        GROUP BY albums.id
      )
      SELECT * FROM ranked WHERE album_id = ?
      `,
    )
    .get(albumId) as
      | {
          total_plays: number;
          unique_played_tracks: number;
          first_played_at: string | null;
          last_played_at: string | null;
          rank: number | null;
        }
      | undefined;

  return {
    totalPlays: row?.total_plays ?? 0,
    rank: row?.rank ?? null,
    uniquePlayedTracks: row?.unique_played_tracks ?? 0,
    firstPlayedAt: row?.first_played_at ?? null,
    lastPlayedAt: row?.last_played_at ?? null,
  };
}

async function getTrackStats(database: DatabaseContext, trackId: number) {
  const row = database.client
    .prepare(
      `
      WITH ranked AS (
        SELECT
          tracks.id AS track_id,
          COUNT(plays.id) AS total_plays,
          MIN(plays.played_at) AS first_played_at,
          MAX(plays.played_at) AS last_played_at,
          ROW_NUMBER() OVER (
            ORDER BY COUNT(plays.id) DESC, tracks.name COLLATE NOCASE ASC, tracks.spotify_id ASC
          ) AS rank
        FROM tracks
        LEFT JOIN plays ON plays.track_id = tracks.id
        GROUP BY tracks.id
      )
      SELECT * FROM ranked WHERE track_id = ?
      `,
    )
    .get(trackId) as
      | {
          total_plays: number;
          first_played_at: string | null;
          last_played_at: string | null;
          rank: number | null;
        }
      | undefined;

  return {
    totalPlays: row?.total_plays ?? 0,
    rank: row?.rank ?? null,
    firstPlayedAt: row?.first_played_at ?? null,
    lastPlayedAt: row?.last_played_at ?? null,
  };
}

async function getTrackArtistMap(database: DatabaseContext, trackIds: number[]) {
  if (trackIds.length === 0) {
    return new Map<number, ArtistSummary[]>();
  }

  const placeholders = trackIds.map(() => "?").join(", ");
  const rows = database.client
    .prepare(
      `
      SELECT track_artists.track_id AS owner_id, artists.spotify_id AS spotify_id, artists.name AS name
      FROM track_artists
      JOIN artists ON artists.id = track_artists.artist_id
      WHERE track_artists.track_id IN (${placeholders})
      ORDER BY track_artists.track_id ASC, artists.name COLLATE NOCASE ASC, artists.spotify_id ASC
      `,
    )
    .all(...trackIds) as Array<{ owner_id: number; spotify_id: string; name: string }>;

  const map = new Map<number, ArtistSummary[]>();
  for (const row of rows) {
    const current = map.get(row.owner_id) ?? [];
    current.push({
      id: row.spotify_id,
      name: row.name,
    });
    map.set(row.owner_id, current);
  }
  return map;
}

async function getAlbumArtistMap(database: DatabaseContext, albumIds: number[]) {
  if (albumIds.length === 0) {
    return new Map<number, ArtistSummary[]>();
  }

  const placeholders = albumIds.map(() => "?").join(", ");
  const rows = database.client
    .prepare(
      `
      SELECT album_artists.album_id AS owner_id, artists.spotify_id AS spotify_id, artists.name AS name
      FROM album_artists
      JOIN artists ON artists.id = album_artists.artist_id
      WHERE album_artists.album_id IN (${placeholders})
      ORDER BY album_artists.album_id ASC, artists.name COLLATE NOCASE ASC, artists.spotify_id ASC
      `,
    )
    .all(...albumIds) as Array<{ owner_id: number; spotify_id: string; name: string }>;

  const map = new Map<number, ArtistSummary[]>();
  for (const row of rows) {
    const current = map.get(row.owner_id) ?? [];
    current.push({
      id: row.spotify_id,
      name: row.name,
    });
    map.set(row.owner_id, current);
  }
  return map;
}

async function getTopTracksForArtist(database: DatabaseContext, artistId: number, limit = 10) {
  const rows = database.client
    .prepare(
      `
      SELECT
        tracks.id AS track_id,
        tracks.spotify_id AS track_spotify_id,
        tracks.name AS track_name,
        tracks.duration_ms AS duration_ms,
        tracks.explicit AS explicit,
        albums.spotify_id AS album_spotify_id,
        albums.name AS album_name,
        albums.image_url AS album_image_url,
        COUNT(plays.id) AS play_count,
        MAX(plays.played_at) AS last_played_at
      FROM track_artists
      JOIN tracks ON tracks.id = track_artists.track_id
      JOIN albums ON albums.id = tracks.album_id
      LEFT JOIN plays ON plays.track_id = tracks.id
      WHERE track_artists.artist_id = ?
      GROUP BY tracks.id
      ORDER BY play_count DESC, tracks.name COLLATE NOCASE ASC, tracks.spotify_id ASC
      LIMIT ?
      `,
    )
    .all(artistId, limit) as Array<{
      track_id: number;
      track_spotify_id: string;
      track_name: string;
      duration_ms: number;
      explicit: number;
      album_spotify_id: string;
      album_name: string;
      album_image_url: string | null;
      play_count: number;
      last_played_at: string | null;
    }>;

  const artistMap = await getTrackArtistMap(
    database,
    rows.map((row) => row.track_id),
  );

  return rows.map((row) => ({
    track: {
      id: row.track_spotify_id,
      name: row.track_name,
      durationMs: row.duration_ms,
      explicit: Boolean(row.explicit),
      routeId: row.track_spotify_id,
    },
    album: {
      id: row.album_spotify_id,
      name: row.album_name,
      imageUrl: row.album_image_url,
      routeId: row.album_spotify_id,
    },
    artists: artistMap.get(row.track_id) ?? [],
    playCount: row.play_count,
    lastPlayedAt: row.last_played_at,
  }));
}

async function getTopAlbumsForArtist(database: DatabaseContext, artistId: number) {
  const rows = database.client
    .prepare(
      `
      SELECT
        albums.id AS album_id,
        albums.spotify_id AS album_spotify_id,
        albums.name AS album_name,
        albums.image_url AS album_image_url,
        albums.album_type AS album_type,
        COUNT(plays.id) AS play_count,
        MAX(plays.played_at) AS last_played_at
      FROM track_artists
      JOIN tracks ON tracks.id = track_artists.track_id
      JOIN albums ON albums.id = tracks.album_id
      LEFT JOIN plays ON plays.track_id = tracks.id
      WHERE track_artists.artist_id = ?
      GROUP BY albums.id
      ORDER BY play_count DESC, albums.name COLLATE NOCASE ASC, albums.spotify_id ASC
      `,
    )
    .all(artistId) as Array<{
      album_id: number;
      album_spotify_id: string;
      album_name: string;
      album_image_url: string | null;
      album_type: string;
      play_count: number;
      last_played_at: string | null;
    }>;

  const artistMap = await getAlbumArtistMap(
    database,
    rows.map((row) => row.album_id),
  );

  return rows.map((row) => ({
    album: {
      id: row.album_spotify_id,
      name: row.album_name,
      imageUrl: row.album_image_url,
      routeId: row.album_spotify_id,
    },
    albumType: row.album_type,
    artists: artistMap.get(row.album_id) ?? [],
    playCount: row.play_count,
    lastPlayedAt: row.last_played_at,
  }));
}

async function getAlbumArtists(database: DatabaseContext, albumId: number) {
  return (await getAlbumArtistMap(database, [albumId])).get(albumId) ?? [];
}

async function getTrackArtists(database: DatabaseContext, trackId: number) {
  return (await getTrackArtistMap(database, [trackId])).get(trackId) ?? [];
}

async function getRecentPlays(database: DatabaseContext, whereSql: string, params: unknown[], limit = 5) {
  const rows = database.client
    .prepare(
      `
      SELECT
        plays.id AS play_id,
        plays.played_at AS played_at,
        plays.context_type AS context_type,
        plays.context_uri AS context_uri,
        tracks.id AS track_id,
        tracks.spotify_id AS track_spotify_id,
        tracks.name AS track_name,
        tracks.duration_ms AS track_duration_ms,
        tracks.explicit AS track_explicit,
        albums.id AS album_id,
        albums.spotify_id AS album_spotify_id,
        albums.name AS album_name,
        albums.image_url AS album_image_url
      FROM plays
      JOIN tracks ON tracks.id = plays.track_id
      JOIN albums ON albums.id = tracks.album_id
      ${whereSql}
      ORDER BY plays.played_at DESC, plays.id DESC
      LIMIT ?
      `,
    )
    .all(...params, limit) as Array<{
      play_id: number;
      played_at: string;
      context_type: string | null;
      context_uri: string | null;
      track_id: number;
      track_spotify_id: string;
      track_name: string;
      track_duration_ms: number;
      track_explicit: number;
      album_id: number;
      album_spotify_id: string;
      album_name: string;
      album_image_url: string | null;
    }>;

  const artistMap = await getTrackArtistMap(
    database,
    rows.map((row) => row.track_id),
  );

  return rows.map((row) => ({
    id: row.play_id,
    playedAt: row.played_at,
    contextType: row.context_type,
    contextUri: row.context_uri,
    track: {
      id: row.track_spotify_id,
      name: row.track_name,
      durationMs: row.track_duration_ms,
      explicit: Boolean(row.track_explicit),
      routeId: row.track_spotify_id,
    },
    album: {
      id: row.album_spotify_id,
      name: row.album_name,
      imageUrl: row.album_image_url,
      routeId: row.album_spotify_id,
    },
    artists: artistMap.get(row.track_id) ?? [],
  })) satisfies RecentPlayItem[];
}

async function getRecentPlaysForArtist(database: DatabaseContext, artistId: number) {
  return getRecentPlays(
    database,
    `
    JOIN track_artists filter_track_artists
      ON filter_track_artists.track_id = tracks.id
     AND filter_track_artists.artist_id = ?
    `,
    [artistId],
  );
}

async function getRecentPlaysForAlbum(database: DatabaseContext, albumId: number) {
  return getRecentPlays(database, `WHERE albums.id = ?`, [albumId]);
}

async function getRecentPlaysForTrack(database: DatabaseContext, trackId: number) {
  return getRecentPlays(database, `WHERE tracks.id = ?`, [trackId]);
}

async function getRecentPlaysPageForArtist(
  database: DatabaseContext,
  artistId: number,
  limit: number,
  cursor: string | undefined,
) {
  return getRecentPlaysPage(
    database,
    limit,
    cursor,
    `
    JOIN track_artists filter_track_artists
      ON filter_track_artists.track_id = tracks.id
     AND filter_track_artists.artist_id = ?
    `,
    [artistId],
  );
}

async function getRecentPlaysPageForAlbum(
  database: DatabaseContext,
  albumId: number,
  limit: number,
  cursor: string | undefined,
) {
  return getRecentPlaysPage(database, limit, cursor, `WHERE albums.id = ?`, [albumId]);
}

async function getRecentPlaysPageForTrack(
  database: DatabaseContext,
  trackId: number,
  limit: number,
  cursor: string | undefined,
) {
  return getRecentPlaysPage(database, limit, cursor, `WHERE tracks.id = ?`, [trackId]);
}

async function getRecentPlaysPage(
  database: DatabaseContext,
  limit: number,
  cursor: string | undefined,
  whereSql: string,
  params: unknown[],
) {
  const parsedCursor = decodeCursor(cursor);
  
  const rows = database.client
    .prepare(
      `
      SELECT
        plays.id AS play_id,
        plays.played_at AS played_at,
        plays.context_type AS context_type,
        plays.context_uri AS context_uri,
        tracks.id AS track_id,
        tracks.spotify_id AS track_spotify_id,
        tracks.name AS track_name,
        tracks.duration_ms AS track_duration_ms,
        tracks.explicit AS track_explicit,
        albums.id AS album_id,
        albums.spotify_id AS album_spotify_id,
        albums.name AS album_name,
        albums.image_url AS album_image_url
      FROM plays
      JOIN tracks ON tracks.id = plays.track_id
      JOIN albums ON albums.id = tracks.album_id
      ${whereSql}
      ${parsedCursor ? "AND (plays.played_at < ? OR (plays.played_at = ? AND plays.id < ?))" : ""}
      ORDER BY plays.played_at DESC, plays.id DESC
      LIMIT ?
      `,
    )
    .all(
      ...params,
      ...(parsedCursor ? [parsedCursor.playedAt, parsedCursor.playedAt, parsedCursor.id] : []),
      limit + 1,
    ) as Array<{
      play_id: number;
      played_at: string;
      context_type: string | null;
      context_uri: string | null;
      track_id: number;
      track_spotify_id: string;
      track_name: string;
      track_duration_ms: number;
      track_explicit: number;
      album_id: number;
      album_spotify_id: string;
      album_name: string;
      album_image_url: string | null;
    }>;

  const artistMap = await getTrackArtistMap(
    database,
    rows.map((row) => row.track_id),
  );

  const page = rows.slice(0, limit);
  const next = rows.length > limit ? page[limit - 1] : null;

  return {
    items: page.map((row) => ({
      id: row.play_id,
      playedAt: row.played_at,
      contextType: row.context_type,
      contextUri: row.context_uri,
      track: {
        id: row.track_spotify_id,
        name: row.track_name,
        durationMs: row.track_duration_ms,
        explicit: Boolean(row.track_explicit),
        routeId: row.track_spotify_id,
      },
      album: {
        id: row.album_spotify_id,
        name: row.album_name,
        imageUrl: row.album_image_url,
        routeId: row.album_spotify_id,
      },
      artists: artistMap.get(row.track_id) ?? [],
    })),
    nextCursor: next ? encodeCursor({ playedAt: next.played_at, id: next.play_id }) : null,
  };
}

async function getLocalTrackIdSet(database: DatabaseContext, spotifyIds: string[]) {
  if (spotifyIds.length === 0) {
    return new Set<string>();
  }

  const placeholders = spotifyIds.map(() => "?").join(", ");
  const rows = database.client
    .prepare(`SELECT spotify_id FROM tracks WHERE spotify_id IN (${placeholders})`)
    .all(...spotifyIds) as Array<{ spotify_id: string }>;

  return new Set(rows.map((row) => row.spotify_id));
}

async function getAlbumPlayCountMap(database: DatabaseContext, albumId: number) {
  const rows = database.client
    .prepare(
      `
      SELECT tracks.spotify_id AS spotify_id, COUNT(plays.id) AS play_count
      FROM tracks
      LEFT JOIN plays ON plays.track_id = tracks.id
      WHERE tracks.album_id = ?
      GROUP BY tracks.id
      `,
    )
    .all(albumId) as Array<{ spotify_id: string; play_count: number }>;

  return new Map(rows.map((row) => [row.spotify_id, row.play_count]));
}

async function getLocalAlbumTracklist(database: DatabaseContext, albumId: number) {
  const rows = database.client
    .prepare(
      `
      SELECT
        tracks.id AS track_id,
        tracks.spotify_id AS track_spotify_id,
        tracks.name AS track_name,
        tracks.duration_ms AS duration_ms,
        tracks.explicit AS explicit,
        tracks.disc_number AS disc_number,
        tracks.track_number AS track_number,
        COUNT(plays.id) AS play_count
      FROM tracks
      LEFT JOIN plays ON plays.track_id = tracks.id
      WHERE tracks.album_id = ?
      GROUP BY tracks.id
      ORDER BY tracks.disc_number ASC, tracks.track_number ASC, tracks.name COLLATE NOCASE ASC
      `,
    )
    .all(albumId) as Array<{
      track_id: number;
      track_spotify_id: string;
      track_name: string;
      duration_ms: number;
      explicit: number;
      disc_number: number;
      track_number: number;
      play_count: number;
    }>;

  const artistMap = await getTrackArtistMap(
    database,
    rows.map((row) => row.track_id),
  );

  return rows.map((row) => ({
    id: row.track_spotify_id,
    name: row.track_name,
    durationMs: row.duration_ms,
    explicit: Boolean(row.explicit),
    discNumber: row.disc_number,
    trackNumber: row.track_number,
    artists: artistMap.get(row.track_id) ?? [],
    playCount: row.play_count,
    routeId: row.track_spotify_id,
  }));
}

async function getTrackContextBreakdown(database: DatabaseContext, trackId: number) {
  const rows = database.client
    .prepare(
      `
      SELECT COALESCE(plays.context_type, 'direct') AS context_type, COUNT(plays.id) AS play_count
      FROM plays
      WHERE plays.track_id = ?
      GROUP BY COALESCE(plays.context_type, 'direct')
      ORDER BY play_count DESC, context_type ASC
      `,
    )
    .all(trackId) as Array<{ context_type: string; play_count: number }>;

  return rows.map((row) => ({
    contextType: row.context_type,
    playCount: row.play_count,
  }));
}

async function getArtistPage(database: DatabaseContext, artist: LocalArtistRow): Promise<ArtistDetailPage> {
  const [detailRow, stats, topTracks, topAlbums, recentPlays] = await Promise.all([
    getArtistDetailRow(database, artist.id),
    getArtistStats(database, artist.id),
    getTopTracksForArtist(database, artist.id),
    getTopAlbumsForArtist(database, artist.id),
    getRecentPlaysForArtist(database, artist.id),
  ]);
  const catalogAlbums = parseJson(detailRow?.catalogAlbumsJson, [] as ArtistDetailPage["catalogAlbums"]).filter(
    (album) => isOwnReleaseType(album.albumType) && isPrimaryArtistCredit(artist.spotifyId, album.artists),
  );
  const ownCatalogAlbumIds = new Set(catalogAlbums.map((album) => album.id));
  const filteredTopAlbums = topAlbums
    .filter((item) =>
      ownCatalogAlbumIds.size > 0
        ? ownCatalogAlbumIds.has(item.album.id)
        : isConservativeLocalOwnTopAlbum(artist.spotifyId, item),
    )
    .slice(0, 10);

  return {
    detailStatus: getDetailStatus(detailRow),
    lastEnrichedAt: detailRow?.fetchedAt ?? null,
    artist: {
      id: artist.spotifyId,
      name: artist.name,
      uri: artist.uri,
      href: artist.href,
    },
    spotify: {
      url: detailRow?.spotifyUrl ?? null,
      popularity: detailRow?.popularity ?? null,
      followersTotal: detailRow?.followersTotal ?? null,
      genres: parseJson(detailRow?.genresJson, [] as string[]),
      images: parseJson(detailRow?.imagesJson, [] as ImageSummary[]),
    },
    stats,
    topTracks: topTracks.map((item) => ({
      track: item.track,
      album: item.album,
      playCount: item.playCount,
      lastPlayedAt: item.lastPlayedAt,
    })),
    topAlbums: filteredTopAlbums
      .map((item) => ({
        album: item.album,
        albumType: item.albumType,
        artists: item.artists,
        playCount: item.playCount,
        lastPlayedAt: item.lastPlayedAt,
      })),
    recentPlays,
    catalogAlbums,
  };
}

async function getAlbumPage(database: DatabaseContext, album: LocalAlbumRow): Promise<AlbumDetailPage> {
  const [detailRow, artistsForAlbum, stats, recentPlays] = await Promise.all([
    getAlbumDetailRow(database, album.id),
    getAlbumArtists(database, album.id),
    getAlbumStats(database, album.id),
    getRecentPlaysForAlbum(database, album.id),
  ]);
  const tracklist = detailRow
    ? parseJson(detailRow.tracklistJson, [] as AlbumTracklistItem[])
    : await getLocalAlbumTracklist(database, album.id);
  const playCountMap = await getAlbumPlayCountMap(database, album.id);

  return {
    detailStatus: getDetailStatus(detailRow),
    lastEnrichedAt: detailRow?.fetchedAt ?? null,
    album: {
      id: album.spotifyId,
      name: album.name,
      imageUrl: album.imageUrl,
      uri: album.uri,
      href: album.href,
      releaseDate: album.releaseDate,
      releaseDatePrecision: album.releaseDatePrecision,
      albumType: album.albumType,
      totalTracks: album.totalTracks,
    },
    artists: artistsForAlbum,
    spotify: {
      url: detailRow?.spotifyUrl ?? null,
      label: detailRow?.label ?? null,
      popularity: detailRow?.popularity ?? null,
      genres: parseJson(detailRow?.genresJson, [] as string[]),
      images: parseJson(detailRow?.imagesJson, [] as ImageSummary[]),
      copyrights: parseJson(detailRow?.copyrightsJson, [] as AlbumDetailPage["spotify"]["copyrights"]),
    },
    stats,
    tracklist: tracklist.map((item) => ({
      ...item,
      playCount: playCountMap.get(item.id) ?? item.playCount ?? 0,
    })),
    recentPlays,
  };
}

async function getTrackPage(database: DatabaseContext, track: LocalTrackRow): Promise<TrackDetailPage> {
  const [detailRow, album, artistsForTrack, stats, recentPlays, contextBreakdown, albumDetailRow] =
    await Promise.all([
      getTrackDetailRow(database, track.id),
      database.db.query.albums.findFirst({
        where: eq(albums.id, track.albumId),
      }),
      getTrackArtists(database, track.id),
      getTrackStats(database, track.id),
      getRecentPlaysForTrack(database, track.id),
      getTrackContextBreakdown(database, track.id),
      getAlbumDetailRow(database, track.albumId),
    ]);

  if (!album) {
    throw new Error(`Album ${track.albumId} missing for track ${track.spotifyId}`);
  }

  const albumTracklistBase = albumDetailRow
    ? parseJson(
        albumDetailRow.tracklistJson,
        [] as Array<Omit<TrackPageAlbumTracklistItem, "playCount" | "isCurrentTrack"> & { playCount?: number }>,
      )
    : await getLocalAlbumTracklist(database, album.id);
  const playCountMap = await getAlbumPlayCountMap(database, album.id);

  return {
    detailStatus: getDetailStatus(detailRow),
    lastEnrichedAt: detailRow?.fetchedAt ?? null,
    track: {
      id: track.spotifyId,
      name: track.name,
      durationMs: track.durationMs,
      explicit: track.explicit,
      uri: track.uri,
      href: track.href,
      previewUrl: track.previewUrl,
      isrc: track.isrc,
    },
    album: {
      id: album.spotifyId,
      name: album.name,
      imageUrl: album.imageUrl,
      routeId: album.spotifyId,
      uri: album.uri,
      href: album.href,
      releaseDate: album.releaseDate,
      releaseDatePrecision: album.releaseDatePrecision,
      albumType: album.albumType,
      totalTracks: album.totalTracks,
    },
    artists: artistsForTrack,
    spotify: {
      url: detailRow?.spotifyUrl ?? null,
      popularity: detailRow?.popularity ?? null,
      previewUrl: detailRow?.previewUrl ?? track.previewUrl,
      externalIds: parseJson(detailRow?.externalIdsJson, {} as Record<string, string>),
    },
    stats,
    contextBreakdown,
    recentPlays,
    albumTracklist: albumTracklistBase.map((item) => ({
      ...item,
      playCount: playCountMap.get(item.id) ?? item.playCount ?? 0,
      isCurrentTrack: item.id === track.spotifyId,
    })),
  };
}

export async function getArtistDetailPage(database: DatabaseContext, spotifyId: string) {
  const artist = await getArtistBySpotifyId(database, spotifyId);
  if (!artist) {
    return null;
  }

  return getArtistPage(database, artist);
}

export async function getAlbumDetailPage(database: DatabaseContext, spotifyId: string) {
  const album = await getAlbumBySpotifyId(database, spotifyId);
  if (!album) {
    return null;
  }

  return getAlbumPage(database, album);
}

export async function getTrackDetailPage(database: DatabaseContext, spotifyId: string) {
  const track = await getTrackBySpotifyId(database, spotifyId);
  if (!track) {
    return null;
  }

  return getTrackPage(database, track);
}

export async function refreshArtistDetailPage(
  database: DatabaseContext,
  spotify: SpotifyClient,
  spotifyId: string,
) {
  const artist = await getArtistBySpotifyId(database, spotifyId);
  if (!artist) {
    return null;
  }

  await runRefreshJob(`artist:${spotifyId}`, () => refreshArtistCache(database, spotify, artist));
  return getArtistPage(database, artist);
}

export async function refreshAlbumDetailPage(
  database: DatabaseContext,
  spotify: SpotifyClient,
  spotifyId: string,
) {
  const album = await getAlbumBySpotifyId(database, spotifyId);
  if (!album) {
    return null;
  }

  await runRefreshJob(`album:${spotifyId}`, () => refreshAlbumCacheByRow(database, spotify, album));
  return getAlbumPage(database, album);
}

export async function refreshTrackDetailPage(
  database: DatabaseContext,
  spotify: SpotifyClient,
  spotifyId: string,
) {
  const track = await getTrackBySpotifyId(database, spotifyId);
  if (!track) {
    return null;
  }

  await runRefreshJob(`track:${spotifyId}`, () => refreshTrackCacheByRow(database, spotify, track));
  return getTrackPage(database, track);
}

export async function getArtistRecentPlaysPage(
  database: DatabaseContext,
  spotifyId: string,
  limit: number,
  cursor: string | undefined,
) {
  const artist = await getArtistBySpotifyId(database, spotifyId);
  if (!artist) {
    return null;
  }

  return getRecentPlaysPageForArtist(database, artist.id, limit, cursor);
}

export async function getAlbumRecentPlaysPage(
  database: DatabaseContext,
  spotifyId: string,
  limit: number,
  cursor: string | undefined,
) {
  const album = await getAlbumBySpotifyId(database, spotifyId);
  if (!album) {
    return null;
  }

  return getRecentPlaysPageForAlbum(database, album.id, limit, cursor);
}

export async function getTrackRecentPlaysPage(
  database: DatabaseContext,
  spotifyId: string,
  limit: number,
  cursor: string | undefined,
) {
  const track = await getTrackBySpotifyId(database, spotifyId);
  if (!track) {
    return null;
  }

  return getRecentPlaysPageForTrack(database, track.id, limit, cursor);
}
