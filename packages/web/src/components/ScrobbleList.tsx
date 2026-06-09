import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { HistoryItem } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import { useDeleteHistoryItemMutation } from "../lib/queries";
import { routes } from "../lib/routes";
import { AlbumArt } from "./Media";
import { EmptyState, InlineNotice } from "./Ui";

function ScrobbleArtists({ artists }: { artists: HistoryItem["artists"] }) {
  return (
    <>
      {artists.map((artist, index) => (
        <span key={artist.id}>
          {index > 0 ? ", " : null}
          <Link to={routes.artist(artist.id)} className="hover:underline">
            {artist.name}
          </Link>
        </span>
      ))}
    </>
  );
}

function formatScrobbledAt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ScrobbleRow({ item }: { item: HistoryItem }) {
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteMutation = useDeleteHistoryItemMutation();

  useEffect(() => {
    if (!isMenuOpen && !isConfirmingDelete) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsConfirmingDelete(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsConfirmingDelete(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isConfirmingDelete, isMenuOpen]);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setIsConfirmingDelete(false);
  };

  const handleDelete = () => {
    setDeleteError(null);
    deleteMutation.mutate(item.id, {
      onSuccess: () => {
        closeMenu();
      },
      onError: (error) => {
        closeMenu();
        setDeleteError(getErrorMessage(error, "Unable to delete this scrobble."));
      },
    });
  };

  return (
    <div className="space-y-1">
      <article
        className={[
          "group flex items-center gap-3 rounded px-3 py-2 transition-colors hover:bg-(--bg-hover)",
          deleteMutation.isPending ? "opacity-70" : "",
        ].join(" ")}
      >
        <AlbumArt
          imageUrl={item.album.imageUrl}
          alt={`${item.album.name} album art`}
          fallbackLabel="♪"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-(--text-primary)">
            <Link to={routes.track(item.track.id)} className="hover:underline">
              {item.track.name}
            </Link>
          </p>
          <p className="truncate text-xs text-(--text-secondary)">
            <ScrobbleArtists artists={item.artists} />{" "}
            <span aria-hidden="true">•</span>{" "}
            <Link to={routes.album(item.album.id)} className="hover:underline">
              {item.album.name}
            </Link>
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-(--text-subdued)">
          {formatScrobbledAt(item.playedAt)}
        </span>
        <div ref={actionsRef} className="relative shrink-0">
          <button
            type="button"
            aria-label="Scrobble actions"
            aria-expanded={isMenuOpen || isConfirmingDelete}
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-(--text-subdued) transition hover:bg-(--bg-tinted) hover:text-(--text-primary) disabled:cursor-not-allowed disabled:opacity-50"
            disabled={deleteMutation.isPending}
            onClick={() => {
              setDeleteError(null);
              setIsConfirmingDelete(false);
              setIsMenuOpen((current) => !current);
            }}
          >
            <span aria-hidden="true">⋮</span>
          </button>
          {isMenuOpen || isConfirmingDelete ? (
            <div className="absolute right-0 top-full z-10 mt-2 w-52 rounded-xl border border-(--border-subtle) bg-(--bg-elevated) p-2 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
              {isConfirmingDelete ? (
                <div className="space-y-3 p-1">
                  <p className="text-xs leading-5 text-(--text-secondary)">
                    Delete this scrobble? This can’t be undone.
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-(--text-secondary) transition hover:bg-(--bg-hover) hover:text-(--text-primary)"
                      disabled={deleteMutation.isPending}
                      onClick={closeMenu}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-(--error) px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={deleteMutation.isPending}
                      onClick={handleDelete}
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[#ffa0a8] transition hover:bg-[rgba(241,94,108,0.12)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    setDeleteError(null);
                    setIsConfirmingDelete(true);
                  }}
                >
                  <span>Delete</span>
                  <span aria-hidden="true">⌫</span>
                </button>
              )}
            </div>
          ) : null}
        </div>
      </article>
      {deleteError ? <p className="px-3 text-xs text-[#ffa0a8]">{deleteError}</p> : null}
    </div>
  );
}

export function ScrobbleRows({ items }: { items: HistoryItem[] }) {
  return (
    <div>
      {items.map((item) => (
        <ScrobbleRow key={item.id} item={item} />
      ))}
    </div>
  );
}

type ScrobbleListProps = {
  items: HistoryItem[];
  loading: boolean;
  error?: string | null;
  emptyTitle: string;
  emptyBody: string;
  footer?: ReactNode;
};

export function ScrobbleList({
  items,
  loading,
  error = null,
  emptyTitle,
  emptyBody,
  footer,
}: ScrobbleListProps) {
  return (
    <div className="space-y-4">
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {loading ? (
        <p className="py-8 text-sm text-(--text-subdued) animate-pulse">Loading...</p>
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} />
      ) : (
        <>
          <ScrobbleRows items={items} />
          {footer ? <div>{footer}</div> : null}
        </>
      )}
    </div>
  );
}
