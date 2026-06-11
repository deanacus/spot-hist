export function getUserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function formatInstantDateTime(
  value: string | null,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString(undefined, options);
}

export function formatInstantDate(
  value: string | null,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(undefined, options);
}

export function formatRelativeInstant(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1_000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? "hour" : "hours"} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  const sameYear = date.getFullYear() === now.getFullYear();
  return formatInstantDate(value, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

export function formatCalendarDate(
  value: string | null,
  precision: "day" | "month" | "year" = "day",
) {
  if (!value) {
    return "Unknown";
  }

  const [yearText = "", monthText = "1", dayText = "1"] = value.split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (!Number.isFinite(year)) {
    return "Unknown";
  }

  if (precision === "year") {
    return String(year);
  }

  const safeMonth = Number.isFinite(month) ? month : 1;
  const safeDay = precision === "month" ? 1 : Number.isFinite(day) ? day : 1;
  const utcDate = new Date(Date.UTC(year, Math.max(safeMonth - 1, 0), Math.max(safeDay, 1)));

  return utcDate.toLocaleDateString(undefined, {
    timeZone: "UTC",
    ...(precision === "month"
      ? { month: "short", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" }),
  });
}
