import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, lt } from "drizzle-orm";

import type { AppConfig } from "../config.js";
import type { DatabaseContext } from "../db/index.js";
import { sessions } from "../db/schema.js";

const SESSION_COOKIE = "spot_hist_session";

export interface AuthenticatedSession {
  id: number;
  token: string;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function now() {
  return new Date();
}

export async function createSession(database: DatabaseContext, config: AppConfig) {
  const token = randomBytes(32).toString("hex");
  const current = now();
  const expiresAt = new Date(current.getTime() + config.sessionIdleTimeoutMs).toISOString();

  const result = await database.db
    .insert(sessions)
    .values({
      sessionTokenHash: hashToken(token),
      lastSeenAt: current.toISOString(),
      expiresAt,
      createdAt: current.toISOString(),
    })
    .returning({ id: sessions.id });

  return {
    id: result[0]?.id ?? 0,
    token,
    expiresAt,
  };
}

export async function destroySession(database: DatabaseContext, token: string) {
  await database.db.delete(sessions).where(eq(sessions.sessionTokenHash, hashToken(token)));
}

export async function destroyExpiredSessions(database: DatabaseContext) {
  await database.db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString()));
}

export async function validateSession(
  database: DatabaseContext,
  config: AppConfig,
  token: string | undefined,
) {
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const row = await database.db.query.sessions.findFirst({
    where: eq(sessions.sessionTokenHash, tokenHash),
  });

  if (!row) {
    return null;
  }

  if (Date.parse(row.expiresAt) <= Date.now()) {
    await database.db.delete(sessions).where(eq(sessions.id, row.id));
    return null;
  }

  const nextExpiry = new Date(Date.now() + config.sessionIdleTimeoutMs).toISOString();
  await database.db
    .update(sessions)
    .set({
      lastSeenAt: new Date().toISOString(),
      expiresAt: nextExpiry,
    })
    .where(and(eq(sessions.id, row.id), eq(sessions.sessionTokenHash, tokenHash)));

  return {
    id: row.id,
    token,
    expiresAt: nextExpiry,
  };
}

export function attachSessionCookie(reply: FastifyReply, session: { token: string; expiresAt: string }) {
  reply.setCookie(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expiresAt),
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function requireSession(
  request: FastifyRequest,
  reply: FastifyReply,
  database: DatabaseContext,
  config: AppConfig,
) {
  const session = await validateSession(
    database,
    config,
    request.cookies[SESSION_COOKIE] as string | undefined,
  );

  if (!session) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  attachSessionCookie(reply, session);
  request.authSession = {
    id: session.id,
    token: session.token,
  };
}

declare module "fastify" {
  interface FastifyRequest {
    authSession?: AuthenticatedSession;
  }
}
