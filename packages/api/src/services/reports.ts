import type { DatabaseContext } from "../db/index.js";

type ArtistSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
};

type AlbumSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
};

type TrackSummary = {
  id: string;
  name: string;
  durationMs: number;
  explicit: boolean;
};

export type ReportTimeframe = "week" | "month" | "year" | "5y" | "all";

export type ReportBucket = {
  key: string;
  label: string;
  count: number;
  share: number;
};

export type Report = {
  timeframe: ReportTimeframe;
  offset: number;
  label: string;
  periodStart: string | null;
  periodEnd: string | null;
  isCurrentPeriod: boolean;
  hasPreviousPeriod: boolean;
  hasNextPeriod: boolean;
  summary: {
    totalScrobbles: number;
    totalListeningTimeMs: number;
    averageScrobblesPerDay: number;
    averageListeningTimePerDayMs: number;
    mostActiveDay: {
      date: string;
      playCount: number;
      listeningTimeMs: number;
    } | null;
    longestStreakDays: number;
  };
  discovery: {
    uniqueArtists: number;
    newArtists: number;
    uniqueAlbums: number;
    newAlbums: number;
    uniqueTracks: number;
    newTracks: number;
  };
  topArtists: Array<{
    artist: ArtistSummary;
    playCount: number;
    listeningTimeMs: number;
    shareOfScrobbles: number;
  }>;
  topAlbums: Array<{
    album: AlbumSummary;
    artists: Array<{ id: string; name: string }>;
    playCount: number;
    listeningTimeMs: number;
  }>;
  topTracks: Array<{
    track: TrackSummary;
    album: AlbumSummary;
    artists: Array<{ id: string; name: string }>;
    playCount: number;
    listeningTimeMs: number;
  }>;
  patterns: {
    listeningClock: ReportBucket[];
    weekdayActivity: ReportBucket[];
    byDecade: ReportBucket[];
  };
  composition: {
    releaseFormatMix: ReportBucket[];
    explicitMix: ReportBucket[];
  };
};

type ReportPeriod = {
  timeframe: ReportTimeframe;
  offset: number;
  label: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  periodStartIso: string | null;
  periodEndIso: string | null;
  isCurrentPeriod: boolean;
};

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type SqlRange = {
  clause: string;
  params: unknown[];
};

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_LABELS = new Map<number, string>([
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
]);

