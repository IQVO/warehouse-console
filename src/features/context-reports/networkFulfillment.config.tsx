import type { ReactElement } from "react";
import { BarChart, Card, DataTable, FunnelChart } from "@warehouse/ui-kit";
import { formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingHours, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * network-fulfillment's ACL report -- GUESSED SHAPE, NOT VERIFIED.
 *
 * UNLIKE the other 8 context configs in this directory (each of whose
 * endpoint path and DTO field names were read directly from that
 * context's own `internal/adapters/inbound/http/reports_handler.go`),
 * network-fulfillment has NO reports_handler.go, NO apis/openapi.yaml
 * `/reports/...` path and NO cmd/*-reports binary anywhere in this repo
 * as of this PR (checked: only `/healthz`, `/inbound-status`,
 * `/network-orders`, `/network-orders/{networkRef}` exist today; its
 * `feature/mcp-and-analytics` branch adds an MCP server + analytics data
 * product but still has no reports_handler.go or /reports openapi path in
 * that branch's tree either). Its whole reports endpoint is still design
 * work happening in a PARALLEL, not-yet-merged task.
 *
 * So the endpoint path (`/reports/network-orders`) and every field below
 * are an EDUCATED GUESS, following this fleet's own established
 * reports-handler conventions (hour-bucketed rows array, freshness
 * sibling route) and this repo's own domain events (NetworkOrderReceived/
 * Acknowledged/Rejected/ShipmentConfirmed in internal/domain/shared/events.go,
 * and RejectionReason's three cases: untranslatable SKU, infeasible
 * deadline, missed acknowledgement window) -- NOT read from a real Go
 * struct like the other 8. Flagged explicitly in this PR's description as
 * the one context whose shape could not be verified. THIS FILE MUST BE
 * RECONCILED against the real reports_handler.go the moment
 * network-fulfillment's analytics PR merges -- field names, bucket
 * dimension and even the endpoint path itself may all be wrong.
 */
export interface NetworkFulfillmentRowDto {
  hourBucket: string;
  ordersReceived: number;
  ordersAcknowledged: number;
  ordersRejectedUntranslatableSku: number;
  ordersRejectedInfeasibleDeadline: number;
  ordersRejectedMissedWindow: number;
  shipmentsConfirmed: number;
}

export interface NetworkFulfillmentReportDto {
  rows: NetworkFulfillmentRowDto[];
}

const WINDOW = trailingHours(24);

function renderBody(data: NetworkFulfillmentReportDto): ReactElement {
  const rows = data.rows;
  const received = rows.reduce((acc, r) => acc + r.ordersReceived, 0);
  const acknowledged = rows.reduce((acc, r) => acc + r.ordersAcknowledged, 0);
  const shipped = rows.reduce((acc, r) => acc + r.shipmentsConfirmed, 0);
  const rejectedSku = rows.reduce((acc, r) => acc + r.ordersRejectedUntranslatableSku, 0);
  const rejectedDeadline = rows.reduce(
    (acc, r) => acc + r.ordersRejectedInfeasibleDeadline,
    0,
  );
  const rejectedWindow = rows.reduce((acc, r) => acc + r.ordersRejectedMissedWindow, 0);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Network Order Funnel">
          <FunnelChart
            title="NETWORK ORDERS"
            stages={[
              { label: "Received", value: received },
              { label: "Acknowledged", value: acknowledged },
              { label: "Shipped", value: shipped },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Rejection Reasons">
          <BarChart
            title="REJECTIONS"
            tone="warning"
            data={[
              { label: "Untranslatable SKU", value: rejectedSku },
              { label: "Infeasible Deadline", value: rejectedDeadline },
              { label: "Missed Ack Window", value: rejectedWindow },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Network Orders by Hour" padded={false}>
        <DataTable<NetworkFulfillmentRowDto>
          columns={[
            { key: "hourBucket", header: "Hour", render: (r) => formatInstant(r.hourBucket) },
            {
              key: "ordersReceived",
              header: "Received",
              align: "right",
              render: (r) => formatNumber(r.ordersReceived),
            },
            {
              key: "ordersAcknowledged",
              header: "Acknowledged",
              align: "right",
              render: (r) => formatNumber(r.ordersAcknowledged),
            },
            {
              key: "shipmentsConfirmed",
              header: "Shipped",
              align: "right",
              render: (r) => formatNumber(r.shipmentsConfirmed),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.hourBucket}
          emptyState={<div>No network-order activity in this window.</div>}
        />
      </Card>
    </>
  );
}

/**
 * GUESSED endpoint path + DTO -- see this file's header comment. Wired
 * ahead of network-fulfillment's still-open analytics PR so this screen
 * activates the moment it merges IF the merged shape matches; otherwise
 * this whole file needs updating alongside it.
 */
export const networkFulfillmentReportConfig: ContextReportConfig<NetworkFulfillmentReportDto> =
  {
    contextId: "network-fulfillment",
    title: "Network Fulfillment: Order Flow",
    subtitle:
      "ACL to the external retail network -- orders received/acknowledged/shipped and rejection reasons. Trailing 24 hours. " +
      "Endpoint shape not yet verified against a merged implementation -- see this config's own doc comment.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.networkFulfillment}/reports/network-orders`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.networkFulfillment}/reports/network-orders/freshness`,
    renderBody,
  };
