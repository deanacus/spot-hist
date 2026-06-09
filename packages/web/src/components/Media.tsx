import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AlbumArt({
  imageUrl,
  alt,
  fallbackLabel,
  className = "h-10 w-10",
}: {
  imageUrl: string | null;
  alt: string;
  fallbackLabel: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        className={`${className} shrink-0 rounded object-cover`}
      />
    );
  }

  return (
    <div
      className={`flex ${className} shrink-0 items-center justify-center rounded bg-(--bg-tinted) text-[10px] font-semibold uppercase text-(--text-subdued)`}
    >
      {fallbackLabel}
    </div>
  );
}

export function ArtistArtwork({
  name,
  imageUrl,
  className = "h-10 w-10",
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${name} artist image`}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      aria-label={`${name} fallback artwork`}
      className={`flex ${className} shrink-0 items-center justify-center rounded-full bg-(--bg-tinted) text-sm font-semibold text-(--text-secondary)`}
    >
      {initials || "A"}
    </div>
  );
}

export function SpotifyLink({
  url,
  className = "",
}: {
  url: string | null;
  className?: string;
}) {
  if (!url) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`text-sm text-(--text-subdued) hover:text-(--text-secondary) hover:underline ${className}`.trim()}
    >
      Open in Spotify
    </a>
  );
}

/** @deprecated Use SpotifyLink instead */
function SpotifyAttribution({
  url,
  className = "",
}: {
  url: string | null;
  className?: string;
}) {
  return <SpotifyLink url={url} className={className} />;
}

export function InternalDetailLink({
  to,
  children,
  className = "",
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to={to} className={`hover:text-(--text-primary) hover:underline transition ${className}`.trim()}>
      {children}
    </Link>
  );
}
