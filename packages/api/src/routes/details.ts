import type { FastifyInstance } from "fastify";

import {
  getAlbumDetailPage,
  getArtistDetailPage,
  getTrackDetailPage,
  refreshAlbumDetailPage,
  refreshArtistDetailPage,
  refreshTrackDetailPage,
  getArtistRecentPlaysPage,
  getAlbumRecentPlaysPage,
  getTrackRecentPlaysPage,
} from "../services/details.js";
import {
  registerEntityPageRoute,
  registerEntityRecentPlaysRoute,
  registerEntityRefreshRoute,
} from "./shared.js";

export async function registerDetailRoutes(app: FastifyInstance) {
  registerEntityPageRoute(
    app,
    "/api/artists/:id",
    "Artist",
    (id) => getArtistDetailPage(app.locals.database, id),
  );

  registerEntityRefreshRoute(
    app,
    "/api/artists/:id/refresh",
    "Artist",
    "artist",
    "Unable to refresh artist details.",
    (id) => refreshArtistDetailPage(app.locals.database, app.locals.spotify, id),
  );

  registerEntityPageRoute(
    app,
    "/api/albums/:id",
    "Album",
    (id) => getAlbumDetailPage(app.locals.database, id),
  );

  registerEntityRefreshRoute(
    app,
    "/api/albums/:id/refresh",
    "Album",
    "album",
    "Unable to refresh album details.",
    (id) => refreshAlbumDetailPage(app.locals.database, app.locals.spotify, id),
  );

  registerEntityPageRoute(
    app,
    "/api/tracks/:id",
    "Track",
    (id) => getTrackDetailPage(app.locals.database, id),
  );

  registerEntityRefreshRoute(
    app,
    "/api/tracks/:id/refresh",
    "Track",
    "track",
    "Unable to refresh track details.",
    (id) => refreshTrackDetailPage(app.locals.database, app.locals.spotify, id),
  );

  registerEntityRecentPlaysRoute(
    app,
    "/api/artists/:id/recent-plays",
    "Artist",
    20,
    (id, limit, offset) => getArtistRecentPlaysPage(app.locals.database, id, limit, offset),
  );

  registerEntityRecentPlaysRoute(
    app,
    "/api/albums/:id/recent-plays",
    "Album",
    20,
    (id, limit, offset) => getAlbumRecentPlaysPage(app.locals.database, id, limit, offset),
  );

  registerEntityRecentPlaysRoute(
    app,
    "/api/tracks/:id/recent-plays",
    "Track",
    20,
    (id, limit, offset) => getTrackRecentPlaysPage(app.locals.database, id, limit, offset),
  );
}
