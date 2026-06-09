import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "../lib/routes";
import { installFetchMock, renderApp, waitForPathname } from "./harness";
import {
  cancelScrobbleDeletion,
  expectNumberedPaginationFlow,
  installAuthenticatedFetchMock,
  makeAppStatus,
  makeImportJob,
  makePage,
  openScrobbleDeleteConfirmation,
} from "./helpers";

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


function makeHomeMocks() {
  return {
    "GET /api/stats": {
      body: makeStats(),
    },
    "GET /api/history?offset=0&limit=10": {
      body: makePage([makeHistoryItem("play_1", "Midnight Run", "https://cdn.test/signals.png")], {
        total: 11,
        limit: 10,
      }),
    },
    "GET /api/top/artists?offset=0&limit=10": {
      body: makePage([makeTopArtist("artist_1", "North Coast")], { limit: 10 }),
    },
    "GET /api/top/albums?offset=0&limit=10": {
      body: makePage([makeTopAlbum("album_1", "Signals", "https://cdn.test/signals.png")], { limit: 10 }),
    },
    "GET /api/top/tracks?offset=0&limit=10": {
      body: makePage([makeTopTrack("track_1", "Midnight Run", "https://cdn.test/midnight-run.png")], { limit: 10 }),
    },
  };
}

function makeScopedScrobblesRoute(section: "artists" | "albums" | "tracks", id: string) {
  return `/${section}/${id}/scrobbles`;
}

function makeScopedArtistDetail() {
  return {
    artist: { id: "artist_1", name: "North Coast" },
    stats: { totalPlays: 48 },
  };
}

function makeScopedAlbumDetail() {
  return {
    album: { id: "album_1", name: "Signals" },
    stats: { totalPlays: 31 },
  };
}

function makeScopedTrackDetail() {
  return {
    track: { id: "track_1", name: "Midnight Run" },
    stats: { totalPlays: 18 },
  };
}

beforeEach(() => {
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  vi.useRealTimers();
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

  it("routes active sessions to the home page", async () => {
    installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      ...makeHomeMocks(),
    });

    await renderApp("/");

    expect((await screen.findAllByText("Midnight Run")).length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("img", { name: "Signals album art" })
        .some((element) => element.getAttribute("src") === "https://cdn.test/signals.png"),
    ).toBe(true);
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    await waitForPathname(routes.home);
  });
});

describe("query-driven auth flows", () => {
  it("invalidates bootstrap auth state after login and routes to the home page", async () => {
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
      ...makeHomeMocks(),
    });

    await renderApp("/login");

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Password/), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect((await screen.findAllByText("Midnight Run")).length).toBeGreaterThan(0);
    await waitForPathname(routes.home);
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
      "GET /api/history?offset=0&limit=10",
      "GET /api/top/artists?offset=0&limit=10",
      "GET /api/top/albums?offset=0&limit=10",
      "GET /api/top/tracks?offset=0&limit=10",
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

describe("home page", () => {
  it("renders exactly the latest 10 scrobbles and no load more button", async () => {
    const fetchMock = installAuthenticatedFetchMock({
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?offset=0&limit=10": {
        body: makePage(
          Array.from({ length: 10 }, (_, index) => makeHistoryItem(`play_${index + 1}`, `Track ${index + 1}`)),
          { total: 11, limit: 10 },
        ),
      },
      "GET /api/top/artists?offset=0&limit=10": {
        body: makePage([makeTopArtist("artist_1", "North Coast")], { limit: 10 }),
      },
      "GET /api/top/albums?offset=0&limit=10": {
        body: makePage([makeTopAlbum("album_1", "Signals")], { limit: 10 }),
      },
      "GET /api/top/tracks?offset=0&limit=10": {
        body: makePage([makeTopTrack("track_1", "Midnight Run")], { limit: 10 }),
      },
    });

    await renderApp(routes.home);

    expect(await screen.findByText("Track 1")).toBeInTheDocument();
    expect(screen.getByText("Track 10")).toBeInTheDocument();
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Track 11")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more scrobbles" })).not.toBeInTheDocument();
    expect(fetchMock.count("GET /api/history?offset=0&limit=10")).toBe(1);
  });

  it("requests top lists with limit=10 and links to the full pages", async () => {
    const fetchMock = installAuthenticatedFetchMock(makeHomeMocks());

    await renderApp(routes.home);

    expect((await screen.findAllByText("North Coast")).length).toBeGreaterThan(0);
    expect(fetchMock.count("GET /api/top/artists?offset=0&limit=10")).toBe(1);
    expect(fetchMock.count("GET /api/top/albums?offset=0&limit=10")).toBe(1);
    expect(fetchMock.count("GET /api/top/tracks?offset=0&limit=10")).toBe(1);

    const scrobblesViewAllLink = screen
      .getAllByRole("link", { name: "View all" })
      .find((element) => element.getAttribute("href") === routes.scrobbles);
    expect(scrobblesViewAllLink).toHaveAttribute("href", routes.scrobbles);

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
  });
});

