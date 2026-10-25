import type { ReactElement } from "react";
import { BarChart, Card, DataTable } from "@warehouse/ui-kit";
import { formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * facility-layout's "Layout Catalog Growth & Change" report.
 *
 * Real endpoint + DTO shape read directly from
 * facility-layout/internal/adapters/inbound/http/reports_handler.go:
 *
 *   GET /reports/catalog-growth?from=&to=&scope=&granularity=day
 *   -> { rows: [{ scope, dayBucket, sitesRegistered, zonesRegistered,
 *                 aislesRegistered, locationTypesRegistered,
 *                 placementRulesDefined, slotsRegistered,
 *                 slotsDecommissioned, bulkImports, importRowsSubmitted,
 *                 importRowsImported, importRowsRejected }] }
 *   GET /reports/catalog-growth/freshness -> { lagSeconds }
 *
 * Day-bucketed (granularity defaults to "day"), so this screen defaults to
 * a trailing 30-day window -- a 24h window would show at most one bucket.
 */
export interface FacilityCatalogRowDto {
  scope: string;
  dayBucket: string;
  sitesRegistered: number;
  zonesRegistered: number;
  aislesRegistered: number;
  locationTypesRegistered: number;
  placementRulesDefined: number;
  slotsRegistered: number;
  slotsDecommissioned: number;
  bulkImports: number;
  importRowsSubmitted: number;
  importRowsImported: number;
  importRowsRejected: number;
}

export interface FacilityCatalogReportDto {
  rows: FacilityCatalogRowDto[];
}

const WINDOW = trailingDays(30);

function renderBody(data: FacilityCatalogReportDto): ReactElement {
  const rows = data.rows;
  const totalSlots = rows.reduce((acc, r) => acc + r.slotsRegistered, 0);
  const totalDecommissioned = rows.reduce((acc, r) => acc + r.slotsDecommissioned, 0);
  const totalImportsRejected = rows.reduce((acc, r) => acc + r.importRowsRejected, 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Slots Registered vs Decommissioned">
          <BarChart
            title="SLOTS"
            data={[
              { label: "Registered", value: totalSlots },
              { label: "Decommissioned", value: totalDecommissioned },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Bulk Import Health">
          <BarChart
            title="IMPORT ROWS"
            data={[
              {
                label: "Submitted",
                value: rows.reduce((acc, r) => acc + r.importRowsSubmitted, 0),
              },
              {
                label: "Imported",
                value: rows.reduce((acc, r) => acc + r.importRowsImported, 0),
              },
              { label: "Rejected", value: totalImportsRejected },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Catalog Growth by Day" padded={false}>
        <DataTable<FacilityCatalogRowDto>
          columns={[
            { key: "dayBucket", header: "Day", render: (r) => formatInstant(r.dayBucket) },
            { key: "scope", header: "Scope", render: (r) => r.scope || "—" },
            {
              key: "sitesRegistered",
              header: "Sites",
              align: "right",
              render: (r) => formatNumber(r.sitesRegistered),
            },
            {
              key: "zonesRegistered",
              header: "Zones",
              align: "right",
              render: (r) => formatNumber(r.zonesRegistered),
            },
            {
              key: "aislesRegistered",
              header: "Aisles",
              align: "right",
              render: (r) => formatNumber(r.aislesRegistered),
            },
            {
              key: "slotsRegistered",
              header: "Slots +",
              align: "right",
              render: (r) => formatNumber(r.slotsRegistered),
            },
            {
              key: "slotsDecommissioned",
              header: "Slots −",
              align: "right",
              render: (r) => formatNumber(r.slotsDecommissioned),
            },
            {
              key: "placementRulesDefined",
              header: "Rules Defined",
              align: "right",
              render: (r) => formatNumber(r.placementRulesDefined),
            },
          ]}
          rows={rows}
          rowKey={(r) => `${r.scope}-${r.dayBucket}`}
          emptyState={<div>No catalog activity in this window.</div>}
        />
      </Card>
    </>
  );
}

export const facilityCatalogGrowthConfig: ContextReportConfig<FacilityCatalogReportDto> = {
  contextId: "facility-layout",
  title: "Facility: Catalog Growth",
  subtitle:
    "Sites, zones, aisles, location types, placement rules and coded slots registered over time, plus bulk-import health. Trailing 30 days.",
  reportUrl: withWindow(`${REPORTS_BASE_URL.facilityLayout}/reports/catalog-growth`, WINDOW),
  freshnessUrl: `${REPORTS_BASE_URL.facilityLayout}/reports/catalog-growth/freshness`,
  renderBody,
};
