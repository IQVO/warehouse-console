import type { ReactElement } from "react";
import { BarChart, Card, DataTable, LineChart } from "@warehouse/ui-kit";
import { formatDuration, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { formatReportDay, trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * warehouse-planning's "Plan Throughput" report.
 *
 * Real endpoint + DTO shape read from warehouse-planning/apis/openapi.yaml
 * (PlanThroughputReport / PlanThroughputDay / PlanLatency, served by the
 * planning-reports binary):
 *
 *   GET /reports/plan-throughput?from=&to=
 *   -> { from, to,
 *        days:    [{ warehouse_id, location, day, plans_created,
 *                    plans_published }],
 *        latency: [{ warehouse_id, location, plans, median_seconds,
 *                    p95_seconds }] }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * `days` counts plans created (CapacityPlanCreated) and published
 * (CapacityPlanPublished) per site per UTC day. `latency` is per site over the
 * plans published in the range whose creation was also observed, so it can be
 * absent for a site that published only plans created before the window --
 * the table says so rather than printing zeros. The wire is snake_case, so the
 * DTOs mirror it and normalization lives in the render helpers.
 *
 * Day-bucketed: trailing 30 days. Sibling of the Shortage Trend and Bottleneck
 * Frequency screens; all read the same context-level /reports/freshness.
 */
export interface PlanThroughputDayDto {
  warehouse_id: string;
  location: string;
  day: string;
  plans_created: number;
  plans_published: number;
}

export interface PlanLatencyDto {
  warehouse_id: string;
  location: string;
  plans: number;
  median_seconds: number;
  p95_seconds: number;
}

export interface PlanThroughputReportDto {
  from: string;
  to: string;
  days: PlanThroughputDayDto[];
  latency: PlanLatencyDto[];
}

const WINDOW = trailingDays(30);

function siteLabel(row: { warehouse_id: string; location: string }): string {
  return row.warehouse_id || row.location
    ? `${row.warehouse_id}/${row.location}`
    : "—";
}

function dailyPublishedSeries(
  days: PlanThroughputDayDto[],
): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of days) {
    totals.set(row.day, (totals.get(row.day) ?? 0) + row.plans_published);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ label: formatReportDay(day), value }));
}

function renderBody(data: PlanThroughputReportDto): ReactElement {
  const days = data.days;
  const created = days.reduce((acc, d) => acc + d.plans_created, 0);
  const published = days.reduce((acc, d) => acc + d.plans_published, 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Plans Published per Day">
          <LineChart
            title="PUBLISHED"
            data={dailyPublishedSeries(days)}
            emptyState={<div>No plan activity in this window.</div>}
          />
        </Card>
        <Card title="Created vs Published (Window Totals)">
          <BarChart
            title="PLANS"
            data={[
              { label: "Created", value: created },
              { label: "Published", value: published },
            ]}
            emptyState={<div>No plan activity in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Plans Created / Published by Day / Site" padded={false}>
        <DataTable<PlanThroughputDayDto>
          columns={[
            { key: "day", header: "Day", render: (d) => formatReportDay(d.day) },
            { key: "site", header: "Site", render: (d) => siteLabel(d) },
            {
              key: "plans_created",
              header: "Created",
              align: "right",
              render: (d) => formatNumber(d.plans_created),
            },
            {
              key: "plans_published",
              header: "Published",
              align: "right",
              render: (d) => formatNumber(d.plans_published),
            },
          ]}
          rows={days}
          rowKey={(d) => `${d.warehouse_id}-${d.location}-${d.day}`}
          emptyState={<div>No plan activity in this window.</div>}
        />
      </Card>

      <Card title="Create-to-Publish Latency by Site" padded={false}>
        <DataTable<PlanLatencyDto>
          columns={[
            { key: "site", header: "Site", render: (l) => siteLabel(l) },
            {
              key: "plans",
              header: "Plans Measured",
              align: "right",
              render: (l) => formatNumber(l.plans),
            },
            {
              key: "median_seconds",
              header: "Median",
              align: "right",
              render: (l) => formatDuration(l.median_seconds),
            },
            {
              key: "p95_seconds",
              header: "p95",
              align: "right",
              render: (l) => formatDuration(l.p95_seconds),
            },
          ]}
          rows={data.latency}
          rowKey={(l) => `${l.warehouse_id}-${l.location}`}
          emptyState={
            <div>
              No published plan in this window had its creation observed, so
              there is no latency to report.
            </div>
          }
        />
      </Card>
    </>
  );
}

export const warehousePlanningPlanThroughputConfig: ContextReportConfig<PlanThroughputReportDto> =
  {
    contextId: "warehouse-planning",
    title: "Capacity Planning: Plan Throughput",
    subtitle:
      "Capacity plans created vs published per site per day, and the create-to-publish latency (median and p95) per site. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.warehousePlanning}/reports/plan-throughput`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.warehousePlanning}/reports/freshness`,
    renderBody,
  };
