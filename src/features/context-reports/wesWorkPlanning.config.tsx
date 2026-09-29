import type { ReactElement } from "react";
import { BarChart, Card, DataTable, LineChart } from "@warehouse/ui-kit";
import { formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingHours, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * wes-work-planning's "Release Throughput & Backlog Health" report.
 *
 * Real endpoint + DTO shape read directly from
 * wes-work-planning/internal/adapters/inbound/http/reports_handler.go:
 *
 *   GET /reports/throughput?from=&to=&pathId=&granularity=hour
 *   -> { rows: [{ pathId, hourBucket, workReleased, workUnitCompleted,
 *                 backlogThresholdBreached, pathThrottled,
 *                 rateDeviationDetected }] }
 *   GET /reports/throughput/freshness -> { lagSeconds }
 *
 * Distinct DTO from fulfillment-execution's own /reports/throughput
 * despite the same endpoint NAME -- different fields (workReleased /
 * workUnitCompleted / backlogThresholdBreached / pathThrottled /
 * rateDeviationDetected vs completions / avgClaimToCompleteSeconds /
 * leaseExpiries / weighCheckDiverts), because each is that context's own
 * data product, not a shared shape.
 */
export interface WesThroughputRowDto {
  pathId: string;
  hourBucket: string;
  workReleased: number;
  workUnitCompleted: number;
  backlogThresholdBreached: number;
  pathThrottled: number;
  rateDeviationDetected: number;
}

export interface WesThroughputReportDto {
  rows: WesThroughputRowDto[];
}

const WINDOW = trailingHours(24);

function hourlyReleaseSeries(
  rows: WesThroughputRowDto[],
): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.hourBucket, (totals.get(row.hourBucket) ?? 0) + row.workReleased);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, value]) => ({ label: formatInstant(bucket), value }));
}

function renderBody(data: WesThroughputReportDto): ReactElement {
  const rows = data.rows;
  const backlogBreaches = rows.reduce((acc, r) => acc + r.backlogThresholdBreached, 0);
  const throttled = rows.reduce((acc, r) => acc + r.pathThrottled, 0);
  const rateDeviations = rows.reduce((acc, r) => acc + r.rateDeviationDetected, 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Work Released per Hour">
          <LineChart
            title="RELEASED"
            data={hourlyReleaseSeries(rows)}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Backlog Health Signals">
          <BarChart
            title="SIGNALS"
            tone="warning"
            data={[
              { label: "Backlog Breaches", value: backlogBreaches },
              { label: "Path Throttled", value: throttled },
              { label: "Rate Deviations", value: rateDeviations },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Throughput by Path / Hour" padded={false}>
        <DataTable<WesThroughputRowDto>
          columns={[
            { key: "hourBucket", header: "Hour", render: (r) => formatInstant(r.hourBucket) },
            { key: "pathId", header: "Path", render: (r) => r.pathId || "—" },
            {
              key: "workReleased",
              header: "Released",
              align: "right",
              render: (r) => formatNumber(r.workReleased),
            },
            {
              key: "workUnitCompleted",
              header: "Completed",
              align: "right",
              render: (r) => formatNumber(r.workUnitCompleted),
            },
            {
              key: "backlogThresholdBreached",
              header: "Backlog Breached",
              align: "right",
              render: (r) => formatNumber(r.backlogThresholdBreached),
            },
            {
              key: "pathThrottled",
              header: "Throttled",
              align: "right",
              render: (r) => formatNumber(r.pathThrottled),
            },
          ]}
          rows={rows}
          rowKey={(r) => `${r.pathId}-${r.hourBucket}`}
          emptyState={<div>No release activity in this window.</div>}
        />
      </Card>
    </>
  );
}

export const wesThroughputConfig: ContextReportConfig<WesThroughputReportDto> = {
  contextId: "wes-work-planning",
  title: "Planning: Release Throughput & Backlog",
  subtitle:
    "Continuous release, backlog threshold health and flow-balance signals by path. Trailing 24 hours.",
  reportUrl: withWindow(`${REPORTS_BASE_URL.wesWorkPlanning}/reports/throughput`, WINDOW),
  freshnessUrl: `${REPORTS_BASE_URL.wesWorkPlanning}/reports/throughput/freshness`,
  renderBody,
};
