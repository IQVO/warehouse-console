import type { ReactElement } from "react";
import { BarChart, Card, DataTable, LineChart } from "@warehouse/ui-kit";
import { formatInstant, formatNumber, formatPercent } from "@warehouse/ui-kit";
import { REPORTS_BASE_URL } from "../../config";
import { trailingDays, withWindow } from "./reportWindow";
import type { ContextReportConfig } from "./types";

/**
 * product-master's "Master Data Quality" report.
 *
 * Real endpoint + DTO shape read directly from
 * product-master/apis/openapi.yaml (MasterDataQualityReport) and
 * internal/adapters/inbound/http/reports_handler.go (qualityReportDTO,
 * served by the product-reports binary):
 *
 *   GET /reports/master-data-quality?from=&to=
 *   -> { from, to,
 *        days: [{ day, registered, classified,
 *                  dimensions_declared, measured, open_discrepancies }],
 *        coverage: { products, classified, dimensions_declared, measured,
 *                    open_discrepancies, classified_ratio,
 *                    dimensions_declared_ratio, measured_ratio,
 *                    discrepancy_ratio } }
 *   GET /reports/freshness -> { as_of, lag_seconds }
 *
 * The wire shape is snake_case (like the analytics event payloads), so the
 * DTO interfaces below mirror the wire exactly and normalization happens
 * here in the render helpers. The report is this context's only one; its
 * two sections -- the per-day first-event growth and the CURRENT coverage
 * snapshot (independent of the range) -- are surfaced as separate cards
 * the way the multi-section configs do.
 *
 * Day-bucketed (`day` is a UTC calendar date; from/to default to the
 * trailing 30 days server-side), so the screen asks for a trailing 30-day
 * window.
 */
export interface QualityDayDto {
  day: string;
  registered: number;
  classified: number;
  dimensions_declared: number;
  measured: number;
  open_discrepancies: number;
}

export interface CoverageDto {
  products: number;
  classified: number;
  dimensions_declared: number;
  measured: number;
  open_discrepancies: number;
  classified_ratio: number;
  dimensions_declared_ratio: number;
  measured_ratio: number;
  discrepancy_ratio: number;
}

export interface MasterDataQualityReportDto {
  from: string;
  to: string;
  days: QualityDayDto[];
  coverage: CoverageDto;
}

const WINDOW = trailingDays(30);

function dailyRegisteredSeries(days: QualityDayDto[]): { label: string; value: number }[] {
  return [...days]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ label: formatInstant(d.day), value: d.registered }));
}

function renderBody(data: MasterDataQualityReportDto): ReactElement {
  const coverage = data.coverage;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--wh-space-4)",
        }}
      >
        <Card title="Products Registered per Day">
          <LineChart
            title="REGISTERED"
            data={dailyRegisteredSeries(data.days)}
            emptyState={<div>No data in this window.</div>}
          />
        </Card>
        <Card title="Current Coverage">
          <BarChart
            title="OF KNOWN PRODUCTS"
            formatValue={(value) => formatPercent(value)}
            data={[
              { label: "Classified", value: coverage.classified_ratio * 100 },
              {
                label: "Dimensions Declared",
                value: coverage.dimensions_declared_ratio * 100,
              },
              { label: "Measured", value: coverage.measured_ratio * 100 },
              {
                label: "Discrepant of Measured",
                value: coverage.discrepancy_ratio * 100,
              },
            ]}
            emptyState={<div>No products known yet.</div>}
          />
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "var(--wh-space-2)",
              margin: "var(--wh-space-3) 0 0",
            }}
          >
            <dt>Products known</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatNumber(coverage.products)}
            </dd>
            <dt>Open discrepancies</dt>
            <dd style={{ textAlign: "right", margin: 0 }}>
              {formatNumber(coverage.open_discrepancies)}
            </dd>
          </dl>
        </Card>
      </div>

      <Card title="First Events by Day" padded={false}>
        <DataTable<QualityDayDto>
          columns={[
            { key: "day", header: "Day", render: (d) => formatInstant(d.day) },
            {
              key: "registered",
              header: "Registered",
              align: "right",
              render: (d) => formatNumber(d.registered),
            },
            {
              key: "classified",
              header: "Classified",
              align: "right",
              render: (d) => formatNumber(d.classified),
            },
            {
              key: "dimensions_declared",
              header: "Dimensions Declared",
              align: "right",
              render: (d) => formatNumber(d.dimensions_declared),
            },
            {
              key: "measured",
              header: "Measured",
              align: "right",
              render: (d) => formatNumber(d.measured),
            },
            {
              key: "open_discrepancies",
              header: "Open Discrepancies",
              align: "right",
              render: (d) => formatNumber(d.open_discrepancies),
            },
          ]}
          rows={data.days}
          rowKey={(d) => d.day}
          emptyState={<div>No product-master activity in this window.</div>}
        />
      </Card>
    </>
  );
}

export const productMasterDataQualityConfig: ContextReportConfig<MasterDataQualityReportDto> =
  {
    contextId: "product-master",
    title: "Product Master: Data Quality",
    subtitle:
      "How the product master is filling in -- products registered, classified, dimensioned and measured per day, and the current coverage snapshot with its open declared-vs-measured discrepancies. Trailing 30 days.",
    reportUrl: withWindow(
      `${REPORTS_BASE_URL.productMaster}/reports/master-data-quality`,
      WINDOW,
    ),
    freshnessUrl: `${REPORTS_BASE_URL.productMaster}/reports/freshness`,
    renderBody,
  };
