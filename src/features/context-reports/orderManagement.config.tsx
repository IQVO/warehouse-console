import type { ReactElement } from "react";
import { Card, DataTable, FunnelChart } from "@warehouse/ui-kit";
import { formatDuration, formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingHours, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * order-management's "Order Funnel & Allocation Health" report.
 *
 * Real endpoint + DTO shape read directly from
 * order-management/internal/adapters/inbound/http/reports_handler.go:
 *
 *   GET /reports/funnel?from=&to=&pathId=&granularity=hour
 *   -> { rows: [{ pathId, hourBucket, ordersReceived, ordersAllocated,
 *                 ordersPartiallyAllocated, ordersAllocationFailed,
 *                 ordersReleased, ordersCancelled, linesAllocated,
 *                 linesBackordered, linesReleased, promiseBasisCapability,
 *                 promiseBasisLeadTime, ordersRepromised,
 *                 ordersSplitShipment, promiseToCutoffGapSeconds }] }
 *   GET /reports/funnel/freshness -> { lagSeconds }
 *
 * ordersRepromised is NOT pathId-dimensioned upstream (only non-zero on
 * the row whose pathId is ""), so it is summed across all rows rather
 * than shown per path.
 */
export interface OrderFunnelRowDto {
  pathId: string;
  hourBucket: string;
  ordersReceived: number;
  ordersAllocated: number;
  ordersPartiallyAllocated: number;
  ordersAllocationFailed: number;
  ordersReleased: number;
  ordersCancelled: number;
  linesAllocated: number;
  linesBackordered: number;
  linesReleased: number;
  promiseBasisCapability: number;
  promiseBasisLeadTime: number;
  ordersRepromised: number;
  ordersSplitShipment: number;
  promiseToCutoffGapSeconds: number;
}

export interface OrderFunnelReportDto {
  rows: OrderFunnelRowDto[];
}

const WINDOW = trailingHours(24);

function renderBody(data: OrderFunnelReportDto): ReactElement {
  const rows = data.rows;
  const received = rows.reduce((acc, r) => acc + r.ordersReceived, 0);
  const allocated = rows.reduce((acc, r) => acc + r.ordersAllocated, 0);
  const released = rows.reduce((acc, r) => acc + r.ordersReleased, 0);
  const cancelled = rows.reduce((acc, r) => acc + r.ordersCancelled, 0);
  const avgGap =
    rows.length > 0
      ? rows.reduce((acc, r) => acc + r.promiseToCutoffGapSeconds, 0) / rows.length
      : null;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Order Funnel">
          <FunnelChart
            title="ORDER FUNNEL"
            stages={[
              { label: "Received", value: received },
              { label: "Allocated", value: allocated },
              { label: "Released", value: released },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Promise Health">
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "var(--wh-space-2)",
              margin: 0,
            }}
          >
            <dt>Cancelled</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>{formatNumber(cancelled)}</dd>
            <dt>Avg promise→cutoff gap</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>{formatDuration(avgGap)}</dd>
          </dl>
        </Card>
      </div>

      <Card title="Funnel by Path / Hour" padded={false}>
        <DataTable<OrderFunnelRowDto>
          columns={[
            { key: "hourBucket", header: "Hour", render: (r) => formatInstant(r.hourBucket) },
            { key: "pathId", header: "Path", render: (r) => r.pathId || "—" },
            {
              key: "ordersReceived",
              header: "Received",
              align: "right",
              render: (r) => formatNumber(r.ordersReceived),
            },
            {
              key: "ordersAllocated",
              header: "Allocated",
              align: "right",
              render: (r) => formatNumber(r.ordersAllocated),
            },
            {
              key: "ordersAllocationFailed",
              header: "Alloc Failed",
              align: "right",
              render: (r) => formatNumber(r.ordersAllocationFailed),
            },
            {
              key: "ordersReleased",
              header: "Released",
              align: "right",
              render: (r) => formatNumber(r.ordersReleased),
            },
            {
              key: "ordersSplitShipment",
              header: "Split Shipment",
              align: "right",
              render: (r) => formatNumber(r.ordersSplitShipment),
            },
          ]}
          rows={rows}
          rowKey={(r) => `${r.pathId}-${r.hourBucket}`}
          emptyState={<div>No orders in this window.</div>}
        />
      </Card>
    </>
  );
}

export const orderFunnelConfig: ContextReportConfig<OrderFunnelReportDto> = {
  contextId: "order-management",
  title: "Orders: Funnel & Allocation Health",
  subtitle:
    "Order intake, allocation state, promise basis and release/cancel volume by path. Trailing 24 hours.",
  reportUrl: withWindow(`${REPORTS_BASE_URL.orderManagement}/reports/funnel`, WINDOW),
  freshnessUrl: `${REPORTS_BASE_URL.orderManagement}/reports/funnel/freshness`,
  renderBody,
};
