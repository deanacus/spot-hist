import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const appConfig = sqliteTable("app_config", {
  id: integer("id").primaryKey(),
  passwordHash: text("password_hash"),
  setupComplete: integer("setup_complete", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const account = sqliteTable("account", {
  id: integer("id").primaryKey(),
  spotifyId: text("spotify_id").notNull(),
  displayName: text("display_name"),
  email: text("email"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: text("token_expires_at").notNull(),
  pollCursor: integer("poll_cursor"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const artists = sqliteTable(
  "artists",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    spotifyId: text("spotify_id").notNull(),
    name: text("name").notNull(),
    uri: text("uri").notNull(),
    href: text("href").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    spotifyIdIdx: uniqueIndex("artists_spotify_id_idx").on(table.spotifyId),
  }),
);

export const albums = sqliteTable(
  "albums",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    spotifyId: text("spotify_id").notNull(),
    name: text("name").notNull(),
    albumType: text("album_type").notNull(),
    totalTracks: integer("total_tracks").notNull(),
    releaseDate: text("release_date").notNull(),
    releaseDatePrecision: text("release_date_precision").notNull(),
    uri: text("uri").notNull(),
    href: text("href").notNull(),
    imageUrl: text("image_url"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    spotifyIdIdx: uniqueIndex("albums_spotify_id_idx").on(table.spotifyId),
  }),
);

export const tracks = sqliteTable(
  "tracks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    spotifyId: text("spotify_id").notNull(),
    name: text("name").notNull(),
    albumId: integer("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "restrict" }),
    discNumber: integer("disc_number").notNull(),
    trackNumber: integer("track_number").notNull(),
    durationMs: integer("duration_ms").notNull(),
    explicit: integer("explicit", { mode: "boolean" }).notNull(),
    isrc: text("isrc"),
    uri: text("uri").notNull(),
    href: text("href").notNull(),
    previewUrl: text("preview_url"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    spotifyIdIdx: uniqueIndex("tracks_spotify_id_idx").on(table.spotifyId),
    albumIdx: index("tracks_album_id_idx").on(table.albumId),
  }),
);

export const plays = sqliteTable(
  "plays",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trackId: integer("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "restrict" }),
    playedAt: text("played_at").notNull(),
    contextType: text("context_type"),
    contextUri: text("context_uri"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    trackPlayedIdx: uniqueIndex("plays_track_id_played_at_idx").on(table.trackId, table.playedAt),
    playedAtIdx: index("plays_played_at_idx").on(table.playedAt),
  }),
);

export const trackArtists = sqliteTable(
  "track_artists",
  {
    trackId: integer("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    artistId: integer("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.trackId, table.artistId] }),
  }),
);

export const albumArtists = sqliteTable(
  "album_artists",
  {
    albumId: integer("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    artistId: integer("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.albumId, table.artistId] }),
  }),
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionTokenHash: text("session_token_hash").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    sessionTokenHashIdx: uniqueIndex("sessions_token_hash_idx").on(table.sessionTokenHash),
  }),
);

export const artistDetails = sqliteTable(
  "artist_details",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    artistId: integer("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    spotifyUrl: text("spotify_url"),
    popularity: integer("popularity"),
    followersTotal: integer("followers_total"),
    genresJson: text("genres_json"),
    imagesJson: text("images_json"),
    catalogAlbumsJson: text("catalog_albums_json"),
    fetchedAt: text("fetched_at").notNull(),
    refreshAfter: text("refresh_after").notNull(),
  },
  (table) => ({
    artistIdIdx: uniqueIndex("artist_details_artist_id_idx").on(table.artistId),
  }),
);

export const albumDetails = sqliteTable(
  "album_details",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    albumId: integer("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    spotifyUrl: text("spotify_url"),
    label: text("label"),
    popularity: integer("popularity"),
    genresJson: text("genres_json"),
    imagesJson: text("images_json"),
    copyrightsJson: text("copyrights_json"),
    tracklistJson: text("tracklist_json"),
    fetchedAt: text("fetched_at").notNull(),
    refreshAfter: text("refresh_after").notNull(),
  },
  (table) => ({
    albumIdIdx: uniqueIndex("album_details_album_id_idx").on(table.albumId),
  }),
);

export const trackDetails = sqliteTable(
  "track_details",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trackId: integer("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    spotifyUrl: text("spotify_url"),
    popularity: integer("popularity"),
    previewUrl: text("preview_url"),
    externalIdsJson: text("external_ids_json"),
    fetchedAt: text("fetched_at").notNull(),
    refreshAfter: text("refresh_after").notNull(),
  },
  (table) => ({
    trackIdIdx: uniqueIndex("track_details_track_id_idx").on(table.trackId),
  }),
);

export const schema = {
  account,
  albumDetails,
  albumArtists,
  albums,
  appConfig,
  artistDetails,
  artists,
  plays,
  sessions,
  trackDetails,
  trackArtists,
  tracks,
};
