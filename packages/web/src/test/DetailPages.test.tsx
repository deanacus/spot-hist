import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { routes } from "../lib/routes";
import { installFetchMock, renderApp, waitForPathname } from "./harness";

function makeRecentPlaysPage() {
  return makeRecentPlaysPageSlice([
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
  ]);
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
    topAlbums?: Array<{
      album: {
        id: string;
        name: string;
        imageUrl: string | null;
        routeId?: string | null;
      };
      albumType: string;
      artists: Array<{ id: string; name: string }>;
      playCount: number;
      lastPlayedAt: string | null;
    }>;
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
    topAlbums:
      options?.topAlbums ??
      [
        {
          album: {
            id: "album_1",
            name: "Signals",
            imageUrl: "https://cdn.test/signals.png",
            uri: "spotify:album:album_1",
            href: "https://api.spotify.test/albums/album_1",
            releaseDate: "2024-04-01",
            releaseDatePrecision: "day",
            totalTracks: 10,
            routeId: "album_1",
          },
          albumType: "album",
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

function makeScopedScrobblesRoute(section: "artists" | "albums" | "tracks", id: string) {
  return `/${section}/${id}/scrobbles`;
}

function makeRecentPlay(id: string, name: string, playedAt = "2026-06-03T06:00:00.000Z") {
  return {
    id,
    playedAt,
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
      imageUrl: "https://cdn.test/signals.png",
    },
    artists: [{ id: "artist_1", name: "North Coast" }],
  };
}

function makeRecentPlaysPageSlice(
  items: Array<ReturnType<typeof makeRecentPlay>>,
  options?: Partial<{ total: number; offset: number; limit: number }>,
) {
  return {
    items,
    total: options?.total ?? items.length,
    offset: options?.offset ?? 0,
    limit: options?.limit ?? items.length,
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
  it.each([
    {
      route: routes.artist("artist_1"),
      request: "GET /api/artists/artist_1",
      body: makeArtistDetail("fresh"),
      recentPlaysRequest: "GET /api/artists/artist_1/recent-plays?offset=0&limit=5",
      scopedScrobblesHref: makeScopedScrobblesRoute("artists", "artist_1"),
    },
    {
      route: routes.album("album_1"),
      request: "GET /api/albums/album_1",
      body: makeAlbumDetail("fresh"),
      recentPlaysRequest: "GET /api/albums/album_1/recent-plays?offset=0&limit=5",
      scopedScrobblesHref: makeScopedScrobblesRoute("albums", "album_1"),
    },
    {
      route: routes.track("track_1"),
      request: "GET /api/tracks/track_1",
      body: makeTrackDetail("fresh"),
      recentPlaysRequest: "GET /api/tracks/track_1/recent-plays?offset=0&limit=5",
      scopedScrobblesHref: makeScopedScrobblesRoute("tracks", "track_1"),
    },
  ])(
    "shows a scoped View all link and no inline load-more on $route",
    async ({ route, request, body, recentPlaysRequest, scopedScrobblesHref }) => {
      installFetchMock({
        "GET /api/setup/status": { body: makeSetupStatus() },
        "GET /api/status": { body: makeAppStatus() },
        [request]: { body },
        [recentPlaysRequest]: {
          body: makeRecentPlaysPageSlice([makeRecentPlay("play_1", "Midnight Run")], { total: 2, limit: 5 }),
        },
      });

      await renderApp(route);

      expect(await screen.findByRole("link", { name: "View all" })).toHaveAttribute("href", scopedScrobblesHref);
      expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Load more scrobbles" })).not.toBeInTheDocument();
    },
  );

  it("navigates from the top artist list into the artist detail route", async () => {
    const topAlbums = [
      {
        album: {
          id: "album_1",
          name: "Signals",
          imageUrl: "https://cdn.test/signals.png",
          routeId: "album_1",
        },
        albumType: "album",
        artists: [{ id: "artist_1", name: "North Coast" }],
        playCount: 21,
        lastPlayedAt: "2026-06-03T06:00:00.000Z",
      },
      {
        album: {
          id: "single_1",
          name: "Night Drive",
          imageUrl: "https://cdn.test/night-drive.png",
          routeId: "single_1",
        },
        albumType: "single",
        artists: [{ id: "artist_1", name: "North Coast" }],
        playCount: 8,
        lastPlayedAt: "2026-06-02T06:00:00.000Z",
      },
    ];
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
      {
        id: "single_2",
        name: "Daybreak",
        imageUrl: "https://cdn.test/daybreak.png",
        releaseDate: "2025-06-01",
        releaseDatePrecision: "day",
        albumType: "single",
        totalTracks: 2,
        spotifyUrl: "https://open.spotify.test/album/single_2",
        artists: [{ id: "artist_1", name: "North Coast" }],
        routeId: "single_2",
      },
    ];
    installFetchMock({
      "GET /api/setup/status": { body: makeSetupStatus() },
      "GET /api/status": { body: makeAppStatus() },
      "GET /api/top/artists?offset=0&limit=50": {
        body: {
          items: [
            {
              artist: { id: "artist_1", name: "North Coast" },
              playCount: 14,
              lastPlayedAt: "2026-06-03T06:00:00.000Z",
            },
          ],
          total: 1,
          offset: 0,
          limit: 50,
        },
      },
      "GET /api/artists/artist_1": {
        body: makeArtistDetail("fresh", {
          topAlbums,
          catalogAlbums: ownReleaseCatalog,
        }),
      },
      "GET /api/artists/artist_1/recent-plays?offset=0&limit=5": {
        body: makeRecentPlaysPage(),
      },
    });

    await renderApp(routes.artists);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: "North Coast" }));

    await waitForPathname(routes.artist("artist_1"));
    const albumsHeading = await screen.findByText(
      (_, element) => element?.tagName === "H2" && element.textContent === "Albums",
    );
    const singlesHeading = await screen.findByText(
      (_, element) => element?.tagName === "H2" && element.textContent === "Singles",
    );
    const albumsSection = albumsHeading.closest("section");
    const singlesSection = singlesHeading.closest("section");

    expect(albumsSection).not.toBeNull();
    expect(singlesSection).not.toBeNull();
    expect(within(albumsSection!).getByText("Signals")).toBeInTheDocument();
    expect(within(albumsSection!).getByText("Afterglow")).toBeInTheDocument();
    expect(within(singlesSection!).getByText("Night Drive")).toBeInTheDocument();
    expect(within(singlesSection!).getByText("Daybreak")).toBeInTheDocument();
    expect(
      within(albumsSection!)
        .getAllByRole("link")
        .some((element) => element.getAttribute("href") === routes.album("album_1")),
    ).toBe(true);
    expect(
      within(albumsSection!)
        .getAllByRole("link")
        .some((element) => element.getAttribute("href") === routes.album("album_2")),
    ).toBe(true);
    expect(
      within(singlesSection!)
        .getAllByRole("link")
        .some((element) => element.getAttribute("href") === routes.album("single_1")),
    ).toBe(true);
    expect(
      within(singlesSection!)
        .getAllByRole("link")
        .some((element) => element.getAttribute("href") === routes.album("single_2")),
    ).toBe(true);
    expect(within(albumsSection!).queryByText("Night Drive")).not.toBeInTheDocument();
    expect(within(singlesSection!).queryByText("Afterglow")).not.toBeInTheDocument();
  });

  it("hides empty artist release sections", async () => {
    installFetchMock({
      "GET /api/setup/status": { body: makeSetupStatus() },
      "GET /api/status": { body: makeAppStatus() },
      "GET /api/artists/artist_1": {
        body: makeArtistDetail("fresh", {
          topAlbums: [
            {
              album: {
                id: "album_1",
                name: "Signals",
                imageUrl: "https://cdn.test/signals.png",
                routeId: "album_1",
              },
              albumType: "album",
              artists: [{ id: "artist_1", name: "North Coast" }],
              playCount: 21,
              lastPlayedAt: "2026-06-03T06:00:00.000Z",
            },
          ],
          catalogAlbums: [
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
          ],
        }),
      },
      "GET /api/artists/artist_1/recent-plays?offset=0&limit=5": {
        body: makeRecentPlaysPage(),
      },
    });

    await renderApp(routes.artist("artist_1"));

    expect(await screen.findByRole("heading", { name: "Albums" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Singles" })).not.toBeInTheDocument();
    });
  });

  it("navigates from the top album and track lists into detail routes", async () => {
    installFetchMock({
      "GET /api/setup/status": { body: makeSetupStatus() },
      "GET /api/status": { body: makeAppStatus() },
      "GET /api/top/albums?offset=0&limit=50": {
        body: {
          items: [
            {
              album: { id: "album_1", name: "Signals", imageUrl: "https://cdn.test/signals.png" },
              artists: [{ id: "artist_1", name: "North Coast" }],
              playCount: 9,
              lastPlayedAt: "2026-06-03T06:00:00.000Z",
            },
          ],
          total: 1,
          offset: 0,
          limit: 50,
        },
      },
      "GET /api/albums/album_1": { body: makeAlbumDetail("fresh") },
      "GET /api/albums/album_1/recent-plays?offset=0&limit=5": { body: makeRecentPlaysPage() },
      "GET /api/top/tracks?offset=0&limit=50": {
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
          total: 1,
          offset: 0,
          limit: 50,
        },
      },
      "GET /api/tracks/track_1": { body: makeTrackDetail("fresh") },
      "GET /api/tracks/track_1/recent-plays?offset=0&limit=5": { body: makeRecentPlaysPage() },
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
      "GET /api/history?offset=0&limit=10": {
        body: makeRecentPlaysPageSlice(
          [
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
          { total: 1, limit: 10 },
        ),
      },
      "GET /api/top/artists?offset=0&limit=10": {
        body: { items: [], total: 0, offset: 0, limit: 10 },
      },
      "GET /api/top/albums?offset=0&limit=10": {
        body: { items: [], total: 0, offset: 0, limit: 10 },
      },
      "GET /api/top/tracks?offset=0&limit=10": {
        body: { items: [], total: 0, offset: 0, limit: 10 },
      },
      "GET /api/tracks/track_1": { body: makeTrackDetail("fresh") },
      "GET /api/tracks/track_1/recent-plays?offset=0&limit=5": { body: makeRecentPlaysPage() },
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
      recentPlaysRequest: "GET /api/artists/artist_1/recent-plays?offset=0&limit=5",
      linkName: "Back to artists",
      href: routes.artists,
    },
    {
      route: routes.album("album_1"),
      request: "GET /api/albums/album_1",
      body: makeAlbumDetail("fresh"),
      recentPlaysRequest: "GET /api/albums/album_1/recent-plays?offset=0&limit=5",
      linkName: "Back to albums",
      href: routes.albums,
    },
    {
      route: routes.track("track_1"),
      request: "GET /api/tracks/track_1",
      body: makeTrackDetail("fresh"),
      recentPlaysRequest: "GET /api/tracks/track_1/recent-plays?offset=0&limit=5",
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

  it.each([
    {
      route: makeScopedScrobblesRoute("artists", "artist_1"),
      navName: "Artists",
      request: "GET /api/artists/artist_1",
      body: makeArtistDetail("fresh"),
      recentPlaysRequest: "GET /api/artists/artist_1/recent-plays?offset=0&limit=50",
      pageOne: makeRecentPlaysPageSlice([makeRecentPlay("play_1", "Midnight Run")], { total: 120, limit: 50 }),
      pageTwo: makeRecentPlaysPageSlice([makeRecentPlay("play_2", "Dawn Echo")], { total: 120, offset: 50, limit: 50 }),
      headingName: "North Coast scrobbles",
      subtitle: "48 scrobbles",
      backLabel: "Back to artist",
      backHref: routes.artist("artist_1"),
    },
    {
      route: makeScopedScrobblesRoute("albums", "album_1"),
      navName: "Albums",
      request: "GET /api/albums/album_1",
      body: makeAlbumDetail("fresh"),
      recentPlaysRequest: "GET /api/albums/album_1/recent-plays?offset=0&limit=50",
      pageOne: makeRecentPlaysPageSlice([makeRecentPlay("play_1", "Midnight Run")], { total: 120, limit: 50 }),
      pageTwo: makeRecentPlaysPageSlice([makeRecentPlay("play_2", "Dawn Echo")], { total: 120, offset: 50, limit: 50 }),
      headingName: "Signals scrobbles",
      subtitle: "31 scrobbles",
      backLabel: "Back to album",
      backHref: routes.album("album_1"),
    },
    {
      route: makeScopedScrobblesRoute("tracks", "track_1"),
      navName: "Tracks",
      request: "GET /api/tracks/track_1",
      body: makeTrackDetail("fresh"),
      recentPlaysRequest: "GET /api/tracks/track_1/recent-plays?offset=0&limit=50",
      pageOne: makeRecentPlaysPageSlice([makeRecentPlay("play_1", "Midnight Run")], { total: 120, limit: 50 }),
      pageTwo: makeRecentPlaysPageSlice([makeRecentPlay("play_2", "Midnight Run")], { total: 120, offset: 50, limit: 50 }),
      headingName: "Midnight Run scrobbles",
      subtitle: "18 scrobbles",
      backLabel: "Back to track",
      backHref: routes.track("track_1"),
    },
  ])(
    "renders contextual scoped scrobbles chrome and keeps $navName active on $route",
    async ({ route, navName, request, body, recentPlaysRequest, pageOne, headingName, subtitle, backLabel, backHref }) => {
      installFetchMock({
        "GET /api/setup/status": { body: makeSetupStatus() },
        "GET /api/status": { body: makeAppStatus() },
        [request]: { body },
        [recentPlaysRequest]: { body: pageOne },
      });

      await renderApp(route);

      await waitForPathname(route);

      const heading = await screen.findByRole("heading", { name: headingName });
      const shellHeader = heading.closest("header");
      expect(shellHeader).not.toBeNull();
      expect(within(shellHeader!).getByText(subtitle)).toBeInTheDocument();
      expect(await screen.findByRole("link", { name: backLabel })).toHaveAttribute("href", backHref);

      expect(screen.getByRole("link", { name: navName }).className).toContain("bg-(--accent)");
      expect(screen.getByRole("link", { name: "Scrobbles" }).className).not.toContain("bg-(--accent)");
    },
  );

  it.each([
    {
      route: makeScopedScrobblesRoute("artists", "artist_1"),
      request: "GET /api/artists/artist_1",
      body: makeArtistDetail("fresh"),
      pageOneRequest: "GET /api/artists/artist_1/recent-plays?offset=0&limit=50",
      pageTwoRequest: "GET /api/artists/artist_1/recent-plays?offset=50&limit=50",
      pageOneLabel: "Midnight Run",
      pageTwoLabel: "Dawn Echo",
    },
    {
      route: makeScopedScrobblesRoute("albums", "album_1"),
      request: "GET /api/albums/album_1",
      body: makeAlbumDetail("fresh"),
      pageOneRequest: "GET /api/albums/album_1/recent-plays?offset=0&limit=50",
      pageTwoRequest: "GET /api/albums/album_1/recent-plays?offset=50&limit=50",
      pageOneLabel: "Midnight Run",
      pageTwoLabel: "Dawn Echo",
    },
    {
      route: makeScopedScrobblesRoute("tracks", "track_1"),
      request: "GET /api/tracks/track_1",
      body: makeTrackDetail("fresh"),
      pageOneRequest: "GET /api/tracks/track_1/recent-plays?offset=0&limit=50",
      pageTwoRequest: "GET /api/tracks/track_1/recent-plays?offset=50&limit=50",
      pageOneLabel: "Midnight Run",
      pageTwoLabel: "Dawn Echo",
    },
  ])(
    "uses numbered pagination routes on $route",
    async ({ route, request, body, pageOneRequest, pageTwoRequest, pageOneLabel, pageTwoLabel }) => {
      const fetchMock = installFetchMock({
        "GET /api/setup/status": { body: makeSetupStatus() },
        "GET /api/status": { body: makeAppStatus() },
        [request]: { body },
        [pageOneRequest]: {
          body: makeRecentPlaysPageSlice([makeRecentPlay("play_1", "Midnight Run")], { total: 120, limit: 50 }),
        },
        [pageTwoRequest]: {
          body: makeRecentPlaysPageSlice([makeRecentPlay("play_2", "Dawn Echo")], {
            total: 120,
            offset: 50,
            limit: 50,
          }),
        },
      });

      await renderApp(route);

      expect(await screen.findByText(pageOneLabel)).toBeInTheDocument();
      expect(screen.getByText("1")).toHaveAttribute("aria-current", "page");

      const user = userEvent.setup();
      await user.click(screen.getByRole("link", { name: "Next" }));

      expect(await screen.findByText(pageTwoLabel)).toBeInTheDocument();
      await waitForPathname(`${route}/page/2`);
      expect(screen.getByText("2")).toHaveAttribute("aria-current", "page");
      expect(fetchMock.calls.map((call) => call.url)).toContain(pageTwoRequest.replace("GET ", ""));

      await user.click(screen.getByRole("link", { name: "Previous" }));

      expect(await screen.findByText(pageOneLabel)).toBeInTheDocument();
      await waitForPathname(route);
    },
  );

  it("redirects an out-of-range scoped scrobbles route to the nearest valid page", async () => {
    installFetchMock({
      "GET /api/setup/status": { body: makeSetupStatus() },
      "GET /api/status": { body: makeAppStatus() },
      "GET /api/artists/artist_1": { body: makeArtistDetail("fresh") },
      "GET /api/artists/artist_1/recent-plays?offset=4950&limit=50": {
        body: makeRecentPlaysPageSlice([], { total: 120, offset: 4950, limit: 50 }),
      },
      "GET /api/artists/artist_1/recent-plays?offset=100&limit=50": {
        body: makeRecentPlaysPageSlice([makeRecentPlay("play_3", "Last Valid Page")], { total: 120, offset: 100, limit: 50 }),
      },
    });

    await renderApp(routes.artistScrobblesPage("artist_1", 100));

    expect(await screen.findByText("Last Valid Page")).toBeInTheDocument();
    await waitForPathname(routes.artistScrobblesPage("artist_1", 3));
  });
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
      "GET /api/artists/artist_1/recent-plays?offset=0&limit=5": { body: makeRecentPlaysPage() },
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
      "GET /api/albums/album_1/recent-plays?offset=0&limit=5": { body: makeRecentPlaysPage() },
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
      "GET /api/albums/album_1/recent-plays?offset=0&limit=5": { body: makeRecentPlaysPage() },
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
      "GET /api/tracks/track_1/recent-plays?offset=0&limit=5": { body: makeRecentPlaysPage() },
    });

    await renderApp(routes.track("track_1"));

    const images = await screen.findAllByRole("img", { name: "Signals album art" });
    expect(images[0]).toHaveAttribute(
      "src",
      "https://cdn.test/track-album.png",
    );
  });
});
