import type { FastifyInstance, FastifyReply } from "fastify";

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

function notFound(reply: FastifyReply, entity: string) {
  reply.code(404).send({ message: `${entity} not found` });
}

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

export async function registerDetailRoutes(app: FastifyInstance) {
  app.get(
    "/api/artists/:id",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const page = await getArtistDetailPage(app.locals.database, id);
      if (!page) {
        notFound(reply, "Artist");
        return;
      }

      return page;
    },
  );

  app.post(
    "/api/artists/:id/refresh",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const page = await refreshArtistDetailPage(app.locals.database, app.locals.spotify, id);
        if (!page) {
          notFound(reply, "Artist");
          return;
        }

        return page;
      } catch (error) {
        app.log.warn({ err: error, entity: "artist", id }, "Artist detail refresh failed");
        reply.code(502).send({ message: "Unable to refresh artist details." });
      }
    },
  );

  app.get(
    "/api/albums/:id",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const page = await getAlbumDetailPage(app.locals.database, id);
      if (!page) {
        notFound(reply, "Album");
        return;
      }

      return page;
    },
  );

  app.post(
    "/api/albums/:id/refresh",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const page = await refreshAlbumDetailPage(app.locals.database, app.locals.spotify, id);
        if (!page) {
          notFound(reply, "Album");
          return;
        }

        return page;
      } catch (error) {
        app.log.warn({ err: error, entity: "album", id }, "Album detail refresh failed");
        reply.code(502).send({ message: "Unable to refresh album details." });
      }
    },
  );

  app.get(
    "/api/tracks/:id",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const page = await getTrackDetailPage(app.locals.database, id);
      if (!page) {
        notFound(reply, "Track");
        return;
      }

      return page;
    },
  );

  app.post(
    "/api/tracks/:id/refresh",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const page = await refreshTrackDetailPage(app.locals.database, app.locals.spotify, id);
        if (!page) {
          notFound(reply, "Track");
          return;
        }

        return page;
      } catch (error) {
        app.log.warn({ err: error, entity: "track", id }, "Track detail refresh failed");
        reply.code(502).send({ message: "Unable to refresh track details." });
      }
    },
  );

  app.get(
    "/api/artists/:id/recent-plays",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = request.query as { limit?: string; offset?: string } | undefined;
      const pagination = parsePaginationQuery(query, 20);

      if ("error" in pagination) {
        reply.code(400).send({ error: pagination.error });
        return;
      }

      const page = await getArtistRecentPlaysPage(
        app.locals.database,
        id,
        pagination.limit,
        pagination.offset,
      );
      if (!page) {
        notFound(reply, "Artist");
        return;
      }

      return page;
    },
  );

  app.get(
    "/api/albums/:id/recent-plays",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = request.query as { limit?: string; offset?: string } | undefined;
      const pagination = parsePaginationQuery(query, 20);

      if ("error" in pagination) {
        reply.code(400).send({ error: pagination.error });
        return;
      }

      const page = await getAlbumRecentPlaysPage(
        app.locals.database,
        id,
        pagination.limit,
        pagination.offset,
      );
      if (!page) {
        notFound(reply, "Album");
        return;
      }

      return page;
    },
  );

  app.get(
    "/api/tracks/:id/recent-plays",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = request.query as { limit?: string; offset?: string } | undefined;
      const pagination = parsePaginationQuery(query, 20);

      if ("error" in pagination) {
        reply.code(400).send({ error: pagination.error });
        return;
      }

      const page = await getTrackRecentPlaysPage(
        app.locals.database,
        id,
        pagination.limit,
        pagination.offset,
      );
      if (!page) {
        notFound(reply, "Track");
        return;
      }

      return page;
    },
  );
}
