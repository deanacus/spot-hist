import type { FastifyInstance } from "fastify";

import { getTopAlbums, getTopArtists, getTopTracks } from "../services/repository.js";
import { registerPaginatedGetRoute } from "./shared.js";

export async function registerTopRoutes(app: FastifyInstance) {
  registerPaginatedGetRoute(
    app,
    "/api/top/artists",
    50,
    async (pagination) => {
      return getTopArtists(app.locals.database, pagination.limit, pagination.offset);
    },
  );

  registerPaginatedGetRoute(
    app,
    "/api/top/albums",
    50,
    async (pagination) => {
      return getTopAlbums(app.locals.database, pagination.limit, pagination.offset);
    },
  );

  registerPaginatedGetRoute(
    app,
    "/api/top/tracks",
    50,
    async (pagination) => {
      return getTopTracks(app.locals.database, pagination.limit, pagination.offset);
    },
  );
}
