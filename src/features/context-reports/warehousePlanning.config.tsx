import type { ReactElement } from "react";
import { BarChart, Card, DataTable, LineChart } from "@warehouse/ui-kit";
import { formatInstant, formatNumber, formatPercent } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * warehouse-planning's "Shortage Trend" report.
 *
 * Real endpoint + DTO shape read directly from
 * warehouse-planning/apis/openapi.yaml (ShortageTrendReport) and
 * internal/adapters/inbound/http/reports_handler.go (shortageDayDTO,
 * served by the planning-reports binary):
 *
 *   GET /reports/shortage-trend?from=&to=
 *   -> { from, to, days: [{ day, warehouse_id, location,
 *                           plans_published, plans_with_shortage,
 *                           total_shortage, shortage_rate }] }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * The wire shape is snake_case (like the analytics event payloads), so the
 * DTO interfaces below mirror the wire exactly and normalization happens
 * here in the render helpers, not by renaming the contract. This context's
 * freshness is the CONTEXT-LEVEL /reports/freshness (one projection behind
 * bottleneck-frequency, shortage-trend and plan-throughput), not a
 * per-report sibling like the first nine screens' readers serve.
 *
 * warehouse-planning also serves /reports/bottleneck-frequency and
 * /reports/plan-throughput; each has its own screen
 * (warehousePlanningBottleneckFrequency.config.tsx,
 * warehousePlanningPlanThroughput.config.tsx) so the one-URL-per-screen
 * convention every other config follows still holds. This one keeps the
 * bare `warehouse-planning` slug (the most operational: plans shipping
 * short of capacity).
 *
 * Day-bucketed (`day` is a UTC calendar date; from/to default to the
 * trailing 30 days server-side), so the screen asks for a trailing 30-day
 * window -- a 24h window would return at most one day row.
 */
export interface ShortageTrendDayDto {
  day: string;
  warehouse_id: string;
  location: string;
  plans_published: number;
  plans_with_shortage: number;
  total_shortage: number;
  shortage_rate: number;
}

export interface ShortageTrendReportDto {
  from: string;
  to: string;
  days: ShortageTrendDayDto[];
}

const WINDOW = trailingDays(30);

function dailyShortageSeries(
  days: ShortageTrendDayDto[],
): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of days) {
    totals.set(row.day, (totals.get(row.day) ?? 0) + row.total_shortage);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ label: formatInstant(day), value }));
}

function renderBody(data: ShortageTrendReportDto): ReactElement {
  const days = data.days;
  const published = days.reduce((acc, d) => acc + d.plans_published, 0);
  const withShortage = days.reduce((acc, d) => acc + d.plans_with_shortage, 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Total Shortage per Day">
          <LineChart
            title="SHORTAGE (ORDERS)"
            data={dailyShortageSeries(days)}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Published vs With Shortage">
          <BarChart
            title="PLANS"
            data={[
              { label: "Published", value: published },
              { label: "With Shortage", value: withShortage },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Shortage by Day / Site" padded={false}>
        <DataTable<ShortageTrendDayDto>
          columns={[
            { key: "day", header: "Day", render: (d) => formatInstant(d.day) },
            {
              key: "site",
              header: "Site",
              render: (d) =>
                d.warehouse_id || d.location
                  ? `${d.warehouse_id}/${d.location}`
                  : "—",
            },
            {
              key: "plans_published",
              header: "Published",
              align: "right",
              render: (d) => formatNumber(d.plans_published),
            },
            {
              key: "plans_with_shortage",
              header: "With Shortage",
              align: "right",
              render: (d) => formatNumber(d.plans_with_shortage),
            },
            {
              key: "total_shortage",
              header: "Shortage (Orders)",
              align: "right",
              render: (d) => formatNumber(d.total_shortage),
            },
            {
              key: "shortage_rate",
              header: "Shortage Rate",
              align: "right",
              render: (d) => formatPercent(d.shortage_rate * 100),
            },
          ]}
          rows={days}
          rowKey={(d) => `${d.warehouse_id}-${d.location}-${d.day}`}
          emptyState={<div>No published plans in this window.</div>}
        />
      </Card>
    </>
  );
}

export const warehousePlanningShortageConfig: ContextReportConfig<ShortageTrendReportDto> =
  {
    contextId: "warehouse-planning",
    title: "Capacity Planning: Shortage Trend",
    subtitle:
      "Published capacity plans that ship short of demand, per site per day -- plans published, plans with shortage, total shortage in orders. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.warehousePlanning}/reports/shortage-trend`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.warehousePlanning}/reports/freshness`,
    renderBody,
  };
