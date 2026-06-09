import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanupConfig,
  createAlbum,
  createArtist,
  createAuthenticatedApp,
  createPlay,
  createSpotifyAlbumTrack,
  createSpotifyArtistPayload,
  createSpotifyArtistRelease,
  createSpotifyImage,
  createSpotifyMock,
  expectAuthenticatedRequestsToReturnStatus,
  getDetailRow,
  markDetailRowStale,
} from "./helpers.js";

function createDetailSeedData() {
  const alphaArtist = createArtist("artist-alpha", "Alpha Artist");
  const betaArtist = createArtist("artist-beta", "Beta Artist");

  const alphaAlbum = createAlbum("album-alpha", "Alpha Album", "https://images/album-alpha.jpg", [
    alphaArtist,
  ]);
  const betaAlbum = createAlbum("album-beta", "Beta Album", "https://images/album-beta.jpg", [
    betaArtist,
  ]);
  const collabAlbum = createAlbum("album-collab", "Collab Album", "https://images/album-collab.jpg", [
    alphaArtist,
    betaArtist,
  ]);

  return {
    ids: {
      artist: alphaArtist.id,
      album: alphaAlbum.id,
      track: "track-alpha-hit",
    },
    items: [
      createPlay({
        playedAt: "2024-01-01T00:00:00.000Z",
        trackId: "track-alpha-hit",
        trackName: "Alpha Hit",
        album: alphaAlbum,
        artists: [alphaArtist],
        trackNumber: 1,
        contextType: "playlist",
        contextUri: "spotify:playlist:alpha-mix",
      }),
      createPlay({
        playedAt: "2024-01-01T01:00:00.000Z",
        trackId: "track-alpha-hit",
        trackName: "Alpha Hit",
        album: alphaAlbum,
        artists: [alphaArtist],
        trackNumber: 1,
        contextType: "collection",
        contextUri: "spotify:user:test:collection",
      }),
      createPlay({
        playedAt: "2024-01-02T00:00:00.000Z",
        trackId: "track-alpha-hit",
        trackName: "Alpha Hit",
        album: alphaAlbum,
        artists: [alphaArtist],
        trackNumber: 1,
        contextType: "playlist",
        contextUri: "spotify:playlist:alpha-mix",
      }),
      createPlay({
        playedAt: "2024-01-03T00:00:00.000Z",
        trackId: "track-alpha-deep-cut",
        trackName: "Deep Cut",
        album: alphaAlbum,
        artists: [alphaArtist],
        trackNumber: 2,
        contextType: "album",
        contextUri: "spotify:album:album-alpha",
      }),
      createPlay({
        playedAt: "2024-01-04T00:00:00.000Z",
        trackId: "track-beta-hit",
        trackName: "Beta Hit",
        album: betaAlbum,
        artists: [betaArtist],
        trackNumber: 1,
        contextType: "playlist",
        contextUri: "spotify:playlist:beta-mix",
      }),
      createPlay({
        playedAt: "2024-01-05T00:00:00.000Z",
        trackId: "track-beta-hit",
        trackName: "Beta Hit",
        album: betaAlbum,
        artists: [betaArtist],
        trackNumber: 1,
        contextType: "radio",
        contextUri: "spotify:station:test",
      }),
      createPlay({
        playedAt: "2024-01-06T00:00:00.000Z",
        trackId: "track-duet",
        trackName: "Duet Song",
        album: collabAlbum,
        artists: [alphaArtist, betaArtist],
        trackNumber: 1,
        explicit: true,
        contextType: "playlist",
        contextUri: "spotify:playlist:duets",
      }),
      createPlay({
        playedAt: "2024-01-07T00:00:00.000Z",
        trackId: "track-duet",
        trackName: "Duet Song",
        album: collabAlbum,
        artists: [alphaArtist, betaArtist],
        trackNumber: 1,
        explicit: true,
        contextType: "album",
        contextUri: "spotify:album:album-collab",
      }),
    ],
  };
}

function createArtistCatalogPayload(version: string) {
  return {
    id: "artist-alpha",
    name: "Alpha Artist",
    external_urls: {
      spotify: `https://open.spotify.com/artist/artist-alpha?version=${version}`,
    },
    popularity: version === "v2" ? 91 : 81,
    followers: {
      total: version === "v2" ? 456_789 : 123_456,
    },
    genres: version === "v2" ? ["neo-soul", "indie pop"] : ["art pop", "indie pop"],
    images: [createSpotifyImage(`https://images/artist-alpha-${version}.jpg`)],
  };
}

