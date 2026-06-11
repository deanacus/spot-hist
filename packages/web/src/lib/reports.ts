import type { ReportBucket, ReportTimeframe } from "./api";

export const REPORT_TIMEFRAMES: Array<{ key: ReportTimeframe; label: string }> = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "5y", label: "5Y" },
  { key: "all", label: "All time" },
];

const REPORT_TIMEFRAME_SET = new Set<ReportTimeframe>(REPORT_TIMEFRAMES.map((option) => option.key));

export function parseReportTimeframe(value: string | null | undefined): ReportTimeframe {
  if (value && REPORT_TIMEFRAME_SET.has(value as ReportTimeframe)) {
    return value as ReportTimeframe;
  }

  return "month";
}

export function parseReportOffset(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export function createReportSearch(timeframe: ReportTimeframe, offset: number) {
  const search = new URLSearchParams();
  search.set("timeframe", timeframe);
  search.set("offset", String(Math.max(offset, 0)));
  return `?${search.toString()}`;
}

export function formatDuration(ms: number) {
  if (ms <= 0) {
    return "0m";
  }

  const totalMinutes = Math.round(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

export function formatDecimal(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatShare(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function getBucketMax(buckets: ReportBucket[]) {
  return buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0);
}
