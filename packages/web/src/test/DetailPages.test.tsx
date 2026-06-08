import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { routes } from "../lib/routes";
import { installFetchMock, renderApp, waitForPathname } from "./harness";

function makeRecentPlaysPage() {
  return {
    items: [
      {
        id: "play_1",
        playedAt: "2026-06-03T06:00:00.000Z",
        contextType: "playlist",
        contextUri: "spotify:playlist:test",
        track: {
          id: "track_1",
          name: "Midnight Run",
          durationMs: 180000,
          explicit: false,
        },
        album: {
          id: "album_1",
          name: "Signals",
          imageUrl: "https://cdn.test/signals.png",
        },
        artists: [{ id: "artist_1", name: "North Coast" }],
      },
    ],
    nextCursor: null,
  };
}

function makeSetupStatus() {
  return { setupComplete: true, spotifyConnected: true, passwordSet: true };
}

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

function makeArtistDetail(
  detailStatus: "fresh" | "stale" | "missing" = "fresh",
  options?: {
    catalogAlbums?: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      releaseDate: string;
      releaseDatePrecision: string;
      albumType: string;
      totalTracks: number;
      spotifyUrl: string | null;
      artists: Array<{ id: string; name: string }>;
      routeId: string | null;
    }>;
  },
) {
  const enriched = detailStatus === "fresh";

  return {
    detailStatus,
    lastEnrichedAt: enriched ? "2026-06-03T06:00:00.000Z" : null,
    artist: {
      id: "artist_1",
      name: "North Coast",
      uri: "spotify:artist:artist_1",
      href: "https://api.spotify.test/artists/artist_1",
    },
    spotify: {
      url: enriched ? "https://open.spotify.test/artist/artist_1" : null,
      popularity: enriched ? 68 : null,
      followersTotal: enriched ? 120045 : null,
      genres: enriched ? ["indie pop", "dream pop"] : [],
      images: enriched ? [{ url: "https://cdn.test/artist-hero.png", width: 640, height: 640 }] : [],
    },
    stats: {
      totalPlays: 48,
      rank: 2,
      uniqueTracks: 12,
      uniqueAlbums: 4,
      firstPlayedAt: "2024-01-01T00:00:00.000Z",
      lastPlayedAt: "2026-06-03T06:00:00.000Z",
    },
    topTracks: [
      {
        track: {
          id: "track_1",
          name: "Midnight Run",
          durationMs: 180000,
          explicit: false,
          uri: "spotify:track:track_1",
          href: "https://api.spotify.test/tracks/track_1",
          previewUrl: null,
          isrc: "AU1234567890",
          routeId: "track_1",
        },
        album: {
          id: "album_1",
          name: "Signals",
          imageUrl: "https://cdn.test/signals.png",
          routeId: "album_1",
        },
        artists: [{ id: "artist_1", name: "North Coast" }],
        playCount: 12,
        lastPlayedAt: "2026-06-03T06:00:00.000Z",
      },
    ],
    topAlbums: [
      {
        album: {
          id: "album_1",
          name: "Signals",
          imageUrl: "https://cdn.test/signals.png",
          uri: "spotify:album:album_1",
          href: "https://api.spotify.test/albums/album_1",
          releaseDate: "2024-04-01",
          releaseDatePrecision: "day",
          albumType: "album",
          totalTracks: 10,
          routeId: "album_1",
        },
        artists: [{ id: "artist_1", name: "North Coast" }],
        playCount: 21,
        lastPlayedAt: "2026-06-03T06:00:00.000Z",
      },
    ],
    recentPlays: makeRecentPlaysPage().items,
    catalogAlbums:
      options?.catalogAlbums ??
      (enriched
        ? [
            {
              id: "album_2",
              name: "Afterglow",
              imageUrl: "https://cdn.test/afterglow.png",
              releaseDate: "2025-01-01",
              releaseDatePrecision: "day",
              albumType: "album",
              totalTracks: 11,
              spotifyUrl: "https://open.spotify.test/album/album_2",
              artists: [{ id: "artist_1", name: "North Coast" }],
              routeId: "album_2",
            },
          ]
        : []),
  };
}

