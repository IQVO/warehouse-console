import type { ReactElement } from "react";
import { BarChart, Card, DataTable, FunnelChart } from "@warehouse/ui-kit";
import { formatDuration, formatInstant, formatNumber } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * network-fulfillment's "Network Order Acknowledgement & Translation" report.
 *
 * Real endpoint + DTO shape read directly from
 * network-fulfillment/internal/adapters/inbound/http/reports_handler.go
 * (`acknowledgementRowDTO`, served by the `netfulfil-reports` binary and
 * documented in that repo's apis/openapi.yaml `AcknowledgementReportRow`):
 *
 *   GET /reports/acknowledgement?from=&to=&granularity=day
 *   -> { rows: [{ dayBucket, ordersReceived, ordersAcknowledged,
 *                 ordersRejectedUntranslatableSku, ordersRejectedDomain,
 *                 acknowledgementDeadlinesMissed,
 *                 ordersRejectedSubmissionFailed,
 *                 avgAcknowledgementLatencySeconds }] }
 *   GET /reports/acknowledgement/freshness -> { lagSeconds }
 *
 * `from`/`to` are required RFC3339; `granularity` accepts only "day" (the
 * default), so this screen defaults to a trailing 30-day window -- a 24h
 * window would show at most one or two buckets.
 *
 * The four rejection counters are deliberately separate signals:
 * untranslatable SKU is a catalogue gap in the Anti-Corruption Layer,
 * "domain" is order-management's promise policy refusing the deadline,
 * a missed deadline is an operational failure (the 24 h window closed
 * unanswered), and submission failed means the network did not accept
 * the acknowledgement we sent.
 */
export interface NetworkFulfillmentRowDto {
  dayBucket: string;
  ordersReceived: number;
  ordersAcknowledged: number;
  ordersRejectedUntranslatableSku: number;
  ordersRejectedDomain: number;
  acknowledgementDeadlinesMissed: number;
  ordersRejectedSubmissionFailed: number;
  avgAcknowledgementLatencySeconds: number;
}

export interface NetworkFulfillmentReportDto {
  rows: NetworkFulfillmentRowDto[];
}

const WINDOW = trailingDays(30);

function sum(
  rows: NetworkFulfillmentRowDto[],
  pick: (r: NetworkFulfillmentRowDto) => number,
): number {
  return rows.reduce((acc, r) => acc + pick(r), 0);
}

function renderBody(data: NetworkFulfillmentReportDto): ReactElement {
  const rows = data.rows;
  const received = sum(rows, (r) => r.ordersReceived);
  const acknowledged = sum(rows, (r) => r.ordersAcknowledged);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Received vs Acknowledged">
          <FunnelChart
            title="NETWORK ORDERS"
            stages={[
              { label: "Received", value: received },
              { label: "Acknowledged", value: acknowledged },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Rejections by Cause">
          <BarChart
            title="REJECTIONS"
            tone="warning"
            data={[
              {
                label: "Untranslatable SKU",
                value: sum(rows, (r) => r.ordersRejectedUntranslatableSku),
              },
              { label: "Promise Refused", value: sum(rows, (r) => r.ordersRejectedDomain) },
              {
                label: "Deadline Missed",
                value: sum(rows, (r) => r.acknowledgementDeadlinesMissed),
              },
              {
                label: "Submission Failed",
                value: sum(rows, (r) => r.ordersRejectedSubmissionFailed),
              },
            ]}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
      </div>

      <Card title="Acknowledgement by Day" padded={false}>
        <DataTable<NetworkFulfillmentRowDto>
          columns={[
            { key: "dayBucket", header: "Day", render: (r) => formatInstant(r.dayBucket) },
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
              key: "ordersRejectedUntranslatableSku",
              header: "Untranslatable SKU",
              align: "right",
              render: (r) => formatNumber(r.ordersRejectedUntranslatableSku),
            },
            {
              key: "ordersRejectedDomain",
              header: "Promise Refused",
              align: "right",
              render: (r) => formatNumber(r.ordersRejectedDomain),
            },
            {
              key: "acknowledgementDeadlinesMissed",
              header: "Deadlines Missed",
              align: "right",
              render: (r) => formatNumber(r.acknowledgementDeadlinesMissed),
            },
            {
              key: "ordersRejectedSubmissionFailed",
              header: "Submission Failed",
              align: "right",
              render: (r) => formatNumber(r.ordersRejectedSubmissionFailed),
            },
            {
              key: "avgAcknowledgementLatencySeconds",
              header: "Avg Ack Latency",
              align: "right",
              render: (r) => formatDuration(r.avgAcknowledgementLatencySeconds),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.dayBucket}
          emptyState={<div>No network-order activity in this window.</div>}
        />
      </Card>
    </>
  );
}

export const networkFulfillmentReportConfig: ContextReportConfig<NetworkFulfillmentReportDto> =
  {
    contextId: "network-fulfillment",
    title: "Network Fulfillment: Acknowledgement & Translation",
    subtitle:
      "ACL to the external retail network -- orders received and acknowledged, rejections by cause, and acknowledgement latency. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.networkFulfillment}/reports/acknowledgement`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.networkFulfillment}/reports/acknowledgement/freshness`,
    renderBody,
  };
