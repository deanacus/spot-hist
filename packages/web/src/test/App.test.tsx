import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "../lib/routes";
import { installFetchMock, renderApp, waitForPathname } from "./harness";

function makeAppStatus() {
  return {
    poller: {
      state: "running" as const,
      lastPollAt: "2026-06-03T06:00:00.000Z",
      lastPollResult: "Fetched 5 plays",
    },
    account: {
      displayName: "Dana",
      email: "dana@example.com",
      spotifyId: "user_1",
    },
  };
}

function makeStats() {
  return {
    totalPlays: 12,
    uniqueTracks: 10,
    uniqueArtists: 6,
    uniqueAlbums: 7,
    latestPlayAt: "2026-06-03T06:00:00.000Z",
  };
}

function makeHistoryItem(id: string, name: string, imageUrl: string | null = null) {
  return {
    id,
    playedAt: "2026-06-03T06:00:00.000Z",
    contextType: "playlist",
    contextUri: "spotify:playlist:test",
    track: {
      id: `track_${id}`,
      name,
      durationMs: 180000,
      explicit: false,
    },
    album: {
      id: `album_${id}`,
      name: "Signals",
      imageUrl,
    },
    artists: [{ id: `artist_${id}`, name: "North Coast" }],
  };
}

function makeTopArtist(id: string, name: string, imageUrl: string | null = null) {
  return {
    artist: {
      id,
      name,
      imageUrl,
    },
    playCount: 14,
    lastPlayedAt: "2026-06-03T06:00:00.000Z",
  };
}

function makeTopAlbum(id: string, name: string, imageUrl: string | null = "https://cdn.test/album.png") {
  return {
    album: {
      id,
      name,
      imageUrl,
    },
    artists: [{ id: `artist_${id}`, name: "North Coast" }],
    playCount: 9,
    lastPlayedAt: "2026-06-03T06:00:00.000Z",
  };
}

function makeTopTrack(id: string, name: string, imageUrl: string | null = "https://cdn.test/track.png") {
  return {
    track: {
      id,
      name,
      durationMs: 180000,
      explicit: false,
    },
    album: {
      id: `album_${id}`,
      name: "Signals",
      imageUrl,
    },
    artists: [{ id: `artist_${id}`, name: "North Coast" }],
    playCount: 11,
    lastPlayedAt: "2026-06-03T06:00:00.000Z",
  };
}

beforeEach(() => {
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("bootstrap routing", () => {
  it("routes first-run users to setup", async () => {
    installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: false, spotifyConnected: false, passwordSet: false },
      },
    });

    await renderApp("/");

    expect(await screen.findByText("Create the local password")).toBeInTheDocument();
    await waitForPathname("/setup");
  });

  it("routes configured users without a session to login", async () => {
    installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        status: 401,
        body: { message: "Unauthorized" },
      },
    });

    await renderApp("/");

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    await waitForPathname("/login");
  });

  it("routes active sessions to the dashboard", async () => {
    installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?limit=50": {
        body: {
          items: [makeHistoryItem("play_1", "Midnight Run", "https://cdn.test/signals.png")],
          nextCursor: null,
        },
      },
    });

    await renderApp("/");

    expect(await screen.findByText("Midnight Run")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Signals album art" })).toHaveAttribute(
      "src",
      "https://cdn.test/signals.png",
    );
    expect(screen.getByRole("heading", { name: "Listening overview" })).toBeInTheDocument();
    await waitForPathname(routes.dashboard);
  });
});