function makeAlbumDetail(detailStatus: "fresh" | "stale" | "missing" = "fresh") {
  const enriched = detailStatus === "fresh";

  return {
    detailStatus,
    lastEnrichedAt: enriched ? "2026-06-03T06:00:00.000Z" : null,
    album: {
      id: "album_1",
      name: "Signals",
      imageUrl: enriched ? null : "https://cdn.test/signals-local.png",
      uri: "spotify:album:album_1",
      href: "https://api.spotify.test/albums/album_1",
      releaseDate: "2024-04-01",
      releaseDatePrecision: "day",
      albumType: "album",
      totalTracks: 10,
    },
    artists: [{ id: "artist_1", name: "North Coast" }],
    spotify: {
      url: enriched ? "https://open.spotify.test/album/album_1" : null,
      label: enriched ? "Shoreline Records" : null,
      popularity: enriched ? 72 : null,
      genres: enriched ? ["indie pop"] : [],
      images: enriched ? [{ url: "https://cdn.test/signals-hero.png", width: 640, height: 640 }] : [],
      copyrights: enriched ? [{ text: "2024 Shoreline Records", type: "C" }] : [],
    },
    stats: {
      totalPlays: 31,
      rank: 4,
      uniquePlayedTracks: 7,
      firstPlayedAt: "2024-04-02T00:00:00.000Z",
      lastPlayedAt: "2026-06-03T06:00:00.000Z",
    },
    tracklist: [
      {
        id: "track_1",
        name: "Midnight Run",
        durationMs: 180000,
        explicit: false,
        discNumber: 1,
        trackNumber: 1,
        artists: [{ id: "artist_1", name: "North Coast" }],
        playCount: 12,
        routeId: "track_1",
      },
    ],
    recentPlays: [
      {
        id: "play_1",
        playedAt: "2026-06-03T06:00:00.000Z",
        contextType: "album",
        contextUri: "spotify:album:album_1",
        track: {
          id: "track_1",
          name: "Midnight Run",
          durationMs: 180000,
          explicit: false,
        },
        album: {
          id: "album_1",
          name: "Signals",
          imageUrl: "https://cdn.test/signals-local.png",
        },
        artists: [{ id: "artist_1", name: "North Coast" }],
      },
    ],
  };
}

function makeTrackDetail(detailStatus: "fresh" | "stale" | "missing" = "fresh") {
  const enriched = detailStatus === "fresh";

  return {
    detailStatus,
    lastEnrichedAt: enriched ? "2026-06-03T06:00:00.000Z" : null,
    track: {
      id: "track_1",
      name: "Midnight Run",
      durationMs: 180000,
      explicit: true,
      uri: "spotify:track:track_1",
      href: "https://api.spotify.test/tracks/track_1",
      previewUrl: enriched ? "https://cdn.test/preview.mp3" : null,
      isrc: "AU1234567890",
    },
    album: {
      id: "album_1",
      name: "Signals",
      imageUrl: "https://cdn.test/track-album.png",
      uri: "spotify:album:album_1",
      href: "https://api.spotify.test/albums/album_1",
      releaseDate: "2024-04-01",
      releaseDatePrecision: "day",
      albumType: "album",
      totalTracks: 10,
      routeId: "album_1",
    },
    artists: [{ id: "artist_1", name: "North Coast" }],
    spotify: {
      url: enriched ? "https://open.spotify.test/track/track_1" : null,
      popularity: enriched ? 66 : null,
      previewUrl: enriched ? "https://cdn.test/preview.mp3" : null,
      externalIds: enriched ? { isrc: "AU1234567890" } : {},
    },
    stats: {
      totalPlays: 18,
      rank: 8,
      firstPlayedAt: "2024-05-01T00:00:00.000Z",
      lastPlayedAt: "2026-06-03T06:00:00.000Z",
    },
    contextBreakdown: [{ contextType: "playlist", playCount: 11 }],
    recentPlays: [
      {
        id: "play_1",
        playedAt: "2026-06-03T06:00:00.000Z",
        contextType: "playlist",
        contextUri: "spotify:playlist:test",
        track: {
          id: "track_1",
          name: "Midnight Run",
          durationMs: 180000,
          explicit: true,
        },
        album: {
          id: "album_1",
          name: "Signals",
          imageUrl: "https://cdn.test/track-album.png",
        },
        artists: [{ id: "artist_1", name: "North Coast" }],
      },
    ],
    albumTracklist: [
      {
        id: "track_1",
        name: "Midnight Run",
        durationMs: 180000,
        explicit: true,
        discNumber: 1,
        trackNumber: 1,
        artists: [{ id: "artist_1", name: "North Coast" }],
        playCount: 18,
        routeId: "track_1",
        isCurrentTrack: true,
      },
    ],
  };
}

