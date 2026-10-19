import type { ReactElement } from "react";
import { BarChart, Card, DataTable, LineChart } from "@warehouse/ui-kit";
import { formatNumber, formatPercent } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { formatReportDay, trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * network-inventory-planning's "Rebalance Runs" report.
 *
 * Real endpoint + DTO shape read from network-inventory-planning/apis/openapi.yaml
 * (RebalanceRunsReport / RebalanceRunsDay, served by the nip-reports binary):
 *
 *   GET /reports/rebalance-runs?from=&to=
 *   -> { from, to, days: [{ day, runs, proposals, rejected,
 *                           rejection_rate, stale_facts }] }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * Scheduled rebalance runs (RebalanceRunCompleted) per UTC day. `rejected` is
 * the proposals the runs' OWN safety checks refused, never an operator
 * rejection (a run approves nothing). `rejection_rate` is 0 on the wire when a
 * day produced no proposals; a rate over zero proposals is no reading, so it
 * renders "—" rather than a calm 0%. Wire is snake_case; DTOs mirror it.
 * Day-bucketed: trailing 30 days. Shares the context-level /reports/freshness
 * with the other nip-reports screens.
 */
export interface RebalanceRunsDayDto {
  day: string;
  runs: number;
  proposals: number;
  rejected: number;
  rejection_rate: number;
  stale_facts: number;
}

export interface RebalanceRunsReportDto {
  from: string;
  to: string;
  days: RebalanceRunsDayDto[];
}

const WINDOW = trailingDays(30);

function proposalsSeries(
  days: RebalanceRunsDayDto[],
): { label: string; value: number }[] {
  return [...days]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ label: formatReportDay(d.day), value: d.proposals }));
}

function rejectionRate(d: RebalanceRunsDayDto): string {
  return d.proposals > 0 ? formatPercent(d.rejection_rate * 100) : "—";
}

function renderBody(data: RebalanceRunsReportDto): ReactElement {
  const days = data.days;
  const proposals = days.reduce((acc, d) => acc + d.proposals, 0);
  const rejected = days.reduce((acc, d) => acc + d.rejected, 0);
  const stale = days.reduce((acc, d) => acc + d.stale_facts, 0);
  const runs = days.reduce((acc, d) => acc + d.runs, 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Proposals per Day">
          <LineChart
            title="PROPOSALS"
            data={proposalsSeries(days)}
            emptyState={<div>No rebalance runs in this window.</div>}
          />
        </Card>
        <Card title="Proposals vs Rejected by Safety Checks (Window Totals)">
          <BarChart
            title="PROPOSALS"
            tone="warning"
            data={[
              { label: "Proposed", value: proposals },
              { label: "Rejected", value: rejected },
            ]}
            emptyState={<div>No rebalance runs in this window.</div>}
          />
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "var(--wh-space-2)",
              margin: "var(--wh-space-3) 0 0",
            }}
          >
            <dt>Runs completed</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>{formatNumber(runs)}</dd>
            <dt>Stale facts seen</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>{formatNumber(stale)}</dd>
          </dl>
        </Card>
      </div>

      <Card title="Rebalance Runs by Day" padded={false}>
        <DataTable<RebalanceRunsDayDto>
          columns={[
            { key: "day", header: "Day", render: (d) => formatReportDay(d.day) },
            {
              key: "runs",
              header: "Runs",
              align: "right",
              render: (d) => formatNumber(d.runs),
            },
            {
              key: "proposals",
              header: "Proposals",
              align: "right",
              render: (d) => formatNumber(d.proposals),
            },
            {
              key: "rejected",
              header: "Rejected by Safety Checks",
              align: "right",
              render: (d) => formatNumber(d.rejected),
            },
            {
              key: "rejection_rate",
              header: "Rejection Rate",
              align: "right",
              render: (d) => rejectionRate(d),
            },
            {
              key: "stale_facts",
              header: "Stale Facts",
              align: "right",
              render: (d) => formatNumber(d.stale_facts),
            },
          ]}
          rows={days}
          rowKey={(d) => d.day}
          emptyState={<div>No rebalance runs in this window.</div>}
        />
      </Card>
    </>
  );
}

export const networkInventoryRebalanceRunsConfig: ContextReportConfig<RebalanceRunsReportDto> =
  {
    contextId: "network-inventory-planning",
    title: "Network Inventory: Rebalance Runs",
    subtitle:
      "Scheduled rebalance runs per day -- proposals the planner produced, how many the runs' own safety checks rejected, and stale facts seen. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.networkInventoryPlanning}/reports/rebalance-runs`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.networkInventoryPlanning}/reports/freshness`,
    renderBody,
  };
