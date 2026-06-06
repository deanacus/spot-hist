import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { createTestConfig, cleanupConfig } from "./helpers.js";

describe("auth and setup flow", () => {
  const configs: ReturnType<typeof createTestConfig>[] = [];

  beforeEach(() => {});

  afterEach(() => {
    for (const config of configs.splice(0)) {
      cleanupConfig(config);
    }
  });

  it("requires password setup before login succeeds", async () => {
    const config = createTestConfig();
    configs.push(config);

    const app = await buildApp({
      config,
      skipPoller: true,
      spotify: {
        buildAuthUrl: () => "https://example.com",
        exchangeCode: async () => ({
          access_token: "access",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh",
          scope: "user-read-recently-played user-read-email",
        }),
        refreshAccessToken: async () => ({
          access_token: "access",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh",
          scope: "user-read-recently-played user-read-email",
        }),
        fetchProfile: async () => ({
          id: "spotify-user",
          display_name: "Listener",
          email: "listener@example.com",
        }),
        fetchRecentlyPlayed: async () => ({
          items: [],
          next: null,
        }),
        encrypt: (value) => value,
        decrypt: (value) => value,
      },
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

    const app = await buildApp({
      config,
      skipPoller: true,
      spotify: {
        buildAuthUrl: (state) => `https://example.com/authorize?state=${state}`,
        exchangeCode: async () => ({
          access_token: "access",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh",
          scope: "user-read-recently-played user-read-email",
        }),
        refreshAccessToken: async () => ({
          access_token: "access",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh",
          scope: "user-read-recently-played user-read-email",
        }),
        fetchProfile: async () => ({
          id: "spotify-user",
          display_name: "Listener",
          email: "listener@example.com",
        }),
        fetchRecentlyPlayed: async () => ({
          items: [],
          next: null,
        }),
        encrypt: (value) => value,
        decrypt: (value) => value,
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/setup/password",
      payload: { password: "secret" },
    });

    const loginRedirect = await app.inject({
      method: "GET",
      url: "/api/auth/login",
    });
    const stateCookie = loginRedirect.cookies.find((cookie) => cookie.name === "spot_hist_oauth_state");
    expect(loginRedirect.statusCode).toBe(302);
    expect(stateCookie).toBeTruthy();

    const callback = await app.inject({
      method: "GET",
      url: `/api/auth/callback?code=code123&state=${stateCookie?.value}`,
      cookies: {
        spot_hist_oauth_state: stateCookie?.value ?? "",
      },
    });
    expect(callback.statusCode).toBe(302);

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

    const app = await buildApp({
      config,
      skipPoller: true,
      spotify: {
        buildAuthUrl: (state) => `https://example.com/authorize?state=${state}`,
        exchangeCode: async () => ({
          access_token: "access",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh",
          scope: "user-read-recently-played user-read-email",
        }),
        refreshAccessToken: async () => ({
          access_token: "access",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh",
          scope: "user-read-recently-played user-read-email",
        }),
        fetchProfile: async () => ({
          id: "spotify-user",
          display_name: "Listener",
          email: "listener@example.com",
        }),
        fetchRecentlyPlayed: async () => ({
          items: [],
          next: null,
        }),
        encrypt: (value) => value,
        decrypt: (value) => value,
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/setup/password",
      payload: { password: "secret" },
    });

    const loginRedirect = await app.inject({
      method: "GET",
      url: "/api/auth/login",
    });
    const stateCookie = loginRedirect.cookies.find((cookie) => cookie.name === "spot_hist_oauth_state");

    await app.inject({
      method: "GET",
      url: `/api/auth/callback?code=code123&state=${stateCookie?.value}`,
      cookies: {
        spot_hist_oauth_state: stateCookie?.value ?? "",
      },
    });

    const session = await app.inject({
      method: "POST",
      url: "/api/auth/session",
      payload: { password: "secret" },
    });
    const sessionCookie = session.cookies.find((cookie) => cookie.name === "spot_hist_session");
    expect(sessionCookie).toBeTruthy();

    const status = await app.inject({
      method: "GET",
      url: "/api/status",
      cookies: {
        spot_hist_session: sessionCookie?.value ?? "",
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
