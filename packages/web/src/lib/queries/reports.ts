import { useQuery } from "@tanstack/react-query";

import { api, type ReportTimeframe } from "../api";
import { getUserTimeZone } from "../datetime";
import { queryKeys } from "./common";

export function useReportQuery(enabled: boolean, timeframe: ReportTimeframe, offset: number) {
  const timeZone = getUserTimeZone();

  return useQuery({
    queryKey: queryKeys.report(timeframe, offset, timeZone),
    queryFn: () => api.getReport(timeframe, offset),
    enabled,
    staleTime: 15_000,
  });
}