describe("query-driven auth flows", () => {
  it("invalidates bootstrap auth state after login and routes to the dashboard", async () => {
    const fetchMock = installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": [
        {
          status: 401,
          body: { message: "Unauthorized" },
        },
        {
          body: makeAppStatus(),
        },
      ],
      "POST /api/auth/session": {
        status: 204,
      },
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?limit=50": {
        body: {
          items: [makeHistoryItem("play_1", "Midnight Run")],
          nextCursor: null,
        },
      },
    });

    await renderApp("/login");

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Password/), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Midnight Run")).toBeInTheDocument();
    await waitForPathname("/dashboard");
    await waitFor(() => {
      expect(fetchMock.count("POST /api/auth/session")).toBe(1);
      expect(fetchMock.count("GET /api/status")).toBe(2);
    });

    expect(fetchMock.calls.map((call) => call.key)).toEqual([
      "GET /api/setup/status",
      "GET /api/status",
      "POST /api/auth/session",
      "GET /api/setup/status",
      "GET /api/status",
      "GET /api/stats",
      "GET /api/history?limit=50",
    ]);
  });

  it("completes setup success refresh once and routes to login without looping", async () => {
    const fetchMock = installFetchMock({
      "GET /api/setup/status": [
        {
          body: { setupComplete: false, spotifyConnected: false, passwordSet: true },
        },
        {
          body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
        },
      ],
      "GET /api/status": {
        status: 401,
        body: { message: "Unauthorized" },
      },
    });

    await renderApp("/setup/complete?success=1");

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    await waitForPathname("/login");
    await waitFor(() => {
      expect(fetchMock.count("GET /api/setup/status")).toBe(2);
      expect(fetchMock.count("GET /api/status")).toBe(1);
    });
  });
});

describe("dashboard history query", () => {
  it("renders the next page of listening history", async () => {
    const fetchMock = installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?limit=50": {
        body: {
          items: [makeHistoryItem("play_1", "Midnight Run")],
          nextCursor: "cursor_2",
        },
      },
      "GET /api/history?cursor=cursor_2&limit=50": {
        body: {
          items: [makeHistoryItem("play_2", "Dawn Echo")],
          nextCursor: null,
        },
      },
    });

    await renderApp("/dashboard");

    expect(await screen.findByText("Midnight Run")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Dawn Echo")).toBeInTheDocument();
    expect(fetchMock.calls.map((call) => call.url)).toContain("/api/history?cursor=cursor_2&limit=50");
  });
});

