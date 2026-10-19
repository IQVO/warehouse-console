import type { ReactElement } from "react";
import { BarChart, Card, DataTable, FunnelChart, LineChart } from "@warehouse/ui-kit";
import { formatDuration, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { formatReportDay, trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * pick-face-replenishment's "Replenishment Funnel" report.
 *
 * Real endpoint + DTO shape read from pick-face-replenishment/apis/openapi.yaml
 * (ReplenishmentFunnelReport, served by the pfr-reports binary):
 *
 *   GET /reports/replenishment-funnel?from=&to=&siteId=&granularity=day
 *   -> { from, to, site_id?, granularity,
 *        days: [{ day, requests_raised, units_requested,
 *                 requests_completed, units_replenished, requests_cancelled,
 *                 completion_latency: { count, p50_seconds, p95_seconds },
 *                 policies_declared }] }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * Dense (zero days included), one row per UTC day. `completion_latency` is
 * the requested-to-completed time of requests completed in the day whose
 * request the projection also saw; p50/p95 are null when `count` is 0 and
 * render as no reading, never a fabricated 0s. A completed request without a
 * seen request counts in `requests_completed` but has no latency, so
 * `completion_latency.count` can be lower than `requests_completed`. The
 * screen asks for every site (no siteId). Wire is snake_case; DTOs mirror it.
 * Trailing 30 days. Freshness is the context-level /reports/freshness.
 */
export interface CompletionLatencyTimingDto {
  count: number;
  p50_seconds: number | null;
  p95_seconds: number | null;
}

export interface ReplenishmentFunnelDayDto {
  day: string;
  requests_raised: number;
  units_requested: number;
  requests_completed: number;
  units_replenished: number;
  requests_cancelled: number;
  completion_latency: CompletionLatencyTimingDto;
  policies_declared: number;
}

export interface ReplenishmentFunnelReportDto {
  from: string;
  to: string;
  site_id?: string;
  granularity: string;
  days: ReplenishmentFunnelDayDto[];
}

const WINDOW = trailingDays(30);

function raisedSeries(
  days: ReplenishmentFunnelDayDto[],
): { label: string; value: number }[] {
  return [...days]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ label: formatReportDay(d.day), value: d.requests_raised }));
}

function renderBody(data: ReplenishmentFunnelReportDto): ReactElement {
  const days = data.days;
  const sum = (pick: (d: ReplenishmentFunnelDayDto) => number) =>
    days.reduce((acc, d) => acc + pick(d), 0);
  const raised = sum((d) => d.requests_raised);
  const completed = sum((d) => d.requests_completed);
  const cancelled = sum((d) => d.requests_cancelled);
  const unitsRequested = sum((d) => d.units_requested);
  const unitsReplenished = sum((d) => d.units_replenished);
  const policies = sum((d) => d.policies_declared);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Requests Raised per Day">
          <LineChart
            title="RAISED"
            data={raisedSeries(days)}
            emptyState={<div>No replenishment requests in this window.</div>}
          />
        </Card>
        <Card title="Request Funnel (Window Totals)">
          {/* Cancelled is not a stage after Completed, so it is a plain
              count below the funnel, not a third (falsely "dropped") stage. */}
          <FunnelChart
            title="REPLENISHMENT REQUESTS"
            stages={[
              { label: "Raised", value: raised },
              { label: "Completed", value: completed },
            ]}
            emptyState={<div>No replenishment requests in this window.</div>}
          />
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "var(--wh-space-2)",
              margin: "var(--wh-space-3) 0 0",
            }}
          >
            <dt>Cancelled</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>{formatNumber(cancelled)}</dd>
          </dl>
        </Card>
        <Card title="Units (Window Totals)">
          <BarChart
            title="UNITS"
            data={[
              { label: "Requested", value: unitsRequested },
              { label: "Replenished", value: unitsReplenished },
            ]}
            emptyState={<div>No replenishment requests in this window.</div>}
          />
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "var(--wh-space-2)",
              margin: "var(--wh-space-3) 0 0",
            }}
          >
            <dt>Policy versions declared</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>{formatNumber(policies)}</dd>
          </dl>
        </Card>
      </div>

      <Card title="Replenishment by Day" padded={false}>
        <DataTable<ReplenishmentFunnelDayDto>
          columns={[
            { key: "day", header: "Day", render: (d) => formatReportDay(d.day) },
            {
              key: "requests_raised",
              header: "Raised",
              align: "right",
              render: (d) => formatNumber(d.requests_raised),
            },
            {
              key: "units_requested",
              header: "Units Requested",
              align: "right",
              render: (d) => formatNumber(d.units_requested),
            },
            {
              key: "requests_completed",
              header: "Completed",
              align: "right",
              render: (d) => formatNumber(d.requests_completed),
            },
            {
              key: "units_replenished",
              header: "Units Replenished",
              align: "right",
              render: (d) => formatNumber(d.units_replenished),
            },
            {
              key: "requests_cancelled",
              header: "Cancelled",
              align: "right",
              render: (d) => formatNumber(d.requests_cancelled),
            },
            {
              key: "policies_declared",
              header: "Policies Declared",
              align: "right",
              render: (d) => formatNumber(d.policies_declared),
            },
            {
              key: "completion_p50",
              header: "Completion p50",
              align: "right",
              render: (d) => formatDuration(d.completion_latency.p50_seconds),
            },
            {
              key: "completion_p95",
              header: "Completion p95",
              align: "right",
              render: (d) => formatDuration(d.completion_latency.p95_seconds),
            },
          ]}
          rows={days}
          rowKey={(d) => d.day}
          emptyState={<div>No replenishment requests in this window.</div>}
        />
      </Card>
    </>
  );
}

export const pickFaceReplenishmentFunnelConfig: ContextReportConfig<ReplenishmentFunnelReportDto> =
  {
    contextId: "pick-face-replenishment",
    title: "Pick-Face Replenishment: Funnel",
    subtitle:
      "Replenishment requests raised, completed and cancelled per day, units requested vs replenished, policy versions declared, and requested-to-completed latency percentiles. Trailing 30 days, every site.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.pickFaceReplenishment}/reports/replenishment-funnel`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.pickFaceReplenishment}/reports/freshness`,
    renderBody,
  };
