export const routes = {
  root: "/",
  home: "/home",
  setup: "/setup",
  setupComplete: "/setup/complete",
  login: "/login",
  scrobbles: "/scrobbles",
  artists: "/artists",
  artist: (id: string) => `/artists/${id}`,
  albums: "/albums",
  album: (id: string) => `/albums/${id}`,
  tracks: "/tracks",
  track: (id: string) => `/tracks/${id}`,
  settings: "/settings",
} as const;

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
    patterns: [routes.scrobbles],
  },
  {
    key: "artists",
    label: "Artists",
    to: routes.artists,
    patterns: [routes.artists, `${routes.artists}/:id`],
  },
  {
    key: "albums",
    label: "Albums",
    to: routes.albums,
    patterns: [routes.albums, `${routes.albums}/:id`],
  },
  {
    key: "tracks",
    label: "Tracks",
    to: routes.tracks,
    patterns: [routes.tracks, `${routes.tracks}/:id`],
  },
  {
    key: "settings",
    label: "Settings",
    to: routes.settings,
    patterns: [routes.settings],
  },
];
