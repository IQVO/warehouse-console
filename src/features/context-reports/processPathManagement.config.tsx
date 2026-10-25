import type { ReactElement } from "react";
import { BarChart, Card, DataTable } from "@warehouse/ui-kit";
import { formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * process-path-management's "Process Path Catalogue Growth & Change" report.
 *
 * Real endpoint + DTO shape read directly from
 * process-path-management/internal/adapters/inbound/http/reports_handler.go:
 *
 *   GET /reports/catalogue-growth?from=&to=&granularity=day
 *   -> { rows: [{ dayBucket, pathsDefined, pathsRevised, pathsDeactivated }] }
 *   GET /reports/catalogue-growth/freshness -> { lagSeconds }
 *
 * Day-bucketed (granularity defaults to "day"); trailing 30-day window,
 * same reasoning as facility-layout's own catalog-growth report.
 */
export interface ProcessPathCatalogueRowDto {
  dayBucket: string;
  pathsDefined: number;
  pathsRevised: number;
  pathsDeactivated: number;
}

export interface ProcessPathCatalogueReportDto {
  rows: ProcessPathCatalogueRowDto[];
}

const WINDOW = trailingDays(30);

function renderBody(data: ProcessPathCatalogueReportDto): ReactElement {
  const rows = data.rows;
  const defined = rows.reduce((acc, r) => acc + r.pathsDefined, 0);
  const revised = rows.reduce((acc, r) => acc + r.pathsRevised, 0);
  const deactivated = rows.reduce((acc, r) => acc + r.pathsDeactivated, 0);

  return (
    <>
      <Card title="Catalogue Change Volume">
        <BarChart
          title="PATHS"
          data={[
            { label: "Defined", value: defined },
            { label: "Revised", value: revised },
            { label: "Deactivated", value: deactivated },
          ]}
          emptyState={<div>No data in this window.</div>}
        />
      </Card>

      <Card title="Catalogue Growth by Day" padded={false}>
        <DataTable<ProcessPathCatalogueRowDto>
          columns={[
            { key: "dayBucket", header: "Day", render: (r) => formatInstant(r.dayBucket) },
            {
              key: "pathsDefined",
              header: "Defined",
              align: "right",
              render: (r) => formatNumber(r.pathsDefined),
            },
            {
              key: "pathsRevised",
              header: "Revised",
              align: "right",
              render: (r) => formatNumber(r.pathsRevised),
            },
            {
              key: "pathsDeactivated",
              header: "Deactivated",
              align: "right",
              render: (r) => formatNumber(r.pathsDeactivated),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.dayBucket}
          emptyState={<div>No catalogue changes in this window.</div>}
        />
      </Card>
    </>
  );
}

export const processPathCatalogueGrowthConfig: ContextReportConfig<ProcessPathCatalogueReportDto> =
  {
    contextId: "process-path-management",
    title: "Process Paths: Catalogue Growth",
    subtitle:
      "The fleet's declared process-path catalogue -- paths defined, revised and deactivated over time. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.processPathManagement}/reports/catalogue-growth`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.processPathManagement}/reports/catalogue-growth/freshness`,
    renderBody,
  };