function createArtistAlbumsPayload(version: string) {
  const alphaArtist = createSpotifyArtistPayload("artist-alpha", "Alpha Artist");
  const betaArtist = createSpotifyArtistPayload("artist-beta", "Beta Artist");

  const releases = [
    {
      id: `catalog-alpha-${version}`,
      name: version === "v2" ? "Alpha Return" : "Alpha Debut",
      albumType: "album",
      albumGroup: "album",
      totalTracks: 11,
      releaseDate: version === "v2" ? "2025-02-01" : "2023-02-01",
      imageUrl: `https://images/catalog-alpha-${version}.jpg`,
      artists: [alphaArtist],
    },
    {
      id: `catalog-single-${version}`,
      name: "Alpha Signal",
      albumType: "single",
      albumGroup: "single",
      totalTracks: 2,
      releaseDate: version === "v2" ? "2025-03-01" : "2023-03-01",
      imageUrl: `https://images/catalog-single-${version}.jpg`,
      artists: [alphaArtist],
    },
    {
      id: `catalog-compilation-${version}`,
      name: "Alpha Archives",
      albumType: "compilation",
      albumGroup: "compilation",
      totalTracks: 20,
      releaseDate: version === "v2" ? "2025-04-01" : "2023-04-01",
      imageUrl: `https://images/catalog-compilation-${version}.jpg`,
      artists: [alphaArtist],
    },
    {
      id: `catalog-appears-${version}`,
      name: "Guest Signal",
      albumType: "album",
      albumGroup: "appears_on",
      totalTracks: 12,
      releaseDate: version === "v2" ? "2025-05-01" : "2023-05-01",
      imageUrl: `https://images/catalog-appears-${version}.jpg`,
      artists: [alphaArtist],
    },
    {
      id: `catalog-guest-${version}`,
      name: "Beta Featuring Alpha",
      albumType: "single",
      albumGroup: "single",
      totalTracks: 1,
      releaseDate: version === "v2" ? "2025-06-01" : "2023-06-01",
      imageUrl: `https://images/catalog-guest-${version}.jpg`,
      artists: [betaArtist, alphaArtist],
    },
  ];

  return {
    items: releases.map((release) =>
      createSpotifyArtistRelease({
        ...release,
        spotifyUrl: `https://open.spotify.com/album/${release.id}`,
      }),
    ),
  };
}

function createAlbumCatalogPayload(version: string) {
  const alphaArtist = createSpotifyArtistPayload("artist-alpha", "Alpha Artist");

  return {
    id: "album-alpha",
    name: "Alpha Album",
    external_urls: {
      spotify: `https://open.spotify.com/album/album-alpha?version=${version}`,
    },
    label: version === "v2" ? "Second Sight Records" : "First Light Records",
    popularity: version === "v2" ? 88 : 72,
    genres: version === "v2" ? ["alt-pop"] : ["indie rock"],
    images: [createSpotifyImage(`https://images/album-alpha-${version}.jpg`)],
    copyrights: [
      {
        text: version === "v2" ? "2025 Second Sight Records" : "2024 First Light Records",
        type: "C",
      },
    ],
    tracks: {
      items: [
        createSpotifyAlbumTrack({
          id: "track-alpha-hit",
          name: "Alpha Hit",
          discNumber: 1,
          trackNumber: 1,
          durationMs: 180_000,
          previewUrl: "https://preview/track-alpha-hit.mp3",
          artists: [alphaArtist],
        }),
        createSpotifyAlbumTrack({
          id: "track-alpha-deep-cut",
          name: "Deep Cut",
          discNumber: 1,
          trackNumber: 2,
          durationMs: 200_000,
          previewUrl: "https://preview/track-alpha-deep-cut.mp3",
          artists: [alphaArtist],
        }),
        createSpotifyAlbumTrack({
          id: `track-alpha-unplayed-${version}`,
          name: version === "v2" ? "Encore" : "Finale",
          discNumber: 1,
          trackNumber: 3,
          durationMs: 210_000,
          previewUrl: null,
          artists: [alphaArtist],
        }),
      ],
    },
  };
}

function createTrackCatalogPayload(version: string) {
  return {
    id: "track-alpha-hit",
    name: "Alpha Hit",
    external_urls: {
      spotify: `https://open.spotify.com/track/track-alpha-hit?version=${version}`,
    },
    popularity: version === "v2" ? 79 : 64,
    preview_url:
      version === "v2"
        ? "https://preview/track-alpha-hit-v2.mp3"
        : "https://preview/track-alpha-hit.mp3",
    external_ids: {
      isrc: "TRACK-ALPHA-HIT-ISRC",
      ean: version === "v2" ? "2222222222222" : "1111111111111",
    },
  };
}