export async function getReport(
  database: DatabaseContext,
  timeframe: ReportTimeframe,
  offset: number,
  timeZone = "UTC",
  now = new Date(),
): Promise<Report> {
  const period = resolveReportPeriod(database, timeframe, offset, now, timeZone);
  const range = getSqlRange(period);

  const summaryRow = database.client
    .prepare(
      `
      SELECT
        COUNT(plays.id) AS total_scrobbles,
        COALESCE(SUM(tracks.duration_ms), 0) AS total_listening_time_ms
      FROM plays
      JOIN tracks ON tracks.id = plays.track_id
      ${range.clause}
      `,
    )
    .get(...range.params) as {
    total_scrobbles: number;
    total_listening_time_ms: number;
  };

  const totalScrobbles = summaryRow.total_scrobbles;
  const totalListeningTimeMs = summaryRow.total_listening_time_ms;

  const patternRows = database.client
    .prepare(
      `
      SELECT
        plays.played_at AS played_at,
        tracks.duration_ms AS duration_ms,
        tracks.explicit AS track_explicit,
        albums.release_date AS album_release_date,
        albums.album_type AS album_type
      FROM plays
      JOIN tracks ON tracks.id = plays.track_id
      JOIN albums ON albums.id = tracks.album_id
      ${range.clause}
      ORDER BY plays.played_at ASC
      `,
    )
    .all(...range.params) as Array<{
    played_at: string;
    duration_ms: number;
    track_explicit: number;
    album_release_date: string | null;
    album_type: string | null;
  }>;

  const bucketMaps = buildPatternBuckets(patternRows, timeZone);
  const dailyRows = Array.from(bucketMaps.daily.entries())
    .map(([localDay, bucket]) => ({
      local_day: localDay,
      play_count: bucket.playCount,
      listening_time_ms: bucket.listeningTimeMs,
    }))
    .sort((left, right) => left.local_day.localeCompare(right.local_day));

  const mostActiveDay = dailyRows
    .slice()
    .sort((left, right) => {
      if (right.play_count !== left.play_count) {
        return right.play_count - left.play_count;
      }

      if (right.listening_time_ms !== left.listening_time_ms) {
        return right.listening_time_ms - left.listening_time_ms;
      }

      return left.local_day.localeCompare(right.local_day);
    })[0];

  const averageDivisor = getAverageDayCount(period, now, timeZone);

  const discovery = {
    uniqueArtists: getCount(
      database,
      `
      SELECT COUNT(DISTINCT track_artists.artist_id) AS total
      FROM plays
      JOIN tracks ON tracks.id = plays.track_id
      JOIN track_artists ON track_artists.track_id = tracks.id
      ${range.clause}
      `,
      ...range.params,
    ),
    newArtists: period.periodStartIso
      ? getCount(
          database,
          `
          SELECT COUNT(*) AS total
          FROM (
            SELECT track_artists.artist_id AS entity_id, MIN(plays.played_at) AS first_played_at
            FROM plays
            JOIN tracks ON tracks.id = plays.track_id
            JOIN track_artists ON track_artists.track_id = tracks.id
            GROUP BY track_artists.artist_id
          ) firsts
          WHERE first_played_at >= ? AND first_played_at <= ?
          `,
          period.periodStartIso,
          period.periodEndIso,
        )
      : 0,
    uniqueAlbums: getCount(
      database,
      `
      SELECT COUNT(DISTINCT tracks.album_id) AS total
      FROM plays
      JOIN tracks ON tracks.id = plays.track_id
      ${range.clause}
      `,
      ...range.params,
    ),
    newAlbums: period.periodStartIso
      ? getCount(
          database,
          `
          SELECT COUNT(*) AS total
          FROM (
            SELECT tracks.album_id AS entity_id, MIN(plays.played_at) AS first_played_at
            FROM plays
            JOIN tracks ON tracks.id = plays.track_id
            GROUP BY tracks.album_id
          ) firsts
          WHERE first_played_at >= ? AND first_played_at <= ?
          `,
          period.periodStartIso,
          period.periodEndIso,
        )
      : 0,
    uniqueTracks: getCount(
      database,
      `
      SELECT COUNT(DISTINCT plays.track_id) AS total
      FROM plays
      ${range.clause}
      `,
      ...range.params,
    ),
    newTracks: period.periodStartIso
      ? getCount(
          database,
          `
          SELECT COUNT(*) AS total
          FROM (
            SELECT plays.track_id AS entity_id, MIN(plays.played_at) AS first_played_at
            FROM plays
            GROUP BY plays.track_id
          ) firsts
          WHERE first_played_at >= ? AND first_played_at <= ?
          `,
          period.periodStartIso,
          period.periodEndIso,
        )
      : 0,
  };

  const topArtistRows = database.client
    .prepare(
      `
      SELECT
        artists.id AS artist_id,
        artists.spotify_id AS artist_spotify_id,
        artists.name AS artist_name,
        artist_details.images_json AS artist_images_json,
        COUNT(plays.id) AS play_count,
        COALESCE(SUM(tracks.duration_ms), 0) AS listening_time_ms
      FROM plays
      JOIN tracks ON tracks.id = plays.track_id
      JOIN track_artists ON track_artists.track_id = tracks.id
      JOIN artists ON artists.id = track_artists.artist_id
      LEFT JOIN artist_details ON artist_details.artist_id = artists.id
      ${range.clause}
      GROUP BY artists.id
      ORDER BY play_count DESC, listening_time_ms DESC, artists.name COLLATE NOCASE ASC, artists.spotify_id ASC
      LIMIT 5
      `,
    )
    .all(...range.params) as Array<{
    artist_id: number;
    artist_spotify_id: string;
    artist_name: string;
    artist_images_json: string | null;
    play_count: number;
    listening_time_ms: number;
  }>;

  const topAlbumRows = database.client
    .prepare(
      `
      SELECT
        albums.id AS album_id,
        albums.spotify_id AS album_spotify_id,
        albums.name AS album_name,
        albums.image_url AS album_image_url,
        COUNT(plays.id) AS play_count,
        COALESCE(SUM(tracks.duration_ms), 0) AS listening_time_ms
      FROM plays
      JOIN tracks ON tracks.id = plays.track_id
      JOIN albums ON albums.id = tracks.album_id
      ${range.clause}
      GROUP BY albums.id
      ORDER BY play_count DESC, listening_time_ms DESC, albums.name COLLATE NOCASE ASC, albums.spotify_id ASC
      LIMIT 5
      `,
    )
    .all(...range.params) as Array<{
    album_id: number;
    album_spotify_id: string;
    album_name: string;
    album_image_url: string | null;
    play_count: number;
    listening_time_ms: number;
  }>;

  const topTrackRows = database.client
    .prepare(
      `
      SELECT
        tracks.id AS track_id,
        tracks.spotify_id AS track_spotify_id,
        tracks.name AS track_name,
        tracks.duration_ms AS track_duration_ms,
        tracks.explicit AS track_explicit,
        albums.spotify_id AS album_spotify_id,
        albums.name AS album_name,
        albums.image_url AS album_image_url,
        COUNT(plays.id) AS play_count,
        COALESCE(SUM(tracks.duration_ms), 0) AS listening_time_ms
      FROM plays
      JOIN tracks ON tracks.id = plays.track_id
      JOIN albums ON albums.id = tracks.album_id
      ${range.clause}
      GROUP BY tracks.id
      ORDER BY play_count DESC, listening_time_ms DESC, tracks.name COLLATE NOCASE ASC, tracks.spotify_id ASC
      LIMIT 5
      `,
    )
    .all(...range.params) as Array<{
    track_id: number;
    track_spotify_id: string;
    track_name: string;
    track_duration_ms: number;
    track_explicit: number;
    album_spotify_id: string;
    album_name: string;
    album_image_url: string | null;
    play_count: number;
    listening_time_ms: number;
  }>;

  const topAlbumArtists = getOwnerArtistMap(database, "album_artists", "album_id", topAlbumRows.map((row) => row.album_id));
  const topTrackArtists = getOwnerArtistMap(database, "track_artists", "track_id", topTrackRows.map((row) => row.track_id));

  return {
    timeframe: period.timeframe,
    offset: period.offset,
    label: period.label,
    periodStart: period.periodStartIso,
    periodEnd: period.periodEndIso,
    isCurrentPeriod: period.isCurrentPeriod,
    hasPreviousPeriod: hasEarlierData(database, period.periodStartIso),
    hasNextPeriod: period.offset > 0,
    summary: {
      totalScrobbles,
      totalListeningTimeMs,
      averageScrobblesPerDay: averageDivisor > 0 ? totalScrobbles / averageDivisor : 0,
      averageListeningTimePerDayMs: averageDivisor > 0 ? totalListeningTimeMs / averageDivisor : 0,
      mostActiveDay: mostActiveDay
        ? {
            date: mostActiveDay.local_day,
            playCount: mostActiveDay.play_count,
            listeningTimeMs: mostActiveDay.listening_time_ms,
          }
        : null,
      longestStreakDays: getLongestStreakDays(dailyRows.map((row) => row.local_day)),
    },
    discovery,
    topArtists: topArtistRows.map((row) => ({
      artist: {
        id: row.artist_spotify_id,
        name: row.artist_name,
        imageUrl: parseFirstImageUrl(row.artist_images_json),
      },
      playCount: row.play_count,
      listeningTimeMs: row.listening_time_ms,
      shareOfScrobbles: totalScrobbles > 0 ? row.play_count / totalScrobbles : 0,
    })),
    topAlbums: topAlbumRows.map((row) => ({
      album: {
        id: row.album_spotify_id,
        name: row.album_name,
        imageUrl: row.album_image_url,
      },
      artists: topAlbumArtists.get(row.album_id) ?? [],
      playCount: row.play_count,
      listeningTimeMs: row.listening_time_ms,
    })),
    topTracks: topTrackRows.map((row) => ({
      track: {
        id: row.track_spotify_id,
        name: row.track_name,
        durationMs: row.track_duration_ms,
        explicit: Boolean(row.track_explicit),
      },
      album: {
        id: row.album_spotify_id,
        name: row.album_name,
        imageUrl: row.album_image_url,
      },
      artists: topTrackArtists.get(row.track_id) ?? [],
      playCount: row.play_count,
      listeningTimeMs: row.listening_time_ms,
    })),
    patterns: {
      listeningClock: buildOrderedBuckets(
        Array.from({ length: 24 }, (_, hour) => ({
          key: String(hour),
          label: formatHourLabel(hour),
          count: bucketMaps.hour.get(hour) ?? 0,
        })),
        totalScrobbles,
      ),
      weekdayActivity: buildOrderedBuckets(
        WEEKDAY_ORDER.map((weekday) => ({
          key: String(weekday),
          label: WEEKDAY_LABELS.get(weekday) ?? String(weekday),
          count: bucketMaps.weekday.get(weekday) ?? 0,
        })),
        totalScrobbles,
      ),
      byDecade: buildOrderedBuckets(
        Array.from(bucketMaps.decade.entries()).map(([label, count]) => ({
          key: label,
          label,
          count,
        })),
        totalScrobbles,
      ),
    },
    composition: {
      releaseFormatMix: buildOrderedBuckets(
        [
          { key: "album", label: "Albums", count: bucketMaps.releaseFormat.get("album") ?? 0 },
          { key: "single", label: "Singles", count: bucketMaps.releaseFormat.get("single") ?? 0 },
          { key: "other", label: "Other", count: bucketMaps.releaseFormat.get("other") ?? 0 },
        ],
        totalScrobbles,
      ),
      explicitMix: buildOrderedBuckets(
        [
          { key: "explicit", label: "Explicit", count: bucketMaps.explicit.get("explicit") ?? 0 },
          { key: "clean", label: "Clean", count: bucketMaps.explicit.get("clean") ?? 0 },
        ],
        totalScrobbles,
      ),
    },
  };
}

