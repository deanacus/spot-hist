import type { FastifyInstance } from "fastify";

import { getReport, type ReportTimeframe } from "../services/reports.js";

const REPORT_TIMEFRAMES = new Set<ReportTimeframe>(["week", "month", "year", "5y", "all"]);

export async function registerReportRoutes(app: FastifyInstance) {
  app.get(
    "/api/reports",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const query = request.query as { timeframe?: string; offset?: string; timeZone?: string } | undefined;
      const timeframe = parseTimeframe(query?.timeframe);
      const offset = parseOffset(query?.offset);
      const timeZone = parseTimeZone(query?.timeZone);

      if (!timeframe) {
        reply.code(400).send({ error: "Invalid timeframe" });
        return;
      }

      if (offset === null) {
        reply.code(400).send({ error: "Invalid offset" });
        return;
      }

      if (timeZone === null) {
        reply.code(400).send({ error: "Invalid time zone" });
        return;
      }

      return getReport(app.locals.database, timeframe, offset, timeZone);
    },
  );
}

function parseTimeframe(value: string | undefined): ReportTimeframe | null {
  if (!value || !REPORT_TIMEFRAMES.has(value as ReportTimeframe)) {
    return null;
  }

  return value as ReportTimeframe;
}

function parseOffset(value: string | undefined) {
  if (value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function parseTimeZone(value: string | undefined) {
  if (!value) {
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value }).format(new Date());
    return value;
  } catch {
    return null;
  }
}
