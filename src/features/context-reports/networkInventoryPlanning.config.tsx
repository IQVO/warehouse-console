import type { ReactElement } from "react";
import { BarChart, Card, DataTable, LineChart } from "@warehouse/ui-kit";
import { formatDuration, formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * network-inventory-planning's "Stuck Transfers" report.
 *
 * Real endpoint + DTO shape read directly from
 * network-inventory-planning/apis/openapi.yaml (StuckTransfersReport) and
 * internal/adapters/inbound/http/reports_handler.go (stuckReportDTO,
 * served by the nip-reports binary):
 *
 *   GET /reports/stuck-transfers?from=&to=&limit=   (limit 1..100, default 20)
 *   -> { from, to,
 *        days:   [{ day, state, detections, transfers }],
 *        latest: [{ transfer_id, state, age_seconds,
 *                   threshold_seconds, detected_at }] }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * The wire shape is snake_case (like the analytics event payloads), so the
 * DTO interfaces below mirror the wire exactly and normalization happens
 * here in the render helpers. `detections` counts TransferStuckDetected
 * occurrences -- the health ticker RE-DETECTS a transfer on every pass
 * while it stays stuck -- while `transfers` counts the distinct transfers,
 * so the two never render as if interchangeable. The screen relies on the
 * endpoint's own default limit (20) for `latest`, matching what an
 * operator gets from the API itself.
 *
 * nip-reports also serves /reports/transfer-funnel, /reports/state-dwell
 * and /reports/rebalance-runs; each has its own screen
 * (networkInventoryTransferFunnel/StateDwell/RebalanceRuns.config.tsx).
 * This one keeps the bare `network-inventory-planning` slug (the most
 * operational: transfers stuck in a saga state right now) and surfaces its
 * two sections -- the per-day/per-state history table and the actionable
 * `latest` occurrences -- the way the multi-section configs do.
 *
 * Day-bucketed, so the screen asks for a trailing 30-day window.
 */
export interface StuckDayDto {
  day: string;
  state: string;
  detections: number;
  transfers: number;
}

export interface StuckOccurrenceDto {
  transfer_id: string;
  state: string;
  age_seconds: number;
  threshold_seconds: number;
  detected_at: string;
}

export interface StuckTransfersReportDto {
  from: string;
  to: string;
  days: StuckDayDto[];
  latest: StuckOccurrenceDto[];
}

const WINDOW = trailingDays(30);

function dailyTransfersSeries(days: StuckDayDto[]): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of days) {
    totals.set(row.day, (totals.get(row.day) ?? 0) + row.transfers);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ label: formatInstant(day), value }));
}

function detectionsByState(days: StuckDayDto[]): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of days) {
    totals.set(row.state, (totals.get(row.state) ?? 0) + row.detections);
  }
  return [...totals.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([state, value]) => ({ label: state, value }));
}

function renderBody(data: StuckTransfersReportDto): ReactElement {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Stuck Transfers per Day">
          <LineChart
            title="DISTINCT TRANSFERS"
            data={dailyTransfersSeries(data.days)}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Detections by Saga State">
          <BarChart
            title="DETECTIONS"
            tone="warning"
            data={detectionsByState(data.days)}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Detections by Day / State" padded={false}>
        <DataTable<StuckDayDto>
          columns={[
            { key: "day", header: "Day", render: (d) => formatInstant(d.day) },
            { key: "state", header: "State", render: (d) => d.state },
            {
              key: "detections",
              header: "Detections",
              align: "right",
              render: (d) => formatNumber(d.detections),
            },
            {
              key: "transfers",
              header: "Distinct Transfers",
              align: "right",
              render: (d) => formatNumber(d.transfers),
            },
          ]}
          rows={data.days}
          rowKey={(d) => `${d.state}-${d.day}`}
          emptyState={<div>No stuck-transfer detections in this window.</div>}
        />
      </Card>

      <Card title="Latest Occurrences" padded={false}>
        <DataTable<StuckOccurrenceDto>
          columns={[
            {
              key: "transfer_id",
              header: "Transfer",
              render: (o) => o.transfer_id,
            },
            { key: "state", header: "State", render: (o) => o.state },
            {
              key: "age_seconds",
              header: "Age",
              align: "right",
              render: (o) => formatDuration(o.age_seconds),
            },
            {
              key: "threshold_seconds",
              header: "Threshold",
              align: "right",
              render: (o) => formatDuration(o.threshold_seconds),
            },
            {
              key: "detected_at",
              header: "Detected",
              render: (o) => formatInstant(o.detected_at),
            },
          ]}
          rows={data.latest}
          rowKey={(o) => `${o.transfer_id}-${o.detected_at}`}
          emptyState={<div>No transfers are stuck right now.</div>}
        />
      </Card>
    </>
  );
}

export const networkInventoryStuckTransfersConfig: ContextReportConfig<StuckTransfersReportDto> =
  {
    contextId: "network-inventory-planning",
    title: "Network Inventory: Stuck Transfers",
    subtitle:
      "Inter-warehouse transfers stuck in a saga state -- detections per state per day, and the latest occurrences with their age against the per-state threshold. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.networkInventoryPlanning}/reports/stuck-transfers`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.networkInventoryPlanning}/reports/freshness`,
    renderBody,
  };