function trackIdOf(item: any) {
  return item?.track?.id ?? item?.trackId ?? item?.id ?? null;
}

function albumIdOf(item: any) {
  return item?.album?.id ?? item?.albumId ?? item?.id ?? null;
}

function playCountOf(item: any) {
  return item?.playCount ?? item?.count ?? item?.plays ?? 0;
}

function normalizeContextBreakdown(breakdown: any) {
  if (Array.isArray(breakdown)) {
    return Object.fromEntries(
      breakdown.map((item) => [
        item?.contextType ?? item?.type ?? item?.label ?? "unknown",
        item?.playCount ?? item?.count ?? 0,
      ]),
    );
  }

  if (breakdown && typeof breakdown === "object") {
    return breakdown;
  }

  return {};
}

async function getJson(
  app: Awaited<ReturnType<typeof createAuthenticatedApp>>["app"],
  sessionCookie: string,
  url: string,
) {
  const response = await app.inject({
    method: "GET",
    url,
    cookies: {
      spot_hist_session: sessionCookie,
    },
  });

  return {
    response,
    body: response.json(),
  };
}

async function postJson(
  app: Awaited<ReturnType<typeof createAuthenticatedApp>>["app"],
  sessionCookie: string,
  url: string,
) {
  const response = await app.inject({
    method: "POST",
    url,
    cookies: {
      spot_hist_session: sessionCookie,
    },
  });

  return {
    response,
    body: response.json(),
  };
}