function resolveReportPeriod(
  database: DatabaseContext,
  timeframe: ReportTimeframe,
  offset: number,
  now: Date,
  timeZone: string,
): ReportPeriod {
  if (timeframe === "all") {
    const bounds = database.client
      .prepare(
        `
        SELECT
          MIN(played_at) AS first_played_at,
          MAX(played_at) AS last_played_at
        FROM plays
        `,
      )
      .get() as {
      first_played_at: string | null;
      last_played_at: string | null;
    };

    return {
      timeframe,
      offset: 0,
      label: "All time",
      periodStart: bounds.first_played_at ? new Date(bounds.first_played_at) : null,
      periodEnd: bounds.last_played_at ? new Date(bounds.last_played_at) : null,
      periodStartIso: bounds.first_played_at ? new Date(bounds.first_played_at).toISOString() : null,
      periodEndIso: bounds.last_played_at ? new Date(bounds.last_played_at).toISOString() : null,
      isCurrentPeriod: true,
    };
  }

  const safeOffset = Math.max(offset, 0);
  const zonedNow = getLocalDateParts(now, timeZone);

  if (timeframe === "week") {
    const currentStart = startOfWeekLocal(zonedNow);
    const periodStart = addLocalDays(currentStart, -safeOffset * 7);
    const periodEnd = safeOffset === 0 ? now : localDateTimeToUtc(endOfLocalDay(addLocalDays(periodStart, 6)), timeZone, 999);
    return buildResolvedPeriod(timeframe, safeOffset, periodStart, periodEnd, timeZone, zonedNow);
  }

  if (timeframe === "month") {
    const currentStart = {
      year: zonedNow.year,
      month: zonedNow.month,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    } satisfies LocalDateParts;
    const periodStart = addLocalMonths(currentStart, -safeOffset);
    const periodEnd = safeOffset === 0 ? now : localDateTimeToUtc(endOfLocalMonth(periodStart), timeZone, 999);
    return buildResolvedPeriod(timeframe, safeOffset, periodStart, periodEnd, timeZone, zonedNow);
  }

  if (timeframe === "year") {
    const periodStart = {
      year: zonedNow.year - safeOffset,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    } satisfies LocalDateParts;
    const periodEnd =
      safeOffset === 0
        ? now
        : localDateTimeToUtc(
            {
              year: periodStart.year,
              month: 12,
              day: 31,
              hour: 23,
              minute: 59,
              second: 59,
            },
            timeZone,
            999,
          );
    return buildResolvedPeriod(timeframe, safeOffset, periodStart, periodEnd, timeZone, zonedNow);
  }

  const endYear = zonedNow.year - safeOffset * 5;
  const startYear = endYear - 4;
  const periodStart = {
    year: startYear,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  } satisfies LocalDateParts;
  const periodEnd =
    safeOffset === 0
      ? now
      : localDateTimeToUtc(
          {
            year: endYear,
            month: 12,
            day: 31,
            hour: 23,
            minute: 59,
            second: 59,
          },
          timeZone,
          999,
        );
  return buildResolvedPeriod(timeframe, safeOffset, periodStart, periodEnd, timeZone, zonedNow);
}

