/**
 * Every per-context `/reports/...` endpoint requires explicit `from`/`to`
 * RFC3339 query parameters -- unlike console-bff's `/console/reports/{wms,wes}`,
 * which defaults to a trailing 24h window itself, hitting a context's own
 * reports service directly means THIS shell has to supply the window.
 *
 * Two lengths are used across the nine contexts' screens:
 *  - hour-bucketed reports (funnel/throughput/flow-accuracy/labor/performance)
 *    default to a trailing 24h window, matching the console-bff's own
 *    documented default so the two feel consistent to an operator switching
 *    between the aggregated WMS/WES dashboards and a single context's detail.
 *  - day-bucketed catalog-growth reports (facility-layout,
 *    process-path-management) default to a trailing 30d window -- a 24h
 *    window would return at most one or two day-buckets, which is not
 *    enough to see a growth trend.
 */
export interface ReportWindow {
  from: string;
  to: string;
}

function isoNow(nowMs: number): string {
  return new Date(nowMs).toISOString();
}

/** Trailing window ending now, `hours` long. */
export function trailingHours(hours: number, nowMs: number = Date.now()): ReportWindow {
  return {
    from: isoNow(nowMs - hours * 60 * 60 * 1000),
    to: isoNow(nowMs),
  };
}

/** Trailing window ending now, `days` long. */
export function trailingDays(days: number, nowMs: number = Date.now()): ReportWindow {
  return trailingHours(days * 24, nowMs);
}

/** Appends `from`/`to` as RFC3339 query params onto a `/reports/<name>` URL. */
export function withWindow(url: string, window: ReportWindow): string {
  const params = new URLSearchParams({ from: window.from, to: window.to });
  return `${url}?${params.toString()}`;
}