describe("detail page endpoints", () => {
  const configs: Array<Parameters<typeof cleanupConfig>[0]> = [];

  afterEach(() => {
    vi.restoreAllMocks();

    for (const config of configs.splice(0)) {
      cleanupConfig(config as any);
    }
  });

  it("requires authentication for artist, album, and track detail routes", async () => {
    const seed = createDetailSeedData();
    const { app, config } = await createAuthenticatedApp({
      spotify: createSpotifyMock(),
      seedItems: seed.items,
    });
    configs.push(config);

    const routes = [
      ["GET", `/api/artists/${seed.ids.artist}`],
      ["POST", `/api/artists/${seed.ids.artist}/refresh`],
      ["GET", `/api/albums/${seed.ids.album}`],
      ["POST", `/api/albums/${seed.ids.album}/refresh`],
      ["GET", `/api/tracks/${seed.ids.track}`],
      ["POST", `/api/tracks/${seed.ids.track}/refresh`],
    ] as const;

    for (const [method, url] of routes) {
      const response = await app.inject({
        method,
        url,
      });
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }

    await app.close();
  });

  it("returns 404 for unknown spotify ids", async () => {
    const { app, config, sessionCookie } = await createAuthenticatedApp();
    configs.push(config);

    const routes = [
      ["GET", "/api/artists/missing-artist"],
      ["POST", "/api/artists/missing-artist/refresh"],
      ["GET", "/api/albums/missing-album"],
      ["POST", "/api/albums/missing-album/refresh"],
      ["GET", "/api/tracks/missing-track"],
      ["POST", "/api/tracks/missing-track/refresh"],
    ] as const;

    for (const [method, url] of routes) {
      const response = await app.inject({
        method,
        url,
        cookies: {
          spot_hist_session: sessionCookie,
        },
      });
      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }

    await app.close();
  });

  it("returns an artist local-only DTO with missing detail status and local analytics", async () => {
    const seed = createDetailSeedData();
    const fetchArtist = vi.fn(async () => createArtistCatalogPayload("v1"));
    const fetchArtistAlbums = vi.fn(async () => createArtistAlbumsPayload("v1"));
    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock({
        fetchArtist,
        fetchArtistAlbums,
      }),
      seedItems: seed.items,
    });
    configs.push(config);

    const { response, body } = await getJson(app, sessionCookie, `/api/artists/${seed.ids.artist}`);

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      detailStatus: "missing",
      lastEnrichedAt: null,
      artist: {
        id: "artist-alpha",
        name: "Alpha Artist",
        uri: "spotify:artist:artist-alpha",
        href: "https://api.spotify.com/v1/artists/artist-alpha",
      },
      stats: {
        totalPlays: 6,
        rank: 1,
        uniqueTracks: 3,
        uniqueAlbums: 2,
        firstPlayedAt: "2024-01-01T00:00:00.000Z",
        lastPlayedAt: "2024-01-07T00:00:00.000Z",
      },
    });
    expect(body.spotify?.url ?? null).toBeNull();
    expect(body.catalogAlbums ?? []).toEqual([]);
    expect(
      body.topTracks.map((item: any) => ({
        id: trackIdOf(item),
        playCount: playCountOf(item),
      })),
    ).toEqual([
      { id: "track-alpha-hit", playCount: 3 },
      { id: "track-duet", playCount: 2 },
      { id: "track-alpha-deep-cut", playCount: 1 },
    ]);
    expect(
      body.topAlbums.map((item: any) => ({
        id: albumIdOf(item),
        albumType: item?.albumType ?? null,
        playCount: playCountOf(item),
      })),
    ).toEqual([
      { id: "album-alpha", albumType: "album", playCount: 4 },
    ]);
    expect(body.recentPlays.map((item: any) => item.playedAt)).toEqual([
      "2024-01-07T00:00:00.000Z",
      "2024-01-06T00:00:00.000Z",
      "2024-01-03T00:00:00.000Z",
      "2024-01-02T00:00:00.000Z",
      "2024-01-01T01:00:00.000Z",
    ]);
    expect(fetchArtist).not.toHaveBeenCalled();
    expect(fetchArtistAlbums).not.toHaveBeenCalled();

    await app.close();
  });

  it("returns an album local-only DTO with missing detail status and local analytics", async () => {
    const seed = createDetailSeedData();
    const fetchAlbum = vi.fn(async () => createAlbumCatalogPayload("v1"));
    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock({
        fetchAlbum,
      }),
      seedItems: seed.items,
    });
    configs.push(config);

    const { response, body } = await getJson(app, sessionCookie, `/api/albums/${seed.ids.album}`);

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      detailStatus: "missing",
      lastEnrichedAt: null,
      album: {
        id: "album-alpha",
        name: "Alpha Album",
        imageUrl: "https://images/album-alpha.jpg",
        uri: "spotify:album:album-alpha",
        href: "https://api.spotify.com/v1/albums/album-alpha",
        releaseDate: "2024-01-01",
        releaseDatePrecision: "day",
        albumType: "album",
        totalTracks: 10,
      },
      stats: {
        totalPlays: 4,
        rank: 1,
        uniquePlayedTracks: 2,
        firstPlayedAt: "2024-01-01T00:00:00.000Z",
        lastPlayedAt: "2024-01-03T00:00:00.000Z",
      },
    });
    expect(body.spotify?.url ?? null).toBeNull();
    expect(body.recentPlays.map((item: any) => item.playedAt)).toEqual([
      "2024-01-03T00:00:00.000Z",
      "2024-01-02T00:00:00.000Z",
      "2024-01-01T01:00:00.000Z",
      "2024-01-01T00:00:00.000Z",
    ]);
    expect(
      body.tracklist.map((item: any) => ({
        id: trackIdOf(item),
        playCount: playCountOf(item),
      })),
    ).toEqual([
      { id: "track-alpha-hit", playCount: 3 },
      { id: "track-alpha-deep-cut", playCount: 1 },
    ]);
    expect(fetchAlbum).not.toHaveBeenCalled();

    await app.close();
  });

  it("returns a track local-only DTO with missing detail status and local analytics", async () => {
    const seed = createDetailSeedData();
    const fetchTrack = vi.fn(async () => createTrackCatalogPayload("v1"));
    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock({
        fetchTrack,
      }),
      seedItems: seed.items,
    });
    configs.push(config);

    const { response, body } = await getJson(app, sessionCookie, `/api/tracks/${seed.ids.track}`);

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      detailStatus: "missing",
      lastEnrichedAt: null,
      track: {
        id: "track-alpha-hit",
        name: "Alpha Hit",
        durationMs: 180000,
        explicit: false,
        uri: "spotify:track:track-alpha-hit",
        href: "https://api.spotify.com/v1/tracks/track-alpha-hit",
        previewUrl: "https://preview/track-alpha-hit.mp3",
        isrc: "TRACK-ALPHA-HIT-ISRC",
      },
      stats: {
        totalPlays: 3,
        rank: 1,
        firstPlayedAt: "2024-01-01T00:00:00.000Z",
        lastPlayedAt: "2024-01-02T00:00:00.000Z",
      },
    });
    expect(normalizeContextBreakdown(body.contextBreakdown)).toEqual({
      playlist: 2,
      collection: 1,
    });
    expect(body.recentPlays.map((item: any) => item.playedAt)).toEqual([
      "2024-01-02T00:00:00.000Z",
      "2024-01-01T01:00:00.000Z",
      "2024-01-01T00:00:00.000Z",
    ]);
    expect(fetchTrack).not.toHaveBeenCalled();

    await app.close();
  });

  it("returns paged recent plays metadata with stable ordering across offsets", async () => {
    const seed = createDetailSeedData();
    const alphaArtist = createArtist("artist-alpha", "Alpha Artist");
    const alphaAlbum = createAlbum("album-alpha", "Alpha Album", "https://images/album-alpha.jpg", [
      alphaArtist,
    ]);
    const extraItems = [
      createPlay({
        playedAt: "2024-01-08T00:00:00.000Z",
        trackId: "track-alpha-late-a",
        trackName: "Late Arrival A",
        album: alphaAlbum,
        artists: [alphaArtist],
        trackNumber: 3,
        contextType: "playlist",
        contextUri: "spotify:playlist:alpha-lates",
      }),
      createPlay({
        playedAt: "2024-01-08T00:00:00.000Z",
        trackId: "track-alpha-late-b",
        trackName: "Late Arrival B",
        album: alphaAlbum,
        artists: [alphaArtist],
        trackNumber: 4,
        contextType: "playlist",
        contextUri: "spotify:playlist:alpha-lates",
      }),
    ];

    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock(),
      seedItems: [...seed.items, ...extraItems],
    });
    configs.push(config);

    const firstPage = await getJson(
      app,
      sessionCookie,
      `/api/artists/${seed.ids.artist}/recent-plays?limit=3&offset=0`,
    );
    const secondPage = await getJson(
      app,
      sessionCookie,
      `/api/artists/${seed.ids.artist}/recent-plays?limit=3&offset=3`,
    );

    expect(firstPage.response.statusCode).toBe(200);
    expect(firstPage.body).toMatchObject({
      total: 8,
      offset: 0,
      limit: 3,
      items: [
        {
          playedAt: "2024-01-08T00:00:00.000Z",
          track: { id: "track-alpha-late-b", name: "Late Arrival B" },
        },
        {
          playedAt: "2024-01-08T00:00:00.000Z",
          track: { id: "track-alpha-late-a", name: "Late Arrival A" },
        },
        {
          playedAt: "2024-01-07T00:00:00.000Z",
          track: { id: "track-duet", name: "Duet Song" },
        },
      ],
    });

    expect(secondPage.response.statusCode).toBe(200);
    expect(secondPage.body).toMatchObject({
      total: 8,
      offset: 3,
      limit: 3,
      items: [
        {
          playedAt: "2024-01-06T00:00:00.000Z",
          track: { id: "track-duet", name: "Duet Song" },
        },
        {
          playedAt: "2024-01-03T00:00:00.000Z",
          track: { id: "track-alpha-deep-cut", name: "Deep Cut" },
        },
        {
          playedAt: "2024-01-02T00:00:00.000Z",
          track: { id: "track-alpha-hit", name: "Alpha Hit" },
        },
      ],
    });

    await app.close();
  });

  it("returns 400 for invalid scoped recent-play pagination params", async () => {
    const seed = createDetailSeedData();
    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock(),
      seedItems: seed.items,
    });
    configs.push(config);

    const requests = [
      `/api/artists/${seed.ids.artist}/recent-plays?limit=0`,
      `/api/albums/${seed.ids.album}/recent-plays?limit=banana`,
      `/api/tracks/${seed.ids.track}/recent-plays?offset=-1`,
      `/api/tracks/${seed.ids.track}/recent-plays?offset=2.5`,
    ];

    await expectAuthenticatedRequestsToReturnStatus(app, sessionCookie, "GET", requests, 400);

    await app.close();
  });

  it("persists fresh artist detail rows and serves cached artist reads without re-fetch", async () => {
    const seed = createDetailSeedData();
    const fetchArtist = vi.fn(async () => createArtistCatalogPayload("v1"));
    const fetchArtistAlbums = vi.fn(async () => createArtistAlbumsPayload("v1"));
    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock({
        fetchArtist,
        fetchArtistAlbums,
      }),
      seedItems: seed.items,
    });
    configs.push(config);

    const refresh = await postJson(app, sessionCookie, `/api/artists/${seed.ids.artist}/refresh`);

    expect(refresh.response.statusCode).toBe(200);
    expect(refresh.body).toMatchObject({
      detailStatus: "fresh",
      artist: {
        id: "artist-alpha",
      },
      spotify: {
        url: "https://open.spotify.com/artist/artist-alpha?version=v1",
        popularity: 81,
        followersTotal: 123456,
        genres: ["art pop", "indie pop"],
      },
    });
    expect(refresh.body.lastEnrichedAt).toEqual(expect.any(String));
    expect(refresh.body.catalogAlbums).toEqual([
      expect.objectContaining({
        id: "catalog-alpha-v1",
        name: "Alpha Debut",
        albumType: "album",
      }),
      expect.objectContaining({
        id: "catalog-single-v1",
        name: "Alpha Signal",
        albumType: "single",
      }),
    ]);
    expect(refresh.body.catalogAlbums.map((item: any) => item.id)).toEqual([
      "catalog-alpha-v1",
      "catalog-single-v1",
    ]);
    expect(refresh.body.catalogAlbums.map((item: any) => item.albumType)).toEqual([
      "album",
      "single",
    ]);
    expect(fetchArtist).toHaveBeenCalledTimes(1);
    expect(fetchArtistAlbums).toHaveBeenCalledTimes(1);

    const row = getDetailRow(app.locals.database, "artist", seed.ids.artist);
    expect(row).toBeTruthy();
    expect(row?.spotify_url).toBe("https://open.spotify.com/artist/artist-alpha?version=v1");
    expect(row?.fetched_at).toBeTruthy();
    expect(row?.refresh_after).toBeTruthy();
    expect(String(row?.genres_json)).toContain("art pop");
    expect(String(row?.catalog_albums_json)).toContain("Alpha Debut");
    expect(String(row?.catalog_albums_json)).toContain("Alpha Signal");
    expect(String(row?.catalog_albums_json)).not.toContain("Alpha Archives");
    expect(String(row?.catalog_albums_json)).not.toContain("Guest Signal");
    expect(String(row?.catalog_albums_json)).not.toContain("Beta Featuring Alpha");

    const cached = await getJson(app, sessionCookie, `/api/artists/${seed.ids.artist}`);
    expect(cached.response.statusCode).toBe(200);
    expect(cached.body).toMatchObject({
      detailStatus: "fresh",
      spotify: {
        url: "https://open.spotify.com/artist/artist-alpha?version=v1",
      },
    });
    expect(cached.body.catalogAlbums.map((item: any) => item.id)).toEqual([
      "catalog-alpha-v1",
      "catalog-single-v1",
    ]);
    expect(fetchArtist).toHaveBeenCalledTimes(1);
    expect(fetchArtistAlbums).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it("persists fresh album detail rows and serves cached album reads without re-fetch", async () => {
    const seed = createDetailSeedData();
    const fetchAlbum = vi.fn(async () => createAlbumCatalogPayload("v1"));
    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock({
        fetchAlbum,
      }),
      seedItems: seed.items,
    });
    configs.push(config);

    const refresh = await postJson(app, sessionCookie, `/api/albums/${seed.ids.album}/refresh`);

    expect(refresh.response.statusCode).toBe(200);
    expect(refresh.body).toMatchObject({
      detailStatus: "fresh",
      spotify: {
        url: "https://open.spotify.com/album/album-alpha?version=v1",
        label: "First Light Records",
        popularity: 72,
        genres: ["indie rock"],
      },
    });
    expect(
      refresh.body.tracklist.map((item: any) => ({
        id: trackIdOf(item),
        playCount: playCountOf(item),
      })),
    ).toEqual([
      { id: "track-alpha-hit", playCount: 3 },
      { id: "track-alpha-deep-cut", playCount: 1 },
      { id: "track-alpha-unplayed-v1", playCount: 0 },
    ]);
    expect(fetchAlbum).toHaveBeenCalledTimes(1);

    const row = getDetailRow(app.locals.database, "album", seed.ids.album);
    expect(row).toBeTruthy();
    expect(row?.spotify_url).toBe("https://open.spotify.com/album/album-alpha?version=v1");
    expect(String(row?.tracklist_json)).toContain("track-alpha-unplayed-v1");
    expect(String(row?.copyrights_json)).toContain("First Light Records");

    const cached = await getJson(app, sessionCookie, `/api/albums/${seed.ids.album}`);
    expect(cached.response.statusCode).toBe(200);
    expect(cached.body).toMatchObject({
      detailStatus: "fresh",
      spotify: {
        url: "https://open.spotify.com/album/album-alpha?version=v1",
      },
    });
    expect(fetchAlbum).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it("persists fresh track detail rows and serves cached track reads without re-fetch", async () => {
    const seed = createDetailSeedData();
    const fetchTrack = vi.fn(async () => createTrackCatalogPayload("v1"));
    const fetchAlbum = vi.fn(async () => createAlbumCatalogPayload("v1"));
    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock({
        fetchAlbum,
        fetchTrack,
      }),
      seedItems: seed.items,
    });
    configs.push(config);

    const refresh = await postJson(app, sessionCookie, `/api/tracks/${seed.ids.track}/refresh`);

    expect(refresh.response.statusCode).toBe(200);
    expect(refresh.body).toMatchObject({
      detailStatus: "fresh",
      spotify: {
        url: "https://open.spotify.com/track/track-alpha-hit?version=v1",
        popularity: 64,
        previewUrl: "https://preview/track-alpha-hit.mp3",
        externalIds: {
          isrc: "TRACK-ALPHA-HIT-ISRC",
          ean: "1111111111111",
        },
      },
    });
    expect(fetchTrack).toHaveBeenCalledTimes(1);
    expect(fetchAlbum).toHaveBeenCalledTimes(1);

    const row = getDetailRow(app.locals.database, "track", seed.ids.track);
    expect(row).toBeTruthy();
    expect(row?.spotify_url).toBe("https://open.spotify.com/track/track-alpha-hit?version=v1");
    expect(String(row?.external_ids_json)).toContain("1111111111111");
    expect(row?.preview_url).toBe("https://preview/track-alpha-hit.mp3");

    const cached = await getJson(app, sessionCookie, `/api/tracks/${seed.ids.track}`);
    expect(cached.response.statusCode).toBe(200);
    expect(cached.body).toMatchObject({
      detailStatus: "fresh",
      spotify: {
        url: "https://open.spotify.com/track/track-alpha-hit?version=v1",
      },
    });
    expect(fetchTrack).toHaveBeenCalledTimes(1);
    expect(fetchAlbum).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it("refreshes stale artist detail after the 30-day ttl", async () => {
    const seed = createDetailSeedData();
    const fetchArtist = vi
      .fn()
      .mockImplementationOnce(async () => createArtistCatalogPayload("v1"))
      .mockImplementationOnce(async () => createArtistCatalogPayload("v2"));
    const fetchArtistAlbums = vi
      .fn()
      .mockImplementationOnce(async () => createArtistAlbumsPayload("v1"))
      .mockImplementationOnce(async () => createArtistAlbumsPayload("v2"));
    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock({
        fetchArtist,
        fetchArtistAlbums,
      }),
      seedItems: seed.items,
    });
    configs.push(config);

    await postJson(app, sessionCookie, `/api/artists/${seed.ids.artist}/refresh`);
    markDetailRowStale(app.locals.database, "artist", seed.ids.artist);

    const stale = await getJson(app, sessionCookie, `/api/artists/${seed.ids.artist}`);
    expect(stale.response.statusCode).toBe(200);
    expect(stale.body).toMatchObject({
      detailStatus: "stale",
      spotify: {
        url: "https://open.spotify.com/artist/artist-alpha?version=v1",
      },
    });
    expect(fetchArtist).toHaveBeenCalledTimes(1);
    expect(fetchArtistAlbums).toHaveBeenCalledTimes(1);

    const refreshed = await postJson(app, sessionCookie, `/api/artists/${seed.ids.artist}/refresh`);
    expect(refreshed.response.statusCode).toBe(200);
    expect(refreshed.body).toMatchObject({
      detailStatus: "fresh",
      spotify: {
        url: "https://open.spotify.com/artist/artist-alpha?version=v2",
        popularity: 91,
        followersTotal: 456789,
      },
    });
    expect(fetchArtist).toHaveBeenCalledTimes(2);
    expect(fetchArtistAlbums).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it("refreshes stale album detail after the 30-day ttl", async () => {
    const seed = createDetailSeedData();
    const fetchAlbum = vi
      .fn()
      .mockImplementationOnce(async () => createAlbumCatalogPayload("v1"))
      .mockImplementationOnce(async () => createAlbumCatalogPayload("v2"));
    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock({
        fetchAlbum,
      }),
      seedItems: seed.items,
    });
    configs.push(config);

    await postJson(app, sessionCookie, `/api/albums/${seed.ids.album}/refresh`);
    markDetailRowStale(app.locals.database, "album", seed.ids.album);

    const stale = await getJson(app, sessionCookie, `/api/albums/${seed.ids.album}`);
    expect(stale.response.statusCode).toBe(200);
    expect(stale.body).toMatchObject({
      detailStatus: "stale",
      spotify: {
        url: "https://open.spotify.com/album/album-alpha?version=v1",
      },
    });
    expect(fetchAlbum).toHaveBeenCalledTimes(1);

    const refreshed = await postJson(app, sessionCookie, `/api/albums/${seed.ids.album}/refresh`);
    expect(refreshed.response.statusCode).toBe(200);
    expect(refreshed.body).toMatchObject({
      detailStatus: "fresh",
      spotify: {
        url: "https://open.spotify.com/album/album-alpha?version=v2",
        label: "Second Sight Records",
        popularity: 88,
      },
    });
    expect(
      refreshed.body.tracklist.map((item: any) => ({
        id: trackIdOf(item),
        playCount: playCountOf(item),
      })),
    ).toContainEqual({
      id: "track-alpha-unplayed-v2",
      playCount: 0,
    });
    expect(fetchAlbum).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it("refreshes stale track detail after the 30-day ttl", async () => {
    const seed = createDetailSeedData();
    const fetchTrack = vi
      .fn()
      .mockImplementationOnce(async () => createTrackCatalogPayload("v1"))
      .mockImplementationOnce(async () => createTrackCatalogPayload("v2"));
    const fetchAlbum = vi
      .fn()
      .mockImplementationOnce(async () => createAlbumCatalogPayload("v1"))
      .mockImplementationOnce(async () => createAlbumCatalogPayload("v2"));
    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock({
        fetchAlbum,
        fetchTrack,
      }),
      seedItems: seed.items,
    });
    configs.push(config);

    await postJson(app, sessionCookie, `/api/tracks/${seed.ids.track}/refresh`);
    markDetailRowStale(app.locals.database, "track", seed.ids.track);

    const stale = await getJson(app, sessionCookie, `/api/tracks/${seed.ids.track}`);
    expect(stale.response.statusCode).toBe(200);
    expect(stale.body).toMatchObject({
      detailStatus: "stale",
      spotify: {
        url: "https://open.spotify.com/track/track-alpha-hit?version=v1",
      },
    });
    expect(fetchTrack).toHaveBeenCalledTimes(1);
    expect(fetchAlbum).toHaveBeenCalledTimes(1);

    const refreshed = await postJson(app, sessionCookie, `/api/tracks/${seed.ids.track}/refresh`);
    expect(refreshed.response.statusCode).toBe(200);
    expect(refreshed.body).toMatchObject({
      detailStatus: "fresh",
      spotify: {
        url: "https://open.spotify.com/track/track-alpha-hit?version=v2",
        popularity: 79,
        previewUrl: "https://preview/track-alpha-hit-v2.mp3",
        externalIds: {
          ean: "2222222222222",
        },
      },
    });
    expect(fetchTrack).toHaveBeenCalledTimes(2);
    expect(fetchAlbum).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it("deduplicates concurrent artist refresh requests", async () => {
    const seed = createDetailSeedData();
    let releaseFetch!: () => void;
    let fetchStarted!: () => void;
    const fetchGate = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const started = new Promise<void>((resolve) => {
      fetchStarted = resolve;
    });

    const fetchArtist = vi.fn(async () => {
      fetchStarted();
      await fetchGate;
      return createArtistCatalogPayload("v1");
    });
    const fetchArtistAlbums = vi.fn(async () => createArtistAlbumsPayload("v1"));

    const { app, config, sessionCookie } = await createAuthenticatedApp({
      spotify: createSpotifyMock({
        fetchArtist,
        fetchArtistAlbums,
      }),
      seedItems: seed.items,
    });
    configs.push(config);

    const first = app.inject({
      method: "POST",
      url: `/api/artists/${seed.ids.artist}/refresh`,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });
    const second = app.inject({
      method: "POST",
      url: `/api/artists/${seed.ids.artist}/refresh`,
      cookies: {
        spot_hist_session: sessionCookie,
      },
    });

    await started;
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchArtist).toHaveBeenCalledTimes(1);
    expect(fetchArtistAlbums).toHaveBeenCalledTimes(1);

    releaseFetch();

    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(fetchArtist).toHaveBeenCalledTimes(1);
    expect(fetchArtistAlbums).toHaveBeenCalledTimes(1);

    const row = getDetailRow(app.locals.database, "artist", seed.ids.artist);
    expect(row?.spotify_url).toBe("https://open.spotify.com/artist/artist-alpha?version=v1");

    await app.close();
  });
});
