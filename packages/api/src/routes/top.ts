import type { FastifyInstance } from "fastify";

import { getTopAlbums, getTopArtists, getTopTracks } from "../services/repository.js";

function parseLimit(raw: string | undefined) {
  const parsed = Number(raw ?? 50);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.min(Math.max(parsed, 1), 200);
}

export async function registerTopRoutes(app: FastifyInstance) {
  app.get(
    "/api/top/artists",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const query = request.query as { limit?: string } | undefined;
      const limit = parseLimit(query?.limit);
      if (limit === null) {
        reply.code(400).send({ error: "Invalid limit" });
        return;
      }

      return {
        items: await getTopArtists(app.locals.database, limit),
      };
    },
  );

  app.get(
    "/api/top/albums",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const query = request.query as { limit?: string } | undefined;
      const limit = parseLimit(query?.limit);
      if (limit === null) {
        reply.code(400).send({ error: "Invalid limit" });
        return;
      }

      return {
        items: await getTopAlbums(app.locals.database, limit),
      };
    },
  );

  app.get(
    "/api/top/tracks",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const query = request.query as { limit?: string } | undefined;
      const limit = parseLimit(query?.limit);
      if (limit === null) {
        reply.code(400).send({ error: "Invalid limit" });
        return;
      }

      return {
        items: await getTopTracks(app.locals.database, limit),
      };
    },
  );
}