describe("detail page routing", () => {
  it.each([routes.artist("artist_1"), routes.album("album_1"), routes.track("track_1")])(
    "redirects %s to login when no session exists",
    async (route) => {
      installFetchMock({
        "GET /api/setup/status": { body: makeSetupStatus() },
        "GET /api/status": { status: 401, body: { message: "Unauthorized" } },
      });

      await renderApp(route);

      expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
      await waitForPathname("/login");
    },
  );
});

describe("detail page navigation", () => {
  it("navigates from the top artist list into the artist detail route", async () => {
    const ownReleaseCatalog = [
      {
        id: "album_1",
        name: "Signals",
        imageUrl: "https://cdn.test/signals.png",
        releaseDate: "2024-04-01",
        releaseDatePrecision: "day",
        albumType: "album",
        totalTracks: 10,
        spotifyUrl: "https://open.spotify.test/album/album_1",
        artists: [{ id: "artist_1", name: "North Coast" }],
        routeId: "album_1",
      },
      {
        id: "album_2",
        name: "Afterglow",
        imageUrl: "https://cdn.test/afterglow.png",
        releaseDate: "2025-01-01",
        releaseDatePrecision: "day",
        albumType: "album",
        totalTracks: 11,
        spotifyUrl: "https://open.spotify.test/album/album_2",
        artists: [{ id: "artist_1", name: "North Coast" }],
        routeId: "album_2",
      },
    ];
    installFetchMock({
      "GET /api/setup/status": { body: makeSetupStatus() },
      "GET /api/status": { body: makeAppStatus() },
      "GET /api/top/artists?limit=50": {
        body: {
          items: [
            {
              artist: { id: "artist_1", name: "North Coast" },
              playCount: 14,
              lastPlayedAt: "2026-06-03T06:00:00.000Z",
            },
          ],
        },
      },
      "GET /api/artists/artist_1": {
        body: makeArtistDetail("fresh", {
          catalogAlbums: ownReleaseCatalog,
        }),
      },
      "GET /api/artists/artist_1/recent-plays?limit=5": {
        body: makeRecentPlaysPage(),
      },
    });

    await renderApp(routes.artists);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: "North Coast" }));

    await waitForPathname(routes.artist("artist_1"));
    const discographyHeading = await screen.findByText("Discography");
    const discographySection = discographyHeading.closest("section");

    expect(discographySection).not.toBeNull();
    expect(within(discographySection!).getByText("Signals")).toBeInTheDocument();
    expect(within(discographySection!).getByText("Afterglow")).toBeInTheDocument();
    expect(
      within(discographySection!)
        .getAllByRole("link")
        .some((element) => element.getAttribute("href") === routes.album("album_1")),
    ).toBe(true);
    expect(
      within(discographySection!)
        .getAllByRole("link")
        .some((element) => element.getAttribute("href") === routes.album("album_2")),
    ).toBe(true);
    expect(within(discographySection!).queryByText("Beachside Covers")).not.toBeInTheDocument();
    expect(within(discographySection!).queryByText("Festival Friends Vol. 1")).not.toBeInTheDocument();
    expect(within(discographySection!).queryByText("Producer Spotlight")).not.toBeInTheDocument();
  });

  it("navigates from the top album and track lists into detail routes", async () => {
    installFetchMock({
      "GET /api/setup/status": { body: makeSetupStatus() },
      "GET /api/status": { body: makeAppStatus() },
      "GET /api/top/albums?limit=50": {
        body: {
          items: [
            {
              album: { id: "album_1", name: "Signals", imageUrl: "https://cdn.test/signals.png" },
              artists: [{ id: "artist_1", name: "North Coast" }],
              playCount: 9,
              lastPlayedAt: "2026-06-03T06:00:00.000Z",
            },
          ],
        },
      },
      "GET /api/albums/album_1": { body: makeAlbumDetail("fresh") },
      "GET /api/albums/album_1/recent-plays?limit=5": { body: makeRecentPlaysPage() },
      "GET /api/top/tracks?limit=50": {
        body: {
          items: [
            {
              track: { id: "track_1", name: "Midnight Run", durationMs: 180000, explicit: true },
              album: { id: "album_1", name: "Signals", imageUrl: "https://cdn.test/signals.png" },
              artists: [{ id: "artist_1", name: "North Coast" }],
              playCount: 11,
              lastPlayedAt: "2026-06-03T06:00:00.000Z",
            },
          ],
        },
      },
      "GET /api/tracks/track_1": { body: makeTrackDetail("fresh") },
      "GET /api/tracks/track_1/recent-plays?limit=5": { body: makeRecentPlaysPage() },
    });

    await renderApp(routes.albums);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: "Signals" }));
    await waitForPathname(routes.album("album_1"));
    expect(await screen.findByText("Tracklist")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Tracks" }));
    expect(await screen.findByRole("link", { name: "Midnight Run" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Midnight Run" }));
    await waitForPathname(routes.track("track_1"));
    expect(await screen.findByText("Album tracklist")).toBeInTheDocument();
  });

  it("links home page scrobble rows into track, album, and artist detail pages", async () => {
    installFetchMock({
      "GET /api/setup/status": { body: makeSetupStatus() },
      "GET /api/status": { body: makeAppStatus() },
      "GET /api/stats": {
        body: {
          totalPlays: 12,
          uniqueTracks: 10,
          uniqueArtists: 6,
          uniqueAlbums: 7,
          latestPlayAt: "2026-06-03T06:00:00.000Z",
        },
      },
      "GET /api/history?limit=10": {
        body: {
          items: [
            {
              id: "play_1",
              playedAt: "2026-06-03T06:00:00.000Z",
              contextType: "playlist",
              contextUri: "spotify:playlist:test",
              track: { id: "track_1", name: "Midnight Run", durationMs: 180000, explicit: true },
              album: { id: "album_1", name: "Signals", imageUrl: "https://cdn.test/signals.png" },
              artists: [{ id: "artist_1", name: "North Coast" }],
            },
          ],
          nextCursor: null,
        },
      },
      "GET /api/top/artists?limit=10": {
        body: {
          items: [],
        },
      },
      "GET /api/top/albums?limit=10": {
        body: {
          items: [],
        },
      },
      "GET /api/top/tracks?limit=10": {
        body: {
          items: [],
        },
      },
      "GET /api/tracks/track_1": { body: makeTrackDetail("fresh") },
      "GET /api/tracks/track_1/recent-plays?limit=5": { body: makeRecentPlaysPage() },
    });

    await renderApp(routes.home);

    expect(await screen.findByRole("link", { name: "Midnight Run" })).toHaveAttribute(
      "href",
      routes.track("track_1"),
    );
    expect(screen.getByRole("link", { name: "Signals" })).toHaveAttribute("href", routes.album("album_1"));
    expect(screen.getByRole("link", { name: "North Coast" })).toHaveAttribute(
      "href",
      routes.artist("artist_1"),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Midnight Run" }));

    await waitForPathname(routes.track("track_1"));
    expect(await screen.findByText("Album tracklist")).toBeInTheDocument();
  });

  it.each([
    {
      route: routes.artist("artist_1"),
      request: "GET /api/artists/artist_1",
      body: makeArtistDetail("fresh"),
      recentPlaysRequest: "GET /api/artists/artist_1/recent-plays?limit=5",
      linkName: "Back to artists",
      href: routes.artists,
    },
    {
      route: routes.album("album_1"),
      request: "GET /api/albums/album_1",
      body: makeAlbumDetail("fresh"),
      recentPlaysRequest: "GET /api/albums/album_1/recent-plays?limit=5",
      linkName: "Back to albums",
      href: routes.albums,
    },
    {
      route: routes.track("track_1"),
      request: "GET /api/tracks/track_1",
      body: makeTrackDetail("fresh"),
      recentPlaysRequest: "GET /api/tracks/track_1/recent-plays?limit=5",
      linkName: "Back to tracks",
      href: routes.tracks,
    },
  ])(
    "shows the parent section link on $route",
    async ({ route, request, body, recentPlaysRequest, linkName, href }) => {
      installFetchMock({
        "GET /api/setup/status": { body: makeSetupStatus() },
        "GET /api/status": { body: makeAppStatus() },
        [request]: { body },
        [recentPlaysRequest]: { body: makeRecentPlaysPage() },
      });

      await renderApp(route);
      expect(await screen.findByRole("link", { name: linkName })).toHaveAttribute("href", href);
    },
  );
});

describe("detail page refresh behavior", () => {
  it("renders local artist content immediately and auto-refreshes when detail is missing", async () => {
    let releaseRefresh = () => {};
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const fetchMock = installFetchMock({
      "GET /api/setup/status": { body: makeSetupStatus() },
      "GET /api/status": { body: makeAppStatus() },
      "GET /api/artists/artist_1": [
        { body: makeArtistDetail("missing") },
        { body: makeArtistDetail("fresh") },
      ],
      "GET /api/artists/artist_1/recent-plays?limit=5": { body: makeRecentPlaysPage() },
      "POST /api/artists/artist_1/refresh": async () => {
        await refreshGate;
        return { body: makeArtistDetail("fresh") };
      },
    });

    await renderApp(routes.artist("artist_1"));

    expect((await screen.findAllByText("Midnight Run")).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("North Coast fallback artwork")).toBeInTheDocument();
    expect(screen.queryByText(/indie pop/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock.count("POST /api/artists/artist_1/refresh")).toBe(1);
    });

    releaseRefresh();

    expect(await screen.findByText(/indie pop/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "North Coast artist image" })).toHaveAttribute(
      "src",
      "https://cdn.test/artist-hero.png",
    );
  });

  it("auto-refreshes stale album detail and keeps local content visible on refresh failure", async () => {
    const fetchMock = installFetchMock({
      "GET /api/setup/status": { body: makeSetupStatus() },
      "GET /api/status": { body: makeAppStatus() },
      "GET /api/albums/album_1": { body: makeAlbumDetail("stale") },
      "GET /api/albums/album_1/recent-plays?limit=5": { body: makeRecentPlaysPage() },
      "POST /api/albums/album_1/refresh": {
        status: 429,
        body: { message: "Spotify rate limit reached. Try again later." },
      },
    });

    await renderApp(routes.album("album_1"));

    expect(await screen.findByText("Tracklist")).toBeInTheDocument();
    expect(screen.getAllByText("Midnight Run").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(fetchMock.count("POST /api/albums/album_1/refresh")).toBe(1);
    });

    expect(await screen.findByText("Spotify rate limit reached. Try again later.")).toBeInTheDocument();
    expect(screen.getAllByText("Midnight Run").length).toBeGreaterThan(0);
  });
});

