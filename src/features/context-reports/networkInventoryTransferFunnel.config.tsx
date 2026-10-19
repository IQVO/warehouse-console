import type { ReactElement } from "react";
import { BarChart, Card, DataTable } from "@warehouse/ui-kit";
import { formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { formatReportDay, trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * network-inventory-planning's "Transfer Funnel" report.
 *
 * Real endpoint + DTO shape read from network-inventory-planning/apis/openapi.yaml
 * (TransferFunnelReport / TransferFunnelDay, served by the nip-reports binary):
 *
 *   GET /reports/transfer-funnel?from=&to=
 *   -> { from, to, days: [{ day, state, transfers }] }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * Per UTC day and saga state reached (TransferStateAdvanced `to`), the
 * DISTINCT transfers that reached it. The endpoint does not rank the states,
 * so this screen does not draw a funnel: it shows the transfers that reached
 * each state (largest first) and the per-day breakdown, and leaves the
 * drop-off reading to the operator. Wire is snake_case; DTOs mirror it.
 * Day-bucketed: trailing 30 days. Shares the context-level /reports/freshness
 * with the stuck-transfers, state-dwell and rebalance-runs screens.
 */
export interface TransferFunnelDayDto {
  day: string;
  state: string;
  transfers: number;
}

export interface TransferFunnelReportDto {
  from: string;
  to: string;
  days: TransferFunnelDayDto[];
}

const WINDOW = trailingDays(30);

function transfersByState(
  days: TransferFunnelDayDto[],
): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of days) {
    totals.set(row.state, (totals.get(row.state) ?? 0) + row.transfers);
  }
  return [...totals.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({ label, value }));
}

function renderBody(data: TransferFunnelReportDto): ReactElement {
  return (
    <>
      <Card title="Transfers Reaching Each State (Window Totals)">
        <BarChart
          title="DISTINCT TRANSFERS"
          data={transfersByState(data.days)}
          emptyState={<div>No transfer transitions in this window.</div>}
        />
      </Card>

      <Card title="Transfers by Day / State" padded={false}>
        <DataTable<TransferFunnelDayDto>
          columns={[
            { key: "day", header: "Day", render: (d) => formatReportDay(d.day) },
            { key: "state", header: "State Reached", render: (d) => d.state },
            {
              key: "transfers",
              header: "Distinct Transfers",
              align: "right",
              render: (d) => formatNumber(d.transfers),
            },
          ]}
          rows={data.days}
          rowKey={(d) => `${d.state}-${d.day}`}
          emptyState={<div>No transfer transitions in this window.</div>}
        />
      </Card>
    </>
  );
}

export const networkInventoryTransferFunnelConfig: ContextReportConfig<TransferFunnelReportDto> =
  {
    contextId: "network-inventory-planning",
    title: "Network Inventory: Transfer Funnel",
    subtitle:
      "How many distinct inter-warehouse transfers reached each saga state, per day. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.networkInventoryPlanning}/reports/transfer-funnel`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.networkInventoryPlanning}/reports/freshness`,
    renderBody,
  };
