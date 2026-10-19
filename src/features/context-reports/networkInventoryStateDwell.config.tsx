import type { ReactElement } from "react";
import { BarChart, Card, DataTable } from "@warehouse/ui-kit";
import { formatDuration, formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * network-inventory-planning's "State Dwell" report.
 *
 * Real endpoint + DTO shape read from network-inventory-planning/apis/openapi.yaml
 * (StateDwellReport / StateDwellDay, served by the nip-reports binary):
 *
 *   GET /reports/state-dwell?from=&to=
 *   -> { from, to, days: [{ day, state, transitions,
 *                           p50_age_seconds, p95_age_seconds }] }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * Per UTC day and state LEFT (TransferStateAdvanced `from`), the transitions
 * and the p50/p95 of the saga's age since creation AT THE MOMENT it left the
 * state. That is how far along the saga was, NOT a per-state duration (the
 * difference between consecutive states approximates the time spent), so the
 * column headers say "Saga Age at Exit" and the screen never calls it dwell
 * time. Percentiles cannot be summed across days, so only the per-day table
 * carries them; the chart shows transition counts. Wire is snake_case; DTOs
 * mirror it. Day-bucketed: trailing 30 days. Shares the context-level
 * /reports/freshness with the other nip-reports screens.
 */
export interface StateDwellDayDto {
  day: string;
  state: string;
  transitions: number;
  p50_age_seconds: number;
  p95_age_seconds: number;
}

export interface StateDwellReportDto {
  from: string;
  to: string;
  days: StateDwellDayDto[];
}

const WINDOW = trailingDays(30);

function transitionsByState(
  days: StateDwellDayDto[],
): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of days) {
    totals.set(row.state, (totals.get(row.state) ?? 0) + row.transitions);
  }
  return [...totals.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({ label, value }));
}

function renderBody(data: StateDwellReportDto): ReactElement {
  return (
    <>
      <Card title="Transitions Out of Each State (Window Totals)">
        <BarChart
          title="TRANSITIONS"
          data={transitionsByState(data.days)}
          emptyState={<div>No state transitions in this window.</div>}
        />
      </Card>

      <Card title="Saga Age at Exit by Day / State" padded={false}>
        <DataTable<StateDwellDayDto>
          columns={[
            { key: "day", header: "Day", render: (d) => formatInstant(d.day) },
            { key: "state", header: "State Left", render: (d) => d.state },
            {
              key: "transitions",
              header: "Transitions",
              align: "right",
              render: (d) => formatNumber(d.transitions),
            },
            {
              key: "p50_age_seconds",
              header: "Saga Age p50",
              align: "right",
              render: (d) => formatDuration(d.p50_age_seconds),
            },
            {
              key: "p95_age_seconds",
              header: "Saga Age p95",
              align: "right",
              render: (d) => formatDuration(d.p95_age_seconds),
            },
          ]}
          rows={data.days}
          rowKey={(d) => `${d.state}-${d.day}`}
          emptyState={<div>No state transitions in this window.</div>}
        />
        <p
          style={{
            margin: 0,
            padding: "var(--wh-space-3) var(--wh-space-5)",
            color: "var(--wh-color-text-muted)",
            fontSize: "var(--wh-font-size-xs)",
          }}
        >
          Saga age is the time since the transfer was created when it left the
          state, not the time spent in that state.
        </p>
      </Card>
    </>
  );
}

export const networkInventoryStateDwellConfig: ContextReportConfig<StateDwellReportDto> =
  {
    contextId: "network-inventory-planning",
    title: "Network Inventory: State Dwell",
    subtitle:
      "How old the transfer saga was when it left each state -- transitions and p50/p95 saga age per state per day. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.networkInventoryPlanning}/reports/state-dwell`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.networkInventoryPlanning}/reports/freshness`,
    renderBody,
  };
