import type { ReactElement } from "react";
import { Card, DataTable, FunnelChart, LineChart } from "@warehouse/ui-kit";
import { formatDuration, formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * slotting-optimization's "Slot Plan Funnel" report.
 *
 * Real endpoint + DTO shape read directly from
 * slotting-optimization/apis/openapi.yaml (SlotPlanFunnelReport, served by
 * the slotting-reports binary, ADR 0006):
 *
 *   GET /reports/slot-plan-funnel?from=&to=&siteId=&granularity=day
 *   -> { from, to, site_id?, granularity,
 *        days: [{ day, plans_generated, plans_approved, plans_rejected,
 *                 approval_latency: { count, p50_seconds, p95_seconds },
 *                 supersessions }] }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * The wire shape is snake_case (like the analytics event payloads), so the
 * DTO interfaces mirror the wire exactly and normalization lives here.
 * p50_seconds / p95_seconds are null when approval_latency.count is 0 --
 * rendered with formatDuration, which treats null as "no reading", never a
 * fabricated 0s. Day-bucketed with zeros included, so a trailing 30-day
 * window is the natural ask.
 */
export interface ApprovalLatencyTimingDto {
  count: number;
  p50_seconds: number | null;
  p95_seconds: number | null;
}

export interface SlotPlanFunnelDayDto {
  day: string;
  plans_generated: number;
  plans_approved: number;
  plans_rejected: number;
  approval_latency: ApprovalLatencyTimingDto;
  supersessions: number;
}

export interface SlotPlanFunnelReportDto {
  from: string;
  to: string;
  site_id?: string;
  granularity: string;
  days: SlotPlanFunnelDayDto[];
}

const WINDOW = trailingDays(30);

function generatedSeries(
  days: SlotPlanFunnelDayDto[],
): { label: string; value: number }[] {
  return [...days]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ label: formatInstant(d.day), value: d.plans_generated }));
}

function renderBody(data: SlotPlanFunnelReportDto): ReactElement {
  const days = data.days;
  const generated = days.reduce((acc, d) => acc + d.plans_generated, 0);
  const approved = days.reduce((acc, d) => acc + d.plans_approved, 0);
  const rejected = days.reduce((acc, d) => acc + d.plans_rejected, 0);
  const superseded = days.reduce((acc, d) => acc + d.supersessions, 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Plans Generated per Day">
          <LineChart
            title="GENERATED"
            data={generatedSeries(days)}
            emptyState={<div>No slot plans generated in this window.</div>}
          />
        </Card>
        <Card title="Review Funnel (Window Totals)">
          <FunnelChart
            title="SLOT PLANS"
            stages={[
              { label: "Generated", value: generated },
              { label: "Approved", value: approved },
              { label: "Rejected", value: rejected },
            ]}
            emptyState={<div>No slot-plan activity in this window.</div>}
          />
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "var(--wh-space-2)",
              margin: "var(--wh-space-3) 0 0",
            }}
          >
            <dt>Approvals superseding a prior plan</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatNumber(superseded)}
            </dd>
          </dl>
        </Card>
      </div>

      <Card title="Funnel by Day" padded={false}>
        <DataTable<SlotPlanFunnelDayDto>
          columns={[
            { key: "day", header: "Day", render: (d) => formatInstant(d.day) },
            {
              key: "plans_generated",
              header: "Generated",
              align: "right",
              render: (d) => formatNumber(d.plans_generated),
            },
            {
              key: "plans_approved",
              header: "Approved",
              align: "right",
              render: (d) => formatNumber(d.plans_approved),
            },
            {
              key: "plans_rejected",
              header: "Rejected",
              align: "right",
              render: (d) => formatNumber(d.plans_rejected),
            },
            {
              key: "supersessions",
              header: "Superseded",
              align: "right",
              render: (d) => formatNumber(d.supersessions),
            },
            {
              key: "approval_latency_p50",
              header: "Approval p50",
              align: "right",
              render: (d) => formatDuration(d.approval_latency.p50_seconds),
            },
            {
              key: "approval_latency_p95",
              header: "Approval p95",
              align: "right",
              render: (d) => formatDuration(d.approval_latency.p95_seconds),
            },
          ]}
          rows={days}
          rowKey={(d) => d.day}
          emptyState={<div>No slot-plan activity in this window.</div>}
        />
      </Card>
    </>
  );
}

export const slottingPlanFunnelConfig: ContextReportConfig<SlotPlanFunnelReportDto> =
  {
    contextId: "slotting-optimization",
    title: "Slotting: Slot Plan Funnel",
    subtitle:
      "The slot-plan review funnel per day -- plans generated, approved, rejected, approvals superseding a prior plan, and generated-to-approved latency percentiles. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.slottingOptimization}/reports/slot-plan-funnel`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.slottingOptimization}/reports/freshness`,
    renderBody,
  };