describe("scrobbles page", () => {
  it("uses numbered pagination routes for full history", async () => {
    const fetchMock = installAuthenticatedFetchMock({
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?offset=0&limit=50": {
        body: makePage([makeHistoryItem("play_1", "Midnight Run")], { total: 120, limit: 50 }),
      },
      "GET /api/history?offset=50&limit=50": {
        body: makePage([makeHistoryItem("play_2", "Dawn Echo")], { total: 120, offset: 50, limit: 50 }),
      },
    });

    await renderApp(routes.scrobbles);

    await expectNumberedPaginationFlow({
      pageOneLabel: "Midnight Run",
      pageTwoLabel: "Dawn Echo",
      nextPath: routes.scrobblesPage(2),
      previousPath: routes.scrobbles,
      expectedRequestUrl: "/api/history?offset=50&limit=50",
      fetchMock,
    });
  });

  it("shows scrobbles in the primary navigation and marks the section active", async () => {
    installAuthenticatedFetchMock({
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?offset=50&limit=50": {
        body: makePage([makeHistoryItem("play_1", "Midnight Run")], { total: 120, offset: 50, limit: 50 }),
      },
    });

    await renderApp(routes.scrobblesPage(2));

    const scrobblesNavLink = await screen.findByRole("link", { name: "Scrobbles" });

    expect(scrobblesNavLink.className).toContain("bg-(--accent)");
  });

  it("canonicalizes /page/1 back to the base scrobbles route", async () => {
    installAuthenticatedFetchMock({
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?offset=0&limit=50": {
        body: makePage([makeHistoryItem("play_1", "Midnight Run")], { total: 1, limit: 50 }),
      },
    });

    await renderApp("/scrobbles/page/1");

    expect(await screen.findByText("Midnight Run")).toBeInTheDocument();
    await waitForPathname(routes.scrobbles);
  });

  it("redirects an out-of-range scrobbles page path to the nearest valid page", async () => {
    installAuthenticatedFetchMock({
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?offset=4900&limit=50": {
        body: makePage([], { total: 120, offset: 4900, limit: 50 }),
      },
      "GET /api/history?offset=100&limit=50": {
        body: makePage([makeHistoryItem("play_3", "Last Valid Page")], { total: 120, offset: 100, limit: 50 }),
      },
    });

    await renderApp(routes.scrobblesPage(99));

    expect(await screen.findByText("Last Valid Page")).toBeInTheDocument();
    await waitForPathname(routes.scrobblesPage(3));
  });

  it("deletes an individual scrobble from the full scrobbles list", async () => {
    const fetchMock = installAuthenticatedFetchMock({
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?offset=0&limit=50": [
        {
          body: makePage([makeHistoryItem("play_1", "Midnight Run")], { total: 1, limit: 50 }),
        },
        {
          body: makePage([], { total: 0, limit: 50 }),
        },
      ],
      "DELETE /api/history/play_1": {
        status: 204,
      },
    });

    await renderApp(routes.scrobbles);
    expect(await screen.findByText("Midnight Run")).toBeInTheDocument();

    const { user } = await openScrobbleDeleteConfirmation();

    expect(screen.getByText("Delete this scrobble? This can’t be undone.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Midnight Run")).not.toBeInTheDocument();
    });

    expect(await screen.findByText("No scrobbles yet")).toBeInTheDocument();
    expect(fetchMock.count("DELETE /api/history/play_1")).toBe(1);
    expect(fetchMock.count("GET /api/history?offset=0&limit=50")).toBe(2);
  });

  it("cancels scrobble deletion without sending a delete request", async () => {
    const fetchMock = installAuthenticatedFetchMock({
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?offset=0&limit=50": {
        body: makePage([makeHistoryItem("play_1", "Midnight Run")], { total: 1, limit: 50 }),
      },
    });

    await renderApp(routes.scrobbles);

    expect(await screen.findByText("Midnight Run")).toBeInTheDocument();

    await cancelScrobbleDeletion();

    expect(screen.getByText("Midnight Run")).toBeInTheDocument();
    expect(fetchMock.count("DELETE /api/history/play_1")).toBe(0);
  });

  it("shows an inline error when scrobble deletion fails", async () => {
    const fetchMock = installAuthenticatedFetchMock({
      "GET /api/stats": {
        body: makeStats(),
      },
      "GET /api/history?offset=0&limit=50": {
        body: makePage([makeHistoryItem("play_1", "Midnight Run")], { total: 1, limit: 50 }),
      },
      "DELETE /api/history/play_1": {
        status: 500,
        body: { message: "Delete failed" },
      },
    });

    await renderApp(routes.scrobbles);

    expect(await screen.findByText("Midnight Run")).toBeInTheDocument();

    const { user } = await openScrobbleDeleteConfirmation();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
    expect(screen.getByText("Midnight Run")).toBeInTheDocument();
    expect(fetchMock.count("DELETE /api/history/play_1")).toBe(1);
    expect(fetchMock.count("GET /api/history?offset=0&limit=50")).toBe(1);
  });
});

