import type { ReactElement } from "react";
import { BarChart, Card, DataTable, FunnelChart, LineChart } from "@warehouse/ui-kit";
import { formatDuration, formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * inbound-receiving's "Receiving Performance" report.
 *
 * Real endpoint + DTO shape read directly from
 * inbound-receiving/apis/openapi.yaml (ReceivingPerformanceReport) and
 * internal/adapters/inbound/http/reports_handler.go
 * (performanceReportDTO, served by the inbound-reports binary):
 *
 *   GET /reports/receiving-performance?from=&to=
 *   -> { from, to,
 *        days: [{ day, receipts_closed, lines_received, units_good,
 *                  units_damaged,
 *                  discrepancies: { short, over, damaged },
 *                  receipt_cycle: { count, p50_seconds, p95_seconds },
 *                  appointments: { booked, checked_in, cancelled, completed },
 *                  dock_dwell: { count, p50_seconds, p95_seconds } }],
 *        current: { open_receipts, expected_today, expected_today_started } }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * The wire shape is snake_case (like the analytics event payloads), so the
 * DTO interfaces below mirror the wire exactly and normalization happens
 * here in the render helpers. p50_seconds / p95_seconds are null when a
 * timing's count is 0 -- rendered with formatDuration, which already
 * treats null as "no reading", never a fabricated 0s. The report is this
 * context's only one; its two sections -- the per-day performance table
 * and the range-independent `current` snapshot -- are surfaced as
 * separate cards the way the multi-section configs do.
 *
 * Day-bucketed (`day` is a UTC calendar date; from/to default to the
 * trailing 30 days server-side), so the screen asks for a trailing 30-day
 * window.
 */
export interface TimingDto {
  count: number;
  p50_seconds: number | null;
  p95_seconds: number | null;
}

export interface DiscrepanciesDto {
  short: number;
  over: number;
  damaged: number;
}

export interface AppointmentsDto {
  booked: number;
  checked_in: number;
  cancelled: number;
  completed: number;
}

export interface ReceivingPerformanceDayDto {
  day: string;
  receipts_closed: number;
  lines_received: number;
  units_good: number;
  units_damaged: number;
  discrepancies: DiscrepanciesDto;
  receipt_cycle: TimingDto;
  appointments: AppointmentsDto;
  dock_dwell: TimingDto;
}

export interface ReceivingCurrentDto {
  open_receipts: number;
  expected_today: number;
  expected_today_started: number;
}

export interface ReceivingPerformanceReportDto {
  from: string;
  to: string;
  days: ReceivingPerformanceDayDto[];
  current: ReceivingCurrentDto;
}

const WINDOW = trailingDays(30);

function dailyReceiptsSeries(
  days: ReceivingPerformanceDayDto[],
): { label: string; value: number }[] {
  return [...days]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ label: formatInstant(d.day), value: d.receipts_closed }));
}

function renderBody(data: ReceivingPerformanceReportDto): ReactElement {
  const days = data.days;
  const current = data.current;
  const booked = days.reduce((acc, d) => acc + d.appointments.booked, 0);
  const checkedIn = days.reduce((acc, d) => acc + d.appointments.checked_in, 0);
  const completed = days.reduce((acc, d) => acc + d.appointments.completed, 0);
  const short = days.reduce((acc, d) => acc + d.discrepancies.short, 0);
  const over = days.reduce((acc, d) => acc + d.discrepancies.over, 0);
  const damaged = days.reduce((acc, d) => acc + d.discrepancies.damaged, 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Receipts Closed per Day">
          <LineChart
            title="RECEIPTS"
            data={dailyReceiptsSeries(days)}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Appointments (Window Totals)">
          <FunnelChart
            title="DOCK APPOINTMENTS"
            stages={[
              { label: "Booked", value: booked },
              { label: "Checked In", value: checkedIn },
              { label: "Completed", value: completed },
            ]}
            emptyState={<div>No appointments in this window.</div>}
          />
        </Card>
        <Card title="Discrepancies by Kind (Window Totals)">
          <BarChart
            title="DISCREPANCIES"
            tone="warning"
            data={[
              { label: "Short", value: short },
              { label: "Over", value: over },
              { label: "Damaged", value: damaged },
            ]}
            emptyState={<div>No receipts closed in this window.</div>}
          />
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "var(--wh-space-2)",
              margin: "var(--wh-space-3) 0 0",
            }}
          >
            <dt>Open receipts right now</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatNumber(current.open_receipts)}
            </dd>
            <dt>Expected today</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatNumber(current.expected_today)}
            </dd>
            <dt>Expected today, already started</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatNumber(current.expected_today_started)}
            </dd>
          </dl>
        </Card>
      </div>

      <Card title="Performance by Day" padded={false}>
        <DataTable<ReceivingPerformanceDayDto>
          columns={[
            { key: "day", header: "Day", render: (d) => formatInstant(d.day) },
            {
              key: "receipts_closed",
              header: "Receipts Closed",
              align: "right",
              render: (d) => formatNumber(d.receipts_closed),
            },
            {
              key: "lines_received",
              header: "Lines",
              align: "right",
              render: (d) => formatNumber(d.lines_received),
            },
            {
              key: "units_good",
              header: "Units Good",
              align: "right",
              render: (d) => formatNumber(d.units_good),
            },
            {
              key: "units_damaged",
              header: "Units Damaged",
              align: "right",
              render: (d) => formatNumber(d.units_damaged),
            },
            {
              key: "short",
              header: "Short",
              align: "right",
              render: (d) => formatNumber(d.discrepancies.short),
            },
            {
              key: "over",
              header: "Over",
              align: "right",
              render: (d) => formatNumber(d.discrepancies.over),
            },
            {
              key: "damaged",
              header: "Damaged",
              align: "right",
              render: (d) => formatNumber(d.discrepancies.damaged),
            },
            {
              key: "receipt_cycle_p50",
              header: "Cycle p50",
              align: "right",
              render: (d) => formatDuration(d.receipt_cycle.p50_seconds),
            },
            {
              key: "dock_dwell_p50",
              header: "Dwell p50",
              align: "right",
              render: (d) => formatDuration(d.dock_dwell.p50_seconds),
            },
          ]}
          rows={days}
          rowKey={(d) => d.day}
          emptyState={<div>No receiving activity in this window.</div>}
        />
      </Card>
    </>
  );
}

export const inboundReceivingPerformanceConfig: ContextReportConfig<ReceivingPerformanceReportDto> =
  {
    contextId: "inbound-receiving",
    title: "Inbound: Receiving Performance",
    subtitle:
      "Dock throughput and accuracy -- receipts closed, lines and units by condition, discrepancies, appointment milestones, cycle and dwell percentiles per day, plus the dock's state right now. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.inboundReceiving}/reports/receiving-performance`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.inboundReceiving}/reports/freshness`,
    renderBody,
  };