describe("detail page imagery", () => {
  it("renders Spotify album artwork when present on the album detail page", async () => {
    installFetchMock({
      "GET /api/setup/status": { body: makeSetupStatus() },
      "GET /api/status": { body: makeAppStatus() },
      "GET /api/albums/album_1": { body: makeAlbumDetail("fresh") },
      "GET /api/albums/album_1/recent-plays?limit=5": { body: makeRecentPlaysPage() },
    });

    await renderApp(routes.album("album_1"));

    const images = await screen.findAllByRole("img", { name: "Signals album art" });
    expect(images[0]).toHaveAttribute(
      "src",
      "https://cdn.test/signals-hero.png",
    );
  });

  it("renders track artwork when present on the track detail page", async () => {
    installFetchMock({
      "GET /api/setup/status": { body: makeSetupStatus() },
      "GET /api/status": { body: makeAppStatus() },
      "GET /api/tracks/track_1": { body: makeTrackDetail("fresh") },
      "GET /api/tracks/track_1/recent-plays?limit=5": { body: makeRecentPlaysPage() },
    });

    await renderApp(routes.track("track_1"));

    const images = await screen.findAllByRole("img", { name: "Signals album art" });
    expect(images[0]).toHaveAttribute(
      "src",
      "https://cdn.test/track-album.png",
    );
  });
});