describe("scoped scrobbles routes", () => {
  it.each([
    {
      route: makeScopedScrobblesRoute("artists", "artist_1"),
      detailRequest: "GET /api/artists/artist_1",
      detailBody: makeScopedArtistDetail(),
      scrobblesRequest: "GET /api/artists/artist_1/recent-plays?offset=0&limit=50",
      heading: "North Coast scrobbles",
    },
    {
      route: makeScopedScrobblesRoute("albums", "album_1"),
      detailRequest: "GET /api/albums/album_1",
      detailBody: makeScopedAlbumDetail(),
      scrobblesRequest: "GET /api/albums/album_1/recent-plays?offset=0&limit=50",
      heading: "Signals scrobbles",
    },
    {
      route: makeScopedScrobblesRoute("tracks", "track_1"),
      detailRequest: "GET /api/tracks/track_1",
      detailBody: makeScopedTrackDetail(),
      scrobblesRequest: "GET /api/tracks/track_1/recent-plays?offset=0&limit=50",
      heading: "Midnight Run scrobbles",
    },
  ])("matches $route for active sessions", async ({ route, detailRequest, detailBody, scrobblesRequest, heading }) => {
    installAuthenticatedFetchMock({
      [detailRequest]: {
        body: detailBody,
      },
      [scrobblesRequest]: {
        body: makePage([makeHistoryItem("play_1", "Midnight Run")], { total: 1, limit: 50 }),
      },
    });

    await renderApp(route);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    await waitForPathname(route);
  });
});

