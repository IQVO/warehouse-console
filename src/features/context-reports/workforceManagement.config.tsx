import type { ReactElement } from "react";
import { BarChart, Card, DataTable } from "@warehouse/ui-kit";
import { formatDuration, formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingHours, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * workforce-management's "Labor Utilization & Staffing" report.
 *
 * Real endpoint + DTO shape read directly from
 * workforce-management/internal/adapters/inbound/http/reports_handler.go:
 *
 *   GET /reports/labor?from=&to=&pathId=&granularity=hour
 *   -> { rows: [{ pathId, hourBucket, shiftsStarted, shiftsEnded, breaks,
 *                 avgBreakSeconds, certifications, laborAssigned,
 *                 laborReassigned, understaffingEvents }] }
 *   GET /reports/labor/freshness -> { lagSeconds }
 *
 * An empty pathId row is the building-wide, associate-scoped bucket
 * (shifts, breaks, certifications) rather than a path-specific one.
 */
export interface WorkforceLaborRowDto {
  pathId: string;
  hourBucket: string;
  shiftsStarted: number;
  shiftsEnded: number;
  breaks: number;
  avgBreakSeconds: number;
  certifications: number;
  laborAssigned: number;
  laborReassigned: number;
  understaffingEvents: number;
}

export interface WorkforceLaborReportDto {
  rows: WorkforceLaborRowDto[];
}

const WINDOW = trailingHours(24);

function renderBody(data: WorkforceLaborReportDto): ReactElement {
  const rows = data.rows;
  const understaffing = rows.reduce((acc, r) => acc + r.understaffingEvents, 0);
  const reassigned = rows.reduce((acc, r) => acc + r.laborReassigned, 0);
  const assigned = rows.reduce((acc, r) => acc + r.laborAssigned, 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Staffing Gap by Path">
          <BarChart
            title="STAFFING"
            data={[
              { label: "Assigned", value: assigned },
              { label: "Reassigned", value: reassigned },
              { label: "Understaffing Events", value: understaffing },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Shifts & Breaks">
          <BarChart
            title="SHIFTS"
            data={[
              { label: "Started", value: rows.reduce((a, r) => a + r.shiftsStarted, 0) },
              { label: "Ended", value: rows.reduce((a, r) => a + r.shiftsEnded, 0) },
              { label: "Breaks", value: rows.reduce((a, r) => a + r.breaks, 0) },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Labor by Path / Hour" padded={false}>
        <DataTable<WorkforceLaborRowDto>
          columns={[
            { key: "hourBucket", header: "Hour", render: (r) => formatInstant(r.hourBucket) },
            {
              key: "pathId",
              header: "Path",
              render: (r) => r.pathId || "(building-wide)",
            },
            {
              key: "laborAssigned",
              header: "Assigned",
              align: "right",
              render: (r) => formatNumber(r.laborAssigned),
            },
            {
              key: "laborReassigned",
              header: "Reassigned",
              align: "right",
              render: (r) => formatNumber(r.laborReassigned),
            },
            {
              key: "understaffingEvents",
              header: "Understaffing",
              align: "right",
              render: (r) => formatNumber(r.understaffingEvents),
            },
            {
              key: "avgBreakSeconds",
              header: "Avg Break",
              align: "right",
              render: (r) => formatDuration(r.avgBreakSeconds),
            },
            {
              key: "certifications",
              header: "Certifications",
              align: "right",
              render: (r) => formatNumber(r.certifications),
            },
          ]}
          rows={rows}
          rowKey={(r) => `${r.pathId}-${r.hourBucket}`}
          emptyState={<div>No labor activity in this window.</div>}
        />
      </Card>
    </>
  );
}

export const workforceLaborConfig: ContextReportConfig<WorkforceLaborReportDto> = {
  contextId: "workforce-management",
  title: "Workforce: Labor Utilization & Staffing",
  subtitle:
    "Shifts, breaks, certifications and staffing gap (planned vs active headcount) by path. Trailing 24 hours.",
  reportUrl: withWindow(`${REPORTS_BASE_URL.workforceManagement}/reports/labor`, WINDOW),
  freshnessUrl: `${REPORTS_BASE_URL.workforceManagement}/reports/labor/freshness`,
  renderBody,
};