function buildResolvedPeriod(
  timeframe: Exclude<ReportTimeframe, "all">,
  offset: number,
  periodStart: LocalDateParts,
  periodEnd: Date,
  timeZone: string,
  zonedNow: LocalDateParts,
): ReportPeriod {
  const periodStartUtc = localDateTimeToUtc(periodStart, timeZone);
  const periodEndParts = offset === 0 ? zonedNow : getLocalDateParts(periodEnd, timeZone);

  return {
    timeframe,
    offset,
    label: formatPeriodLabel(timeframe, periodStart, periodEndParts),
    periodStart: periodStartUtc,
    periodEnd,
    periodStartIso: periodStartUtc.toISOString(),
    periodEndIso: periodEnd.toISOString(),
    isCurrentPeriod: offset === 0,
  };
}

function getSqlRange(period: ReportPeriod): SqlRange {
  if (!period.periodStartIso || !period.periodEndIso) {
    return {
      clause: "",
      params: [],
    };
  }

  return {
    clause: "WHERE plays.played_at >= ? AND plays.played_at <= ?",
    params: [period.periodStartIso, period.periodEndIso],
  };
}

function getCount(database: DatabaseContext, sql: string, ...params: unknown[]) {
  const row = database.client.prepare(sql).get(...params) as { total: number };
  return row.total;
}

