import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { REPORTS_BASE_URL } from "../../config";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  warehousePlanningBottleneckFrequencyConfig,
  type BottleneckFrequencyReportDto,
} from "./warehousePlanningBottleneckFrequency.config";

/**
 * warehouse-planning's "Bottleneck Frequency" report, pinned to
 * GET /reports/bottleneck-frequency and the CONTEXT-LEVEL
 * GET /reports/freshness (apis/openapi.yaml: BottleneckFrequencyReport;
 * snake_case on the wire).
 */
const config = warehousePlanningBottleneckFrequencyConfig;
const REPORT_URL_PREFIX = config.reportUrl.split("?")[0];
const FRESHNESS_URL = config.freshnessUrl;

function reportDto(
  overrides: Partial<BottleneckFrequencyReportDto> = {},
): BottleneckFrequencyReportDto {
  return {
    from: "2026-09-17T00:00:00Z",
    to: "2026-10-17T00:00:00Z",
    rows: [
      {
        warehouse_id: "WH-1",
        location: "SIM1",
        bottleneck_step: "REBIN",
        binding_constraint: "LABOR",
        plans: 3,
        share: 0.75,
      },
      {
        warehouse_id: "WH-1",
        location: "SIM1",
        bottleneck_step: "PACK",
        binding_constraint: "",
        plans: 1,
        share: 0.25,
      },
    ],
    ...overrides,
  };
}

describe("warehousePlanningBottleneckFrequencyConfig", () => {
  it("calls /reports/bottleneck-frequency and the context-level freshness", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/bottleneck-frequency$/);
    expect(FRESHNESS_URL).toMatch(/\/reports\/freshness$/);
    const params = new URL(config.reportUrl).searchParams;
    expect(params.get("from")).not.toBeNull();
    expect(params.get("to")).not.toBeNull();
    // Only ever warehouse-planning's own reports base, never a BFF.
    expect(config.reportUrl.startsWith(REPORTS_BASE_URL.warehousePlanning)).toBe(true);
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
    render(<ContextReportScreen config={config} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders every field the bottleneck-frequency report returns", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: "2026-10-17T09:59:50Z", lag_seconds: 30 }),
      ),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() =>
      expect(
        screen.getByText("Capacity Planning: Bottleneck Frequency"),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getAllByText("WH-1/SIM1").length).toBe(2),
    );
    expect(screen.getAllByText("REBIN").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LABOR").length).toBeGreaterThan(0);
    // share rendered as a percent
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    // an empty binding_constraint is "unknown", never a blank or invented value
    expect(screen.getAllByText("unknown").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("columnheader", { name: "Share of Site's Plans" }),
    ).toBeInTheDocument();
    expect(screen.getByText("30s behind")).toBeInTheDocument();
  });

  it("renders one error card on a whole-request failure, no fabricated numbers", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(null, { status: 500 })),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: "2026-10-17T09:59:50Z", lag_seconds: 10 }),
      ),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Couldn't reach warehouse-planning's reports service/),
    ).toBeInTheDocument();
    expect(screen.queryByText("75%")).not.toBeInTheDocument();
  });

  it("renders the table's empty state when the window has no rows", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto({ rows: [] }))),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ as_of: null, lag_seconds: null })),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() =>
      expect(
        screen.getAllByText("No published plans in this window.").length,
      ).toBeGreaterThan(0),
    );
  });
});
