import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  attachSessionCookie,
  clearSessionCookie,
  createSession,
  destroySession,
} from "../auth/session.js";
import {
  clearConnectedAccount,
  getSetupStatus,
  storeConnectedAccount,
  verifyPassword,
} from "../services/repository.js";

const OAUTH_STATE_COOKIE = "spot_hist_oauth_state";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/auth/login", async (_request, reply) => {
    const status = await getSetupStatus(app.locals.database);
    if (!status.passwordSet) {
      reply.redirect("/setup/complete?error=password_required");
      return;
    }

    const state = randomBytes(16).toString("hex");
    reply.setCookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + 10 * 60_000),
    });
    reply.redirect(app.locals.spotify.buildAuthUrl(state));
  });

  const handleCallback = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { code?: string; state?: string; error?: string } | undefined;
    const expectedState = request.cookies[OAUTH_STATE_COOKIE];

    if (query?.error) {
      request.log.warn({ spotifyError: query.error }, "Spotify OAuth callback returned an error.");
      reply.redirect(`/setup/complete?error=${encodeURIComponent(query.error)}`);
      return;
    }

    if (!query?.code || !query?.state || query.state !== expectedState) {
      request.log.warn(
        {
          hasCode: Boolean(query?.code),
          stateMatches: query?.state === expectedState,
        },
        "Spotify OAuth callback state validation failed.",
      );
      reply.code(400).redirect("/setup/complete?error=invalid_state");
      return;
    }

    try {
      const tokens = await app.locals.spotify.exchangeCode(query.code);
      const profile = await app.locals.spotify.fetchProfile(tokens.access_token);
      await storeConnectedAccount(app.locals.database, app.locals.spotify, profile, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      });
      reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
      reply.redirect("/setup/complete?success=1");
    } catch (error) {
      request.log.error({ err: error }, "Spotify OAuth callback persistence failed.");
      reply.redirect("/setup/complete?error=oauth_failed");
    }
  };

  app.get("/api/auth/callback", handleCallback);
  app.get("/auth/callback", handleCallback);

  app.post("/api/auth/session", async (request, reply) => {
    const body = request.body as { password?: string } | undefined;
    const password = body?.password;
    if (!password) {
      reply.code(400).send({ error: "Password is required" });
      return;
    }

    const { passwordHash } = await verifyPassword(app.locals.database, password);
    if (!passwordHash || !(await bcrypt.compare(password, passwordHash))) {
      reply.code(401).send({ error: "Invalid password" });
      return;
    }

    const session = await createSession(app.locals.database, app.locals.config);
    attachSessionCookie(reply, session);
    reply.code(204).send();
  });

  app.post(
    "/api/auth/logout",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      if (request.authSession) {
        await destroySession(app.locals.database, request.authSession.token);
      }
      clearSessionCookie(reply);
      reply.code(204).send();
    },
  );

  app.delete(
    "/api/auth/account",
    {
      preHandler: app.locals.requireSession,
    },
    async (_request, reply) => {
      await clearConnectedAccount(app.locals.database);
      clearSessionCookie(reply);
      reply.code(204).send();
    },
  );
}