function hasEarlierData(database: DatabaseContext, periodStartIso: string | null) {
  if (!periodStartIso) {
    return false;
  }

  const row = database.client
    .prepare(
      `
      SELECT EXISTS(
        SELECT 1
        FROM plays
        WHERE played_at < ?
      ) AS has_earlier
      `,
    )
    .get(periodStartIso) as { has_earlier: number };

  return Boolean(row.has_earlier);
}

function getOwnerArtistMap(
  database: DatabaseContext,
  relationTable: "track_artists" | "album_artists",
  ownerColumn: "track_id" | "album_id",
  ownerIds: number[],
) {
  if (ownerIds.length === 0) {
    return new Map<number, Array<{ id: string; name: string }>>();
  }

  const placeholders = ownerIds.map(() => "?").join(", ");
  const rows = database.client
    .prepare(
      `
      SELECT
        ${relationTable}.${ownerColumn} AS owner_id,
        artists.spotify_id AS artist_spotify_id,
        artists.name AS artist_name
      FROM ${relationTable}
      JOIN artists ON artists.id = ${relationTable}.artist_id
      WHERE ${relationTable}.${ownerColumn} IN (${placeholders})
      ORDER BY ${relationTable}.${ownerColumn} ASC, artists.name COLLATE NOCASE ASC, artists.spotify_id ASC
      `,
    )
    .all(...ownerIds) as Array<{
    owner_id: number;
    artist_spotify_id: string;
    artist_name: string;
  }>;

  const artistMap = new Map<number, Array<{ id: string; name: string }>>();

  for (const row of rows) {
    const current = artistMap.get(row.owner_id) ?? [];
    current.push({
      id: row.artist_spotify_id,
      name: row.artist_name,
    });
    artistMap.set(row.owner_id, current);
  }

  return artistMap;
}

function parseFirstImageUrl(imagesJson: string | null) {
  if (!imagesJson) {
    return null;
  }

  try {
    const images = JSON.parse(imagesJson) as Array<{ url?: unknown }> | null;
    const firstUrl = images?.find((image) => typeof image?.url === "string")?.url;
    return typeof firstUrl === "string" ? firstUrl : null;
  } catch {
    return null;
  }
}