describe("top lists", () => {
  it("links dashboard metric cards to the entity index pages", async () => {
    installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?limit=50": {
        body: {
          items: [makeHistoryItem("play_1", "Midnight Run")],
          nextCursor: null,
        },
      },
      "GET /api/top/artists": {
        body: {
          items: [makeTopArtist("artist_1", "North Coast")],
        },
      },
    });

    await renderApp("/dashboard");

    expect(await screen.findByText("Midnight Run")).toBeInTheDocument();

    const artistsCardLink = screen
      .getAllByRole("link")
      .find((element) => element.getAttribute("href") === routes.artists);
    expect(artistsCardLink).toHaveAttribute("href", routes.artists);

    const albumsCardLink = screen
      .getAllByRole("link")
      .find((element) => element.getAttribute("href") === routes.albums);
    expect(albumsCardLink).toHaveAttribute("href", routes.albums);

    const tracksCardLink = screen
      .getAllByRole("link")
      .find((element) => element.getAttribute("href") === routes.tracks);
    expect(tracksCardLink).toHaveAttribute("href", routes.tracks);

    const user = userEvent.setup();
    await user.click(artistsCardLink!);

    expect(screen.getByText("North Coast")).toBeInTheDocument();
    await waitForPathname(routes.artists);
  });

  it("renders top albums with album art", async () => {
    installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/top/albums": {
        body: {
          items: [makeTopAlbum("album_1", "Signals", "https://cdn.test/signals.png")],
        },
      },
    });

    await renderApp(routes.albums);

    expect(await screen.findByText("Signals")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Signals album art" })).toHaveAttribute(
      "src",
      "https://cdn.test/signals.png",
    );
  });

  it("renders top artists with fallback artwork treatment", async () => {
    installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/top/artists": {
        body: {
          items: [makeTopArtist("artist_1", "North Coast")],
        },
      },
    });

    await renderApp(routes.artists);

    expect(await screen.findByText("North Coast")).toBeInTheDocument();
    expect(screen.getByLabelText("North Coast fallback artwork")).toBeInTheDocument();
  });

  it("renders top artists with Spotify artist images when available", async () => {
    installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/top/artists": {
        body: {
          items: [makeTopArtist("artist_1", "North Coast", "https://cdn.test/north-coast.png")],
        },
      },
    });

    await renderApp(routes.artists);

    expect(await screen.findByText("North Coast")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "North Coast artist image" })).toHaveAttribute(
      "src",
      "https://cdn.test/north-coast.png",
    );
  });

  it("renders top tracks empty state", async () => {
    installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/top/tracks": {
        body: {
          items: [],
        },
      },
    });

    await renderApp(routes.tracks);

    expect(await screen.findByText("No tracks yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tracks will appear here once the tracker has collected enough listening history to rank them.",
      ),
    ).toBeInTheDocument();
  });

  it("renders top tracks with album art", async () => {
    installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/top/tracks": {
        body: {
          items: [makeTopTrack("track_1", "Midnight Run", "https://cdn.test/midnight-run.png")],
        },
      },
    });

    await renderApp(routes.tracks);

    expect(await screen.findByText("Midnight Run")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Signals album art" })).toHaveAttribute(
      "src",
      "https://cdn.test/midnight-run.png",
    );
  });

  it("keeps the matching global nav section active on entity detail routes", async () => {
    installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/artists/artist_1": {
        body: {
          detailStatus: "fresh",
          lastEnrichedAt: "2026-06-03T06:00:00.000Z",
          artist: {
            id: "artist_1",
            name: "North Coast",
            uri: "spotify:artist:artist_1",
            href: "https://api.spotify.test/artists/artist_1",
          },
          spotify: {
            url: null,
            popularity: null,
            followersTotal: null,
            genres: [],
            images: [],
          },
          stats: {
            totalPlays: 10,
            rank: 1,
            uniqueTracks: 2,
            uniqueAlbums: 1,
            firstPlayedAt: "2026-06-01T00:00:00.000Z",
            lastPlayedAt: "2026-06-03T06:00:00.000Z",
          },
          topTracks: [],
          topAlbums: [],
          recentPlays: [],
          catalogAlbums: [],
        },
      },
    });

    await renderApp(routes.artist("artist_1"));

    const artistsNavLink = await screen.findByRole("link", { name: "Artists" });
    const tracksNavLink = screen.getByRole("link", { name: "Tracks" });

    expect(artistsNavLink.className).toContain("bg-(--accent)");
    expect(tracksNavLink.className).not.toContain("bg-(--accent)");
  });
});

describe("settings routing", () => {
  it("routes back to login after logout", async () => {
    const fetchMock = installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": [
        {
          body: makeAppStatus(),
        },
        {
          status: 401,
          body: { message: "Unauthorized" },
        },
      ],
      "POST /api/auth/logout": {
        status: 204,
      },
    });

    await renderApp("/settings");

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Logout" }));

    await waitForPathname("/login");
    await waitFor(() => {
      expect(fetchMock.count("POST /api/auth/logout")).toBe(1);
      expect(fetchMock.count("GET /api/status")).toBe(2);
    });
  });

  it("routes back to setup after disconnecting Spotify", async () => {
    const fetchMock = installFetchMock({
      "GET /api/setup/status": [
        {
          body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
        },
        {
          body: { setupComplete: false, spotifyConnected: false, passwordSet: true },
        },
      ],
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "DELETE /api/auth/account": {
        status: 204,
      },
    });

    await renderApp("/settings");

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Disconnect Spotify" }));

    await waitForPathname("/setup");
    expect(fetchMock.count("DELETE /api/auth/account")).toBe(1);
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });
});
