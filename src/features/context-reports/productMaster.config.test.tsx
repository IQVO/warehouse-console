import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  productMasterDataQualityConfig,
  type MasterDataQualityReportDto,
} from "./productMaster.config";

/**
 * product-master's "Master Data Quality" report, pinned to the routes and
 * DTO its reports router serves on develop (internal/adapters/inbound/
 * http/reports_handler.go: GET /reports/master-data-quality and the
 * CONTEXT-LEVEL GET /reports/freshness, qualityReportDTO -- snake_case on
 * the wire, like the analytics event payloads). Fixture values mirror the
 * openapi.yaml example.
 */
const REPORT_URL_PREFIX = productMasterDataQualityConfig.reportUrl.split("?")[0];
const FRESHNESS_URL = productMasterDataQualityConfig.freshnessUrl;

function reportDto(
  overrides: Partial<MasterDataQualityReportDto> = {},
): MasterDataQualityReportDto {
  return {
    from: "2026-10-05T00:00:00Z",
    to: "2026-10-07T00:00:00Z",
    days: [
      {
        day: "2026-10-05",
        registered: 12,
        classified: 9,
        dimensions_declared: 7,
        measured: 2,
        open_discrepancies: 1,
      },
    ],
    coverage: {
      products: 120,
      classified: 96,
      dimensions_declared: 80,
      measured: 40,
      open_discrepancies: 2,
      classified_ratio: 0.8,
      dimensions_declared_ratio: 0.6667,
      measured_ratio: 0.3333,
      discrepancy_ratio: 0.05,
    },
    ...overrides,
  };
}

describe("productMasterDataQualityConfig", () => {
  it("calls /reports/master-data-quality and the context-level freshness", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/master-data-quality$/);
    // Not a per-report sibling: product-reports serves one projection
    // freshness for its single report.
    expect(FRESHNESS_URL).toMatch(/\/reports\/freshness$/);
    const params = new URL(productMasterDataQualityConfig.reportUrl).searchParams;
    expect(params.get("from")).not.toBeNull();
    expect(params.get("to")).not.toBeNull();
    // Day-bucketed report: the window must span more than one day.
    const spanMs = Date.parse(params.get("to")!) - Date.parse(params.get("from")!);
    expect(spanMs).toBeGreaterThan(24 * 60 * 60 * 1000);
  });

  it("renders a loading state before the response arrives", () => {
    server.use(
      http.get(REPORT_URL_PREFIX, async () => {
        await new Promise(() => {});
      }),
      http.get(FRESHNESS_URL, async () => {
        await new Promise(() => {});
      }),
    );
    render(<ContextReportScreen config={productMasterDataQualityConfig} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders every field the master-data-quality report returns", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: "2026-10-07T11:59:55Z", lag_seconds: 4.2 }),
      ),
    );
    render(<ContextReportScreen config={productMasterDataQualityConfig} />);

    await waitFor(() =>
      expect(screen.getByText("Product Master: Data Quality")).toBeInTheDocument(),
    );
    // per-day first events, in the table.
    expect(screen.getAllByText("12").length).toBeGreaterThan(0);
    expect(screen.getAllByText("9").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    // coverage snapshot counts and ratios rendered as percents.
    expect(screen.getAllByText("120").length).toBeGreaterThan(0);
    expect(screen.getAllByText("80%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5%").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("columnheader", { name: "Dimensions Declared" }),
    ).toBeInTheDocument();
    // snake_case lag_seconds feeds the badge exactly like lagSeconds does.
    expect(screen.getByText("4s behind")).toBeInTheDocument();
  });

  it("renders one error card on a whole-request failure, no fabricated numbers", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(null, { status: 500 })),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: "2026-10-07T11:59:55Z", lag_seconds: 10 }),
      ),
    );
    render(<ContextReportScreen config={productMasterDataQualityConfig} />);

    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Couldn't reach product-master's reports service/),
    ).toBeInTheDocument();
    expect(screen.queryByText("120")).not.toBeInTheDocument();
  });

  it("renders the table's empty state when the window has no days", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () =>
        HttpResponse.json(reportDto({ days: [] })),
      ),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: null, lag_seconds: null }),
      ),
    );
    render(<ContextReportScreen config={productMasterDataQualityConfig} />);

    await waitFor(() =>
      expect(
        screen.getByText("No product-master activity in this window."),
      ).toBeInTheDocument(),
    );
  });
});
