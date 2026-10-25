import type { ReactElement } from "react";
import { BarChart, Card, DataTable } from "@warehouse/ui-kit";
import { formatNumber, formatPercent } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * warehouse-planning's "Bottleneck Frequency" report.
 *
 * Real endpoint + DTO shape read from warehouse-planning/apis/openapi.yaml
 * (BottleneckFrequencyReport / BottleneckFrequencyRow, served by the
 * planning-reports binary):
 *
 *   GET /reports/bottleneck-frequency?from=&to=
 *   -> { from, to, rows: [{ warehouse_id, location, bottleneck_step,
 *                           binding_constraint, plans, share }] }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * For the plans PUBLISHED in [from, to): per site, how many had each
 * bottleneck step bound by each constraint type, and `share` = that count as a
 * fraction of the site's published plans. `binding_constraint` is empty for a
 * plan created before the constraint was recorded -- rendered as "unknown",
 * never guessed. The wire is snake_case, so the DTOs mirror it and
 * normalization lives in the render helpers. Not time-bucketed: one trailing
 * 30-day window (the endpoint's own default) is asked for explicitly.
 *
 * Sibling of the Shortage Trend screen (warehousePlanning.config.tsx); both
 * read the same context-level /reports/freshness.
 */
export interface BottleneckFrequencyRowDto {
  warehouse_id: string;
  location: string;
  bottleneck_step: string;
  binding_constraint: string;
  plans: number;
  share: number;
}

export interface BottleneckFrequencyReportDto {
  from: string;
  to: string;
  rows: BottleneckFrequencyRowDto[];
}

const WINDOW = trailingDays(30);

function siteLabel(row: { warehouse_id: string; location: string }): string {
  return row.warehouse_id || row.location
    ? `${row.warehouse_id}/${row.location}`
    : "—";
}

function plansByStep(
  rows: BottleneckFrequencyRowDto[],
): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.bottleneck_step, (totals.get(row.bottleneck_step) ?? 0) + row.plans);
  }
  return [...totals.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({ label, value }));
}

function plansByConstraint(
  rows: BottleneckFrequencyRowDto[],
): { label: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row.binding_constraint || "unknown";
    totals.set(key, (totals.get(key) ?? 0) + row.plans);
  }
  return [...totals.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({ label, value }));
}

function renderBody(data: BottleneckFrequencyReportDto): ReactElement {
  const rows = data.rows;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Plans by Bottleneck Step">
          <BarChart
            title="PLANS BOUND"
            tone="warning"
            data={plansByStep(rows)}
            emptyState={<div>No published plans in this window.</div>}
          />
        </Card>
        <Card title="Plans by Binding Constraint">
          <BarChart
            title="PLANS BOUND"
            data={plansByConstraint(rows)}
            emptyState={<div>No published plans in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Bottleneck Frequency by Site" padded={false}>
        <DataTable<BottleneckFrequencyRowDto>
          columns={[
            { key: "site", header: "Site", render: (r) => siteLabel(r) },
            {
              key: "bottleneck_step",
              header: "Bottleneck Step",
              render: (r) => r.bottleneck_step,
            },
            {
              key: "binding_constraint",
              header: "Binding Constraint",
              render: (r) => r.binding_constraint || "unknown",
            },
            {
              key: "plans",
              header: "Plans",
              align: "right",
              render: (r) => formatNumber(r.plans),
            },
            {
              key: "share",
              header: "Share of Site's Plans",
              align: "right",
              render: (r) => formatPercent(r.share * 100),
            },
          ]}
          rows={rows}
          rowKey={(r) =>
            `${r.warehouse_id}-${r.location}-${r.bottleneck_step}-${r.binding_constraint}`
          }
          emptyState={<div>No published plans in this window.</div>}
        />
      </Card>
    </>
  );
}

export const warehousePlanningBottleneckFrequencyConfig: ContextReportConfig<BottleneckFrequencyReportDto> =
  {
    contextId: "warehouse-planning",
    title: "Capacity Planning: Bottleneck Frequency",
    subtitle:
      "How often each bottleneck step -- and the constraint binding it -- limited a published capacity plan, per site, with its share of the site's published plans. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.warehousePlanning}/reports/bottleneck-frequency`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.warehousePlanning}/reports/freshness`,
    renderBody,
  };
