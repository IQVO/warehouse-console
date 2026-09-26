import type { ReactElement } from "react";
import { BarChart, Card, DataTable, LineChart } from "@warehouse/ui-kit";
import { formatDuration, formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingHours, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * fulfillment-execution's pick/pack/SLAM throughput report.
 *
 * Real endpoint + DTO shape read directly from
 * fulfillment-execution/internal/adapters/inbound/http/reports_handler.go:
 *
 *   GET /reports/throughput?from=&to=&taskType=&stationId=&granularity=hour
 *   -> { rows: [{ taskType, stationId, hourBucket, completions,
 *                 avgClaimToCompleteSeconds, leaseExpiries,
 *                 weighCheckDiverts }] }
 *   GET /reports/throughput/freshness -> { lagSeconds }
 *
 * Hour-bucketed, trailing 24h window (matches console-bff's own documented
 * default for the aggregated WES dashboard).
 */
export interface FulfillmentThroughputRowDto {
  taskType: string;
  stationId: string;
  hourBucket: string;
  completions: number;
  avgClaimToCompleteSeconds: number;
  leaseExpiries: number;
  weighCheckDiverts: number;
}

export interface FulfillmentThroughputReportDto {
  rows: FulfillmentThroughputRowDto[];
}

const WINDOW = trailingHours(24);

function byTaskType(
  rows: FulfillmentThroughputRowDto[],
): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.taskType, (totals.get(row.taskType) ?? 0) + row.completions);
  }
  return [...totals.entries()].map(([label, value]) => ({ label, value }));
}

function hourlySeries(
  rows: FulfillmentThroughputRowDto[],
): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.hourBucket, (totals.get(row.hourBucket) ?? 0) + row.completions);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, value]) => ({ label: formatInstant(bucket), value }));
}

function renderBody(data: FulfillmentThroughputReportDto): ReactElement {
  const rows = data.rows;
  const totalLeaseExpiries = rows.reduce((acc, r) => acc + r.leaseExpiries, 0);
  const totalWeighDiverts = rows.reduce((acc, r) => acc + r.weighCheckDiverts, 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Completions per Hour">
          <LineChart
            title="COMPLETIONS"
            data={hourlySeries(rows)}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Completions by Task Type">
          <BarChart
            title="TASK TYPE"
            data={byTaskType(rows)}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Leases & Diverts">
          <BarChart
            title="EXCEPTIONS"
            tone="warning"
            data={[
              { label: "Lease Expiries", value: totalLeaseExpiries },
              { label: "Weigh-Check Diverts", value: totalWeighDiverts },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Throughput by Task Type / Station / Hour" padded={false}>
        <DataTable<FulfillmentThroughputRowDto>
          columns={[
            { key: "hourBucket", header: "Hour", render: (r) => formatInstant(r.hourBucket) },
            { key: "taskType", header: "Task Type", render: (r) => r.taskType },
            { key: "stationId", header: "Station", render: (r) => r.stationId || "—" },
            {
              key: "completions",
              header: "Completions",
              align: "right",
              render: (r) => formatNumber(r.completions),
            },
            {
              key: "avgClaimToCompleteSeconds",
              header: "Avg Claim→Complete",
              align: "right",
              render: (r) => formatDuration(r.avgClaimToCompleteSeconds),
            },
            {
              key: "leaseExpiries",
              header: "Lease Expiries",
              align: "right",
              render: (r) => formatNumber(r.leaseExpiries),
            },
            {
              key: "weighCheckDiverts",
              header: "Weigh Diverts",
              align: "right",
              render: (r) => formatNumber(r.weighCheckDiverts),
            },
          ]}
          rows={rows}
          rowKey={(r) => `${r.taskType}-${r.stationId}-${r.hourBucket}`}
          emptyState={<div>No completions in this window.</div>}
        />
      </Card>
    </>
  );
}

export const fulfillmentThroughputConfig: ContextReportConfig<FulfillmentThroughputReportDto> =
  {
    contextId: "fulfillment-execution",
    title: "Fulfillment: Throughput",
    subtitle:
      "Pick/pack/SLAM task completions, lease expiries and weigh-check diverts by task type and station. Trailing 24 hours.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.fulfillmentExecution}/reports/throughput`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.fulfillmentExecution}/reports/throughput/freshness`,
    renderBody,
  };
