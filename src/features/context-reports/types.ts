import type { ReactElement } from "react";

/**
 * Every context's `/reports/.../freshness` endpoint answers this exact
 * shape (see e.g. facility-layout's `freshnessDTO` in
 * internal/adapters/inbound/http/reports_handler.go, mirrored byte-for-byte
 * in all eight other reports handlers this shell reads from).
 */
export interface ReportFreshness {
  lagSeconds: number;
}

/**
 * Config for ContextReportScreen: one bounded context's report, wired to
 * its OWN reports endpoint directly (never console-bff/ops-agent -- see
 * this repo's contrast with WmsDashboardScreen/WesDashboardScreen, which
 * DO go through the BFF's aggregated envelope).
 *
 * Every context's report DTO is genuinely different (different domain,
 * different metric names, different bucket dimensions -- funnel stages
 * for order-management, per-SKU/bin rows for inventory-storage, a
 * totals+byTaskType breakdown for labor-performance, and so on), so this
 * config does NOT try to force them into one shared row/column shape.
 * `renderBody` is the one place a context's own adapter decides how its
 * real DTO maps onto the shared ui-kit primitives (DataTable, BarChart,
 * LineChart, FunnelChart, Card).
 */
export interface ContextReportConfig<TDto> {
  /** The bounded context's own name, e.g. "facility-layout". Used in copy
   *  and as the React key/test id, never guessed at render time. */
  contextId: string;
  /** Human heading for the screen, e.g. "Facility: Catalog Growth". */
  title: string;
  /** One-line description of what this report measures. */
  subtitle: string;
  /** Full URL (including any required from/to/granularity query params)
   *  for `GET /reports/<name>` on this context's OWN service -- never
   *  the console-bff. */
  reportUrl: string;
  /** Full URL for this context's sibling `GET /reports/<name>/freshness`. */
  freshnessUrl: string;
  /** Maps the real DTO onto Cards/DataTable/chart primitives. Receives
   *  only a non-null DTO -- ContextReportScreen owns loading/error/empty
   *  states above this. */
  renderBody: (data: TDto) => ReactElement;
}