describe("top lists", () => {
  it("renders top albums with album art", async () => {
    installAuthenticatedFetchMock({
      "GET /api/top/albums?offset=0&limit=50": {
        body: makePage([makeTopAlbum("album_1", "Signals", "https://cdn.test/signals.png")], { limit: 50 }),
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
    installAuthenticatedFetchMock({
      "GET /api/top/artists?offset=0&limit=50": {
        body: makePage([makeTopArtist("artist_1", "North Coast")], { limit: 50 }),
      },
    });

    await renderApp(routes.artists);

    expect(await screen.findByText("North Coast")).toBeInTheDocument();
    expect(screen.getByLabelText("North Coast fallback artwork")).toBeInTheDocument();
  });

  it("renders top artists with Spotify artist images when available", async () => {
    installAuthenticatedFetchMock({
      "GET /api/top/artists?offset=0&limit=50": {
        body: makePage([makeTopArtist("artist_1", "North Coast", "https://cdn.test/north-coast.png")], { limit: 50 }),
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
    installAuthenticatedFetchMock({
      "GET /api/top/tracks?offset=0&limit=50": {
        body: makePage([], { limit: 50 }),
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
      "GET /api/top/tracks?offset=0&limit=50": {
        body: makePage([makeTopTrack("track_1", "Midnight Run", "https://cdn.test/midnight-run.png")], { limit: 50 }),
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
    const scrobblesNavLink = screen.getByRole("link", { name: "Scrobbles" });

    expect(artistsNavLink.className).toContain("bg-(--accent)");
    expect(scrobblesNavLink.className).not.toContain("bg-(--accent)");
  });

  it("uses numbered page routes on top artist pages", async () => {
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
      "GET /api/top/artists?offset=0&limit=50": {
        body: makePage(Array.from({ length: 50 }, (_, index) => makeTopArtist(`artist_${index + 1}`, `Artist ${index + 1}`)), {
          total: 260,
          limit: 50,
        }),
      },
      "GET /api/top/artists?offset=100&limit=50": {
        body: makePage([makeTopArtist("artist_101", "Artist 101")], {
          total: 260,
          offset: 100,
          limit: 50,
        }),
      },
    });

    await renderApp(routes.artistsPage(3));

    expect(await screen.findByText("Artist 101")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Artists" }).className).toContain("bg-(--accent)");
    expect(screen.getByText("3")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("canonicalizes /page/1 back to the base artist route", async () => {
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
      "GET /api/top/artists?offset=0&limit=50": {
        body: makePage([makeTopArtist("artist_1", "Artist 1")], { total: 1, limit: 50 }),
      },
    });

    await renderApp("/artists/page/1");

    expect(await screen.findByText("Artist 1")).toBeInTheDocument();
    await waitForPathname(routes.artists);
  });

  it("redirects an invalid artist page path back to the base route", async () => {
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
      "GET /api/top/artists?offset=0&limit=50": {
        body: makePage([makeTopArtist("artist_1", "Artist 1")], { total: 1, limit: 50 }),
      },
    });

    await renderApp("/artists/page/nope");

    expect(await screen.findByText("Artist 1")).toBeInTheDocument();
    await waitForPathname(routes.artists);
  });
});

describe("settings routing", () => {
  it("starts a Spotify history import job and renders the completed counters", async () => {
    const fetchMock = installFetchMock({
      "GET /api/setup/status": [
        {
          body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
        },
        {
          body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
        },
      ],
      "GET /api/status": [
        {
          body: makeAppStatus(),
        },
        {
          body: makeAppStatus(),
        },
      ],
      "GET /api/imports/spotify-history/latest": {
        body: null,
      },
      "POST /api/imports/spotify-history": {
        status: 202,
        body: makeImportJob(),
      },
      "GET /api/imports/spotify-history/job_1": {
        body: makeImportJob({
          status: "completed",
          phase: "finished",
          rowsScanned: 52,
          filesProcessed: 1,
          imported: 42,
          duplicatesSkipped: 7,
          nonMusicSkipped: 2,
          skippedTracksSkipped: 3,
          invalidRowsSkipped: 1,
          totalTrackIds: 44,
          resolvedTrackIds: 42,
          startedAt: "2026-06-03T06:00:05.000Z",
          completedAt: "2026-06-03T06:00:10.000Z",
          updatedAt: "2026-06-03T06:00:10.000Z",
        }),
      },
    });

    await renderApp("/settings");

    const user = userEvent.setup();
    const fileInput = await screen.findByLabelText("Export files");
    const file = new File(['{"endTime":"2025-01-01 00:00"}'], "Streaming_History_Audio_2025.json", {
      type: "application/json",
    });

    await user.upload(fileInput, file);
    await user.click(screen.getByRole("button", { name: "Start import" }));

    expect(await screen.findByText("Spotify history import completed.")).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getByText("Files Processed")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
    expect(screen.getByText("Skipped Tracks Skipped")).toBeInTheDocument();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getByText("Duplicates Skipped")).toBeInTheDocument();
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(fetchMock.count("POST /api/imports/spotify-history")).toBe(1);
      expect(fetchMock.count("GET /api/imports/spotify-history/job_1")).toBe(1);
    });

    expect(fetchMock.calls.find((call) => call.key === "POST /api/imports/spotify-history")?.bodyText).toBe(
      '[["file","Streaming_History_Audio_2025.json"]]',
    );
  });

  it("rejects unsupported import files before sending a request", async () => {
    const fetchMock = installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/imports/spotify-history/latest": {
        body: null,
      },
    });

    await renderApp("/settings");

    const user = userEvent.setup();
    const fileInput = await screen.findByLabelText("Export files");
    const file = new File(["not spotify history"], "notes.txt", {
      type: "text/plain",
    });

    fireEvent.change(fileInput, {
      target: {
        files: [file],
      },
    });

    expect(await screen.findByText("Only Spotify history `.zip` or `.json` exports are supported.")).toBeInTheDocument();
    expect(fetchMock.count("POST /api/imports/spotify-history")).toBe(0);
  });

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

  it("shows import request errors from the server", async () => {
    const fetchMock = installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/imports/spotify-history/latest": {
        body: null,
      },
      "POST /api/imports/spotify-history": {
        status: 400,
        body: { message: "Import failed: malformed payload." },
      },
    });

    await renderApp("/settings");

    const user = userEvent.setup();
    const fileInput = await screen.findByLabelText("Export files");
    const file = new File(['{"bad":true}'], "Streaming_History_Audio_2025.json", {
      type: "application/json",
    });

    await user.upload(fileInput, file);
    await user.click(screen.getByRole("button", { name: "Start import" }));

    expect(await screen.findByText("Import failed: malformed payload.")).toBeInTheDocument();
    expect(fetchMock.count("POST /api/imports/spotify-history")).toBe(1);
  });

  it("shows failed Spotify history jobs returned by the background job endpoints", async () => {
    const failedJob = makeImportJob({
      status: "failed",
      phase: "parsing_history",
      errorMessage: "Spotify history payload could not be parsed.",
      filesProcessed: 1,
      rowsScanned: 14,
      invalidRowsSkipped: 14,
      startedAt: "2026-06-03T06:00:05.000Z",
      completedAt: "2026-06-03T06:00:06.000Z",
      updatedAt: "2026-06-03T06:00:06.000Z",
    });
    const fetchMock = installFetchMock({
      "GET /api/setup/status": {
        body: { setupComplete: true, spotifyConnected: true, passwordSet: true },
      },
      "GET /api/status": {
        body: makeAppStatus(),
      },
      "GET /api/imports/spotify-history/latest": {
        body: failedJob,
      },
      "GET /api/imports/spotify-history/job_1": {
        body: failedJob,
      },
    });

    await renderApp("/settings");

    expect(await screen.findByText("Spotify history payload could not be parsed.")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Invalid Rows Skipped")).toBeInTheDocument();
    expect(screen.getAllByText("14").length).toBeGreaterThan(0);
    expect(fetchMock.count("GET /api/imports/spotify-history/job_1")).toBe(1);
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
