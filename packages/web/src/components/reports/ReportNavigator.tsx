import { Link } from "react-router-dom";

import type { ReportTimeframe } from "../../lib/api";
import { REPORT_TIMEFRAMES, createReportSearch } from "../../lib/reports";
import { routes } from "../../lib/routes";

function navButtonClass(active: boolean) {
  return [
    "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
    active
      ? "border-(--accent) bg-(--accent) text-black"
      : "border-(--border-subtle) bg-(--bg) text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)",
  ].join(" ");
}

export function ReportNavigator({
  timeframe,
  offset,
  label,
  hasPrevious,
  hasNext,
}: {
  timeframe: ReportTimeframe;
  offset: number;
  label: string;
  hasPrevious: boolean;
  hasNext: boolean;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="justify-self-start">
          {hasPrevious ? (
            <Link
              to={`${routes.reports}${createReportSearch(timeframe, offset + 1)}`}
              className={navButtonClass(false)}
            >
              Previous
            </Link>
          ) : (
            <span aria-hidden="true" className="invisible inline-flex rounded-xl border px-3 py-2 text-sm font-semibold">
              Previous
            </span>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-(--text-subdued)">Period</p>
          <p className="mt-1 text-base font-semibold text-(--text-primary)">{label}</p>
        </div>

        <div className="justify-self-end">
          {hasNext ? (
            <Link
              to={`${routes.reports}${createReportSearch(timeframe, Math.max(offset - 1, 0))}`}
              className={navButtonClass(false)}
            >
              Next
            </Link>
          ) : (
            <span aria-hidden="true" className="invisible inline-flex rounded-xl border px-3 py-2 text-sm font-semibold">
              Next
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {REPORT_TIMEFRAMES.map((option) => (
          <Link
            key={option.key}
            to={`${routes.reports}${createReportSearch(option.key, 0)}`}
            className={navButtonClass(option.key === timeframe)}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
