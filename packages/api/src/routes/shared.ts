import type { FastifyInstance, FastifyReply } from "fastify";

type PaginationQuery = { limit?: string; offset?: string } | undefined;
type EntityParams = { id: string };

export function notFound(reply: FastifyReply, entity: string) {
  reply.code(404).send({ message: `${entity} not found` });
}

export function parsePaginationQuery(query: PaginationQuery, defaultLimit: number) {
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

export function parsePositiveId(value: string | undefined) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    return null;
  }

  return id;
}

export function registerPaginatedGetRoute<T>(
  app: FastifyInstance,
  path: string,
  defaultLimit: number,
  loader: (pagination: { limit: number; offset: number }) => Promise<T>,
) {
  app.get(
    path,
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const query = request.query as PaginationQuery;
      const pagination = parsePaginationQuery(query, defaultLimit);
      if ("error" in pagination) {
        reply.code(400).send({ error: pagination.error });
        return;
      }

      return loader(pagination);
    },
  );
}

export function registerEntityPageRoute<T>(
  app: FastifyInstance,
  path: string,
  entity: string,
  loader: (id: string) => Promise<T | null>,
) {
  app.get(
    path,
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as EntityParams;
      const page = await loader(id);
      if (!page) {
        notFound(reply, entity);
        return;
      }

      return page;
    },
  );
}

export function registerEntityRefreshRoute<T>(
  app: FastifyInstance,
  path: string,
  entity: string,
  logEntity: string,
  errorMessage: string,
  loader: (id: string) => Promise<T | null>,
) {
  app.post(
    path,
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as EntityParams;

      try {
        const page = await loader(id);
        if (!page) {
          notFound(reply, entity);
          return;
        }

        return page;
      } catch (error) {
        app.log.warn({ err: error, entity: logEntity, id }, `${entity} detail refresh failed`);
        reply.code(502).send({ message: errorMessage });
      }
    },
  );
}

export function registerEntityRecentPlaysRoute<T>(
  app: FastifyInstance,
  path: string,
  entity: string,
  defaultLimit: number,
  loader: (id: string, limit: number, offset: number) => Promise<T | null>,
) {
  app.get(
    path,
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const { id } = request.params as EntityParams;
      const query = request.query as PaginationQuery;
      const pagination = parsePaginationQuery(query, defaultLimit);

      if ("error" in pagination) {
        reply.code(400).send({ error: pagination.error });
        return;
      }

      const page = await loader(id, pagination.limit, pagination.offset);
      if (!page) {
        notFound(reply, entity);
        return;
      }

      return page;
    },
  );
}
