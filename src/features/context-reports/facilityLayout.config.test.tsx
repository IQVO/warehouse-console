import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import { facilityCatalogGrowthConfig } from "./facilityLayout.config";
import type { FacilityCatalogReportDto } from "./facilityLayout.config";

/**
 * facility-layout's catalog-growth report, wired through the real config
 * (facilityLayout.config.tsx) rather than a synthetic DTO -- this is the
 * "chosen 2 of 9" test the task asked for: a day-bucketed, multi-metric
 * report whose shape is genuinely different from fulfillment-execution's
 * hour-bucketed throughput report (see that config's own test file).
 */
const REPORT_URL_PREFIX = facilityCatalogGrowthConfig.reportUrl.split("?")[0];
const FRESHNESS_URL = facilityCatalogGrowthConfig.freshnessUrl;

function reportDto(overrides: Partial<FacilityCatalogReportDto> = {}): FacilityCatalogReportDto {
  return {
    rows: [
      {
        scope: "wh1",
        dayBucket: "2026-09-01T00:00:00Z",
        sitesRegistered: 1,
        zonesRegistered: 4,
        aislesRegistered: 12,
        locationTypesRegistered: 3,
        placementRulesDefined: 6,
        slotsRegistered: 240,
        slotsDecommissioned: 5,
        bulkImports: 2,
        importRowsSubmitted: 500,
        importRowsImported: 480,
        importRowsRejected: 20,
      },
    ],
    ...overrides,
  };
}

describe("facilityCatalogGrowthConfig", () => {
  it("renders a loading state before the response arrives", () => {
    server.use(
      http.get(REPORT_URL_PREFIX, async () => {
        await new Promise(() => {});
      }),
      http.get(FRESHNESS_URL, async () => {
        await new Promise(() => {});
      }),
    );
    render(<ContextReportScreen config={facilityCatalogGrowthConfig} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders slot/import totals and the day-bucketed table when populated", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ lagSeconds: 45 })),
    );
    render(<ContextReportScreen config={facilityCatalogGrowthConfig} />);

    await waitFor(() => expect(screen.getByText("Facility: Catalog Growth")).toBeInTheDocument());
    // BarChart totals: 240 slots registered, 5 decommissioned (appears in
    // both the chart's <text> readout and the DataTable row -- use
    // getAllByText rather than asserting a single match).
    expect(screen.getAllByText("240").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
    // DataTable row.
    expect(screen.getByText("wh1")).toBeInTheDocument();
    expect(screen.getByText("45s behind")).toBeInTheDocument();
  });

  it("renders one error card on a whole-request failure, no fabricated numbers", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(null, { status: 500 })),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ lagSeconds: 10 })),
    );
    render(<ContextReportScreen config={facilityCatalogGrowthConfig} />);

    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Couldn't reach facility-layout's reports service/),
    ).toBeInTheDocument();
    expect(screen.queryByText("wh1")).not.toBeInTheDocument();
  });

  it("renders the table's empty state when the window has no rows", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto({ rows: [] }))),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ lagSeconds: 5 })),
    );
    render(<ContextReportScreen config={facilityCatalogGrowthConfig} />);

    await waitFor(() =>
      expect(screen.getByText("No catalog activity in this window.")).toBeInTheDocument(),
    );
  });
});