function buildOrderedBuckets(
  rows: Array<{ key: string; label: string; count: number }>,
  total: number,
): ReportBucket[] {
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? row.count / total : 0,
  }));
}

function getAverageDayCount(period: ReportPeriod, now: Date, timeZone: string) {
  if (!period.periodStart) {
    return 0;
  }

  const effectiveEnd = period.isCurrentPeriod ? now : period.periodEnd ?? now;
  const localStart = getLocalDateParts(period.periodStart, timeZone);
  const localEnd = getLocalDateParts(effectiveEnd, timeZone);
  return diffLocalCalendarDays(localStart, localEnd) + 1;
}

function getLongestStreakDays(days: string[]) {
  if (days.length === 0) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < days.length; index += 1) {
    const previous = startOfDay(new Date(days[index - 1]));
    const next = startOfDay(new Date(days[index]));
    const gap = diffCalendarDays(previous, next);

    if (gap === 1) {
      current += 1;
      longest = Math.max(longest, current);
      continue;
    }

    current = 1;
  }

  return longest;
}

function formatPeriodLabel(timeframe: Exclude<ReportTimeframe, "all">, start: LocalDateParts, end: LocalDateParts) {
  if (timeframe === "month") {
    return formatCalendarLabel(start, { month: "long", year: "numeric" });
  }

  if (timeframe === "year") {
    return String(start.year);
  }

  if (timeframe === "5y") {
    if (start.year === end.year) {
      return String(start.year);
    }

    return `${start.year}–${end.year}`;
  }

  const sameYear = start.year === end.year;
  const startLabel = formatCalendarLabel(start, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endLabel = formatCalendarLabel(end, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function formatHourLabel(hour: number) {
  const normalizedHour = hour % 24;
  const suffix = normalizedHour < 12 ? "AM" : "PM";
  const twelveHour = normalizedHour % 12 || 12;
  return `${twelveHour}${suffix}`;
}

function diffCalendarDays(left: Date, right: Date) {
  const leftUtc = Date.UTC(left.getFullYear(), left.getMonth(), left.getDate());
  const rightUtc = Date.UTC(right.getFullYear(), right.getMonth(), right.getDate());
  return Math.round((rightUtc - leftUtc) / 86_400_000);
}

function diffLocalCalendarDays(
  left: Pick<LocalDateParts, "year" | "month" | "day">,
  right: Pick<LocalDateParts, "year" | "month" | "day">,
) {
  const leftUtc = Date.UTC(left.year, left.month - 1, left.day);
  const rightUtc = Date.UTC(right.year, right.month - 1, right.day);
  return Math.round((rightUtc - leftUtc) / 86_400_000);
}

function buildPatternBuckets(
  rows: Array<{
    played_at: string;
    duration_ms: number;
    track_explicit: number;
    album_release_date: string | null;
    album_type: string | null;
  }>,
  timeZone: string,
) {
  const daily = new Map<string, { playCount: number; listeningTimeMs: number }>();
  const hour = new Map<number, number>();
  const weekday = new Map<number, number>();
  const decade = new Map<string, number>();
  const releaseFormat = new Map<string, number>();
  const explicit = new Map<string, number>();

  for (const row of rows) {
    const localParts = getLocalDateParts(new Date(row.played_at), timeZone);
    const localDay = formatIsoLocalDay(localParts);
    const currentDay = daily.get(localDay) ?? { playCount: 0, listeningTimeMs: 0 };
    currentDay.playCount += 1;
    currentDay.listeningTimeMs += row.duration_ms;
    daily.set(localDay, currentDay);

    hour.set(localParts.hour, (hour.get(localParts.hour) ?? 0) + 1);
    const weekdayValue = new Date(Date.UTC(localParts.year, localParts.month - 1, localParts.day)).getUTCDay();
    weekday.set(weekdayValue, (weekday.get(weekdayValue) ?? 0) + 1);

    const decadeLabel = getDecadeLabel(row.album_release_date);
    decade.set(decadeLabel, (decade.get(decadeLabel) ?? 0) + 1);

    const formatKey = getReleaseFormatKey(row.album_type);
    releaseFormat.set(formatKey, (releaseFormat.get(formatKey) ?? 0) + 1);

    const explicitKey = row.track_explicit ? "explicit" : "clean";
    explicit.set(explicitKey, (explicit.get(explicitKey) ?? 0) + 1);
  }

  return {
    daily,
    hour,
    weekday,
    decade: sortDecadeMap(decade),
    releaseFormat,
    explicit,
  };
}

function getLocalDateParts(value: Date, timeZone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(value);
  return {
    year: getNumberPart(parts, "year"),
    month: getNumberPart(parts, "month"),
    day: getNumberPart(parts, "day"),
    hour: getNumberPart(parts, "hour"),
    minute: getNumberPart(parts, "minute"),
    second: getNumberPart(parts, "second"),
  };
}

function localDateTimeToUtc(parts: LocalDateParts, timeZone: string, milliseconds = 0) {
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, milliseconds);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  let candidate = utcGuess - offset;
  const adjustedOffset = getTimeZoneOffsetMs(new Date(candidate), timeZone);
  if (adjustedOffset !== offset) {
    candidate = utcGuess - adjustedOffset;
  }

  return new Date(candidate);
}

function getTimeZoneOffsetMs(value: Date, timeZone: string) {
  const parts = getLocalDateParts(value, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const utcAsSeconds = Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
    value.getUTCHours(),
    value.getUTCMinutes(),
    value.getUTCSeconds(),
  );
  return localAsUtc - utcAsSeconds;
}

function getNumberPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((part) => part.type === type)?.value;
  return Number.parseInt(value ?? "0", 10);
}

function startOfWeekLocal(value: LocalDateParts) {
  const weekday = new Date(Date.UTC(value.year, value.month - 1, value.day)).getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addLocalDays({
    year: value.year,
    month: value.month,
    day: value.day,
    hour: 0,
    minute: 0,
    second: 0,
  }, delta);
}

function addLocalDays(value: LocalDateParts, days: number): LocalDateParts {
  const shifted = new Date(Date.UTC(value.year, value.month - 1, value.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: value.hour,
    minute: value.minute,
    second: value.second,
  };
}

function addLocalMonths(value: LocalDateParts, months: number): LocalDateParts {
  const shifted = new Date(Date.UTC(value.year, value.month - 1 + months, 1));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  };
}

function endOfLocalDay(value: LocalDateParts): LocalDateParts {
  return { ...value, hour: 23, minute: 59, second: 59 };
}

function endOfLocalMonth(value: LocalDateParts): LocalDateParts {
  const monthStart = new Date(Date.UTC(value.year, value.month, 0));
  return {
    year: monthStart.getUTCFullYear(),
    month: monthStart.getUTCMonth() + 1,
    day: monthStart.getUTCDate(),
    hour: 23,
    minute: 59,
    second: 59,
  };
}

function formatCalendarLabel(
  value: Pick<LocalDateParts, "year" | "month" | "day">,
  options: Intl.DateTimeFormatOptions,
) {
  return new Date(Date.UTC(value.year, value.month - 1, value.day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    ...options,
  });
}

function formatIsoLocalDay(value: Pick<LocalDateParts, "year" | "month" | "day">) {
  return `${value.year.toString().padStart(4, "0")}-${value.month.toString().padStart(2, "0")}-${value.day.toString().padStart(2, "0")}`;
}

function getDecadeLabel(releaseDate: string | null) {
  if (!releaseDate || releaseDate.length < 4) {
    return "Unknown";
  }

  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  if (!Number.isFinite(year)) {
    return "Unknown";
  }

  return `${Math.floor(year / 10) * 10}s`;
}

function getReleaseFormatKey(albumType: string | null) {
  const normalized = albumType?.toLowerCase() ?? "";
  if (normalized === "album") return "album";
  if (normalized === "single") return "single";
  return "other";
}

function sortDecadeMap(decade: Map<string, number>) {
  return new Map(
    Array.from(decade.entries()).sort(([leftLabel], [rightLabel]) => {
      if (leftLabel === "Unknown") return 1;
      if (rightLabel === "Unknown") return -1;
      return leftLabel.localeCompare(rightLabel);
    }),
  );
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}
