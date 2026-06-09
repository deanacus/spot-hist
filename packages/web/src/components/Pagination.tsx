import { Link } from "react-router-dom";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildPageWindow(currentPage: number, totalPages: number) {
  const windowSize = Math.min(5, totalPages);
  const start = clamp(currentPage - Math.floor(windowSize / 2), 1, totalPages - windowSize + 1);
  const end = start + windowSize - 1;
  const pages: Array<number | "ellipsis-start" | "ellipsis-end"> = [];

  if (start > 1) {
    pages.push(1);
  }

  if (start > 2) {
    pages.push("ellipsis-start");
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end < totalPages - 1) {
    pages.push("ellipsis-end");
  }

  if (end < totalPages) {
    pages.push(totalPages);
  }

  return pages;
}

function navLinkClass(active: boolean) {
  return [
    "inline-flex min-w-9 items-center justify-center rounded px-3 py-1.5 text-sm font-medium transition-colors",
    active
      ? "bg-(--accent) text-black"
      : "text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)",
  ].join(" ");
}

function EdgeLink({
  href,
  label,
  align,
}: {
  href?: string;
  label: string;
  align: "left" | "right";
}) {
  if (!href) {
    return <span aria-hidden="true" className={`invisible ${align === "left" ? "justify-self-start" : "justify-self-end"}`}>.</span>;
  }

  return (
    <Link to={href} className={`${navLinkClass(false)} ${align === "left" ? "justify-self-start" : "justify-self-end"}`}>
      {label}
    </Link>
  );
}

export function Pagination({
  currentPage,
  total,
  pageSize,
  getHref,
}: {
  currentPage: number;
  total: number;
  pageSize: number;
  getHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) {
    return null;
  }

  const pages = buildPageWindow(currentPage, totalPages);

  return (
    <nav aria-label="Pagination" className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
      <EdgeLink
        href={currentPage > 1 ? getHref(currentPage - 1) : undefined}
        label="Previous"
        align="left"
      />

      <div className="flex items-center justify-center gap-1">
        {pages.map((entry) =>
          typeof entry === "number" ? (
            entry === currentPage ? (
              <span key={entry} aria-current="page" className={navLinkClass(true)}>
                {entry}
              </span>
            ) : (
              <Link key={entry} to={getHref(entry)} className={navLinkClass(false)}>
                {entry}
              </Link>
            )
          ) : (
            <span key={entry} className="px-1 text-sm text-(--text-subdued)">
              …
            </span>
          ),
        )}
      </div>

      <EdgeLink
        href={currentPage < totalPages ? getHref(currentPage + 1) : undefined}
        label="Next"
        align="right"
      />
    </nav>
  );
}
