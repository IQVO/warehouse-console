import type { ReactElement } from "react";
import { BarChart, Card, DataTable } from "@warehouse/ui-kit";
import { formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingHours, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * inventory-storage's "Inventory Flow & Accuracy" report.
 *
 * Real endpoint + DTO shape read directly from
 * inventory-storage/internal/adapters/inbound/http/reports_handler.go:
 *
 *   GET /reports/flow-accuracy?from=&to=&sku=&binId=&granularity=hour
 *   -> { rows: [{ sku, binId, hourBucket, receivedQuantity, stowedCount,
 *                 pickedQuantity, reservationsCreated, reservationsExpired,
 *                 reservationsRevoked, cycleCountsCompleted,
 *                 discrepanciesDetected, unlocatedCount }] }
 *   GET /reports/flow-accuracy/freshness -> { lagSeconds }
 *
 * Hour-bucketed, trailing 24h window.
 */
export interface InventoryFlowRowDto {
  sku: string;
  binId: string;
  hourBucket: string;
  receivedQuantity: number;
  stowedCount: number;
  pickedQuantity: number;
  reservationsCreated: number;
  reservationsExpired: number;
  reservationsRevoked: number;
  cycleCountsCompleted: number;
  discrepanciesDetected: number;
  unlocatedCount: number;
}

export interface InventoryFlowReportDto {
  rows: InventoryFlowRowDto[];
}

const WINDOW = trailingHours(24);

function renderBody(data: InventoryFlowReportDto): ReactElement {
  const rows = data.rows;
  const received = rows.reduce((acc, r) => acc + r.receivedQuantity, 0);
  const stowed = rows.reduce((acc, r) => acc + r.stowedCount, 0);
  const picked = rows.reduce((acc, r) => acc + r.pickedQuantity, 0);
  const discrepancies = rows.reduce((acc, r) => acc + r.discrepanciesDetected, 0);
  const unlocated = rows.reduce((acc, r) => acc + r.unlocatedCount, 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Received / Stowed / Picked">
          <BarChart
            title="FLOW"
            data={[
              { label: "Received", value: received },
              { label: "Stowed", value: stowed },
              { label: "Picked", value: picked },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Accuracy Signals">
          <BarChart
            title="ACCURACY"
            tone="warning"
            data={[
              { label: "Discrepancies", value: discrepancies },
              { label: "Unlocated", value: unlocated },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Flow & Accuracy by SKU / Bin / Hour" padded={false}>
        <DataTable<InventoryFlowRowDto>
          columns={[
            { key: "hourBucket", header: "Hour", render: (r) => formatInstant(r.hourBucket) },
            { key: "sku", header: "SKU", render: (r) => r.sku || "—" },
            { key: "binId", header: "Bin", render: (r) => r.binId || "—" },
            {
              key: "receivedQuantity",
              header: "Received",
              align: "right",
              render: (r) => formatNumber(r.receivedQuantity),
            },
            {
              key: "stowedCount",
              header: "Stowed",
              align: "right",
              render: (r) => formatNumber(r.stowedCount),
            },
            {
              key: "pickedQuantity",
              header: "Picked",
              align: "right",
              render: (r) => formatNumber(r.pickedQuantity),
            },
            {
              key: "discrepanciesDetected",
              header: "Discrepancies",
              align: "right",
              render: (r) => formatNumber(r.discrepanciesDetected),
            },
            {
              key: "unlocatedCount",
              header: "Unlocated",
              align: "right",
              render: (r) => formatNumber(r.unlocatedCount),
            },
          ]}
          rows={rows}
          rowKey={(r) => `${r.sku}-${r.binId}-${r.hourBucket}`}
          emptyState={<div>No inventory flow in this window.</div>}
        />
      </Card>
    </>
  );
}

export const inventoryFlowAccuracyConfig: ContextReportConfig<InventoryFlowReportDto> = {
  contextId: "inventory-storage",
  title: "Inventory: Flow & Accuracy",
  subtitle:
    "Received/stowed/picked quantities, reservation lifecycle, cycle counts and discrepancies by SKU and bin. Trailing 24 hours.",
  reportUrl: withWindow(`${REPORTS_BASE_URL.inventoryStorage}/reports/flow-accuracy`, WINDOW),
  freshnessUrl: `${REPORTS_BASE_URL.inventoryStorage}/reports/flow-accuracy/freshness`,
  renderBody,
};
