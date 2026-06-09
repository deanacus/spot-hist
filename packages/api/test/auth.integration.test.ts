import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import {
  cleanupConfig,
  connectSpotifyAccount,
  createAuthenticatedSession,
  createSpotifyMock,
  createTestConfig,
} from "./helpers.js";

async function createAuthApp(
  config: ReturnType<typeof createTestConfig>,
  spotifyOverrides: Parameters<typeof createSpotifyMock>[0] = {},
) {
  return buildApp({
    config,
    skipPoller: true,
    spotify: createSpotifyMock(spotifyOverrides),
  });
}

describe("auth and setup flow", () => {
  const configs: ReturnType<typeof createTestConfig>[] = [];

  afterEach(() => {
    for (const config of configs.splice(0)) {
      cleanupConfig(config);
    }
  });

  it("requires password setup before login succeeds", async () => {
    const config = createTestConfig();
    configs.push(config);

    const app = await createAuthApp(config, {
      buildAuthUrl: () => "https://example.com",
    });

    const before = await app.inject({
      method: "POST",
      url: "/api/auth/session",
      payload: { password: "secret" },
    });
    expect(before.statusCode).toBe(401);

    const setPassword = await app.inject({
      method: "POST",
      url: "/api/setup/password",
      payload: { password: "secret" },
    });
    expect(setPassword.statusCode).toBe(204);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/session",
      payload: { password: "secret" },
    });
    expect(login.statusCode).toBe(204);
    expect(login.cookies.some((cookie) => cookie.name === "spot_hist_session")).toBe(true);

    await app.close();
  });

  it("completes oauth callback and marks setup complete", async () => {
    const config = createTestConfig();
    configs.push(config);

    const app = await createAuthApp(config, {
      buildAuthUrl: (state) => `https://example.com/authorize?state=${state}`,
    });

    await connectSpotifyAccount(app);

    const status = await app.inject({
      method: "GET",
      url: "/api/setup/status",
    });
    expect(status.json()).toEqual({
      passwordSet: true,
      setupComplete: true,
      spotifyConnected: true,
    });

    await app.close();
  });

  it("returns the frontend status shape for authenticated sessions", async () => {
    const config = createTestConfig();
    configs.push(config);

    const app = await createAuthApp(config, {
      buildAuthUrl: (state) => `https://example.com/authorize?state=${state}`,
    });

    await connectSpotifyAccount(app);
    const sessionCookie = await createAuthenticatedSession(app);

    const status = await app.inject({
      method: "GET",
      url: "/api/status",
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      account: {
        spotifyId: "spotify-user",
        displayName: "Listener",
        email: "listener@example.com",
      },
      poller: {
        state: "idle",
        lastPollAt: null,
        lastPollResult: null,
      },
    });

    await app.close();
  });
});
