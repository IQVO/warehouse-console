import type { ReactElement } from "react";
import { BarChart, Card, DataTable } from "@warehouse/ui-kit";
import { formatDuration, formatInstant, formatNumber, formatPercent } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingHours, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * labor-performance's engineered-standards / scorecard report.
 *
 * Real endpoint + DTO shape read directly from
 * labor-performance/internal/adapters/inbound/http/reports_handler.go:
 *
 *   GET /reports/performance?from=&to=&taskType=&granularity=hour
 *   -> {
 *        from, to,
 *        rows: [{ taskType, hourBucket, tasksRecorded, tasksScored,
 *                 tasksUnscored, meanEfficiencyPct, meanActualSeconds,
 *                 standardsDefined, standardsRevised }],
 *        byTaskType: [ same per-field shape as rows, aggregated by taskType ],
 *        totals: { tasksRecorded, tasksScored, tasksUnscored,
 *                  meanEfficiencyPct, meanActualSeconds }
 *      }
 *   GET /reports/performance/freshness -> { lagSeconds }
 *
 * meanEfficiencyPct/meanActualSeconds are POINTERS on the wire (JSON null,
 * not 0, for a bucket with no scored tasks) -- rendered with formatPercent/
 * formatDuration, which already treat null as "no reading", never a
 * fabricated 0%.
 */
export interface LaborTaskTypeRowDto {
  taskType: string;
  tasksRecorded: number;
  tasksScored: number;
  tasksUnscored: number;
  meanEfficiencyPct: number | null;
  meanActualSeconds: number | null;
  standardsDefined: number;
  standardsRevised: number;
}

export interface LaborHourRowDto extends LaborTaskTypeRowDto {
  hourBucket: string;
}

export interface LaborTotalsDto {
  tasksRecorded: number;
  tasksScored: number;
  tasksUnscored: number;
  meanEfficiencyPct: number | null;
  meanActualSeconds: number | null;
}

export interface LaborPerformanceReportDto {
  from: string;
  to: string;
  rows: LaborHourRowDto[];
  byTaskType: LaborTaskTypeRowDto[];
  totals: LaborTotalsDto;
}

const WINDOW = trailingHours(24);

function renderBody(data: LaborPerformanceReportDto): ReactElement {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Fleet Totals">
          <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--wh-space-2)", margin: 0 }}>
            <dt>Tasks recorded</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatNumber(data.totals.tasksRecorded)}
            </dd>
            <dt>Tasks scored</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatNumber(data.totals.tasksScored)}
            </dd>
            <dt>Tasks unscored</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatNumber(data.totals.tasksUnscored)}
            </dd>
            <dt>Mean efficiency</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatPercent(data.totals.meanEfficiencyPct)}
            </dd>
            <dt>Mean actual time</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatDuration(data.totals.meanActualSeconds)}
            </dd>
          </dl>
        </Card>
        <Card title="Tasks Scored by Task Type">
          <BarChart
            title="TASK TYPE"
            data={data.byTaskType.map((b) => ({ label: b.taskType, value: b.tasksScored }))}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Performance by Task Type / Hour" padded={false}>
        <DataTable<LaborHourRowDto>
          columns={[
            { key: "hourBucket", header: "Hour", render: (r) => formatInstant(r.hourBucket) },
            { key: "taskType", header: "Task Type", render: (r) => r.taskType },
            {
              key: "tasksRecorded",
              header: "Recorded",
              align: "right",
              render: (r) => formatNumber(r.tasksRecorded),
            },
            {
              key: "tasksScored",
              header: "Scored",
              align: "right",
              render: (r) => formatNumber(r.tasksScored),
            },
            {
              key: "meanEfficiencyPct",
              header: "Mean Eff.",
              align: "right",
              render: (r) => formatPercent(r.meanEfficiencyPct),
            },
            {
              key: "meanActualSeconds",
              header: "Mean Actual",
              align: "right",
              render: (r) => formatDuration(r.meanActualSeconds),
            },
            {
              key: "standardsDefined",
              header: "Standards Defined",
              align: "right",
              render: (r) => formatNumber(r.standardsDefined),
            },
          ]}
          rows={data.rows}
          rowKey={(r) => `${r.taskType}-${r.hourBucket}`}
          emptyState={<div>No scored tasks in this window.</div>}
        />
      </Card>
    </>
  );
}

export const laborPerformanceConfig: ContextReportConfig<LaborPerformanceReportDto> = {
  contextId: "labor-performance",
  title: "Labor: Performance",
  subtitle:
    "Engineered labor standards and scorecards -- tasks recorded/scored, mean efficiency and actual time by task type. Trailing 24 hours.",
  reportUrl: withWindow(`${REPORTS_BASE_URL.laborPerformance}/reports/performance`, WINDOW),
  freshnessUrl: `${REPORTS_BASE_URL.laborPerformance}/reports/performance/freshness`,
  renderBody,
};
