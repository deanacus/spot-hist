function normalizePage(page: number) {
  return Number.isInteger(page) && page > 1 ? page : 1;
}

function withPage(basePath: string, page: number) {
  const normalizedPage = normalizePage(page);
  return normalizedPage === 1 ? basePath : `${basePath}/page/${normalizedPage}`;
}

export function parsePageParam(pageParam: string | undefined) {
  if (pageParam === undefined) {
    return 1;
  }

  const page = Number(pageParam);

  if (!Number.isInteger(page) || page < 1) {
    return null;
  }

  return page;
}

export const routes = {
  root: "/",
  home: "/home",
  setup: "/setup",
  setupComplete: "/setup/complete",
  login: "/login",
  scrobbles: "/scrobbles",
  scrobblesPage: (page: number) => withPage("/scrobbles", page),
  artists: "/artists",
  artistsPage: (page: number) => withPage("/artists", page),
  artist: (id: string) => `/artists/${id}`,
  artistScrobbles: (id: string) => `/artists/${id}/scrobbles`,
  artistScrobblesPage: (id: string, page: number) => withPage(`/artists/${id}/scrobbles`, page),
  albums: "/albums",
  albumsPage: (page: number) => withPage("/albums", page),
  album: (id: string) => `/albums/${id}`,
  albumScrobbles: (id: string) => `/albums/${id}/scrobbles`,
  albumScrobblesPage: (id: string, page: number) => withPage(`/albums/${id}/scrobbles`, page),
  tracks: "/tracks",
  tracksPage: (page: number) => withPage("/tracks", page),
  track: (id: string) => `/tracks/${id}`,
  trackScrobbles: (id: string) => `/tracks/${id}/scrobbles`,
  trackScrobblesPage: (id: string, page: number) => withPage(`/tracks/${id}/scrobbles`, page),
  settings: "/settings",
} as const;

export const pagedRouteSuffix = "page/:page" as const;

export type PrimaryNavItem = {
  key: "home" | "scrobbles" | "artists" | "albums" | "tracks" | "settings";
  label: string;
  to: string;
  patterns: string[];
};

export const primaryNavItems: PrimaryNavItem[] = [
  {
    key: "home",
    label: "Home",
    to: routes.home,
    patterns: [routes.home],
  },
  {
    key: "scrobbles",
    label: "Scrobbles",
    to: routes.scrobbles,
    patterns: [routes.scrobbles, `${routes.scrobbles}/${pagedRouteSuffix}`],
  },
  {
    key: "artists",
    label: "Artists",
    to: routes.artists,
    patterns: [
      routes.artists,
      `${routes.artists}/${pagedRouteSuffix}`,
      `${routes.artists}/:id`,
      `${routes.artists}/:id/scrobbles`,
      `${routes.artists}/:id/scrobbles/${pagedRouteSuffix}`,
    ],
  },
  {
    key: "albums",
    label: "Albums",
    to: routes.albums,
    patterns: [
      routes.albums,
      `${routes.albums}/${pagedRouteSuffix}`,
      `${routes.albums}/:id`,
      `${routes.albums}/:id/scrobbles`,
      `${routes.albums}/:id/scrobbles/${pagedRouteSuffix}`,
    ],
  },
  {
    key: "tracks",
    label: "Tracks",
    to: routes.tracks,
    patterns: [
      routes.tracks,
      `${routes.tracks}/${pagedRouteSuffix}`,
      `${routes.tracks}/:id`,
      `${routes.tracks}/:id/scrobbles`,
      `${routes.tracks}/:id/scrobbles/${pagedRouteSuffix}`,
    ],
  },
  {
    key: "settings",
    label: "Settings",
    to: routes.settings,
    patterns: [routes.settings],
  },
];
