import type { FastifyInstance } from "fastify";

import { getTopAlbums, getTopArtists, getTopTracks } from "../services/repository.js";

function parsePaginationQuery(
  query: { limit?: string; offset?: string } | undefined,
  defaultLimit: number,
) {
  const limit = query?.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1) {
    return { error: "Invalid limit" } as const;
  }

  const offset = query?.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(offset) || offset < 0) {
    return { error: "Invalid offset" } as const;
  }

  return { limit, offset } as const;
}

export async function registerTopRoutes(app: FastifyInstance) {
  app.get(
    "/api/top/artists",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const query = request.query as { limit?: string; offset?: string } | undefined;
      const pagination = parsePaginationQuery(query, 50);
      if ("error" in pagination) {
        reply.code(400).send({ error: pagination.error });
        return;
      }

      return getTopArtists(app.locals.database, pagination.limit, pagination.offset);
    },
  );

  app.get(
    "/api/top/albums",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const query = request.query as { limit?: string; offset?: string } | undefined;
      const pagination = parsePaginationQuery(query, 50);
      if ("error" in pagination) {
        reply.code(400).send({ error: pagination.error });
        return;
      }

      return getTopAlbums(app.locals.database, pagination.limit, pagination.offset);
    },
  );

  app.get(
    "/api/top/tracks",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const query = request.query as { limit?: string; offset?: string } | undefined;
      const pagination = parsePaginationQuery(query, 50);
      if ("error" in pagination) {
        reply.code(400).send({ error: pagination.error });
        return;
      }

      return getTopTracks(app.locals.database, pagination.limit, pagination.offset);
    },
  );
}
