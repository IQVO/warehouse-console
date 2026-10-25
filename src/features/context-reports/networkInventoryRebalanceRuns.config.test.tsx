import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { REPORTS_BASE_URL } from "../../config";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  networkInventoryRebalanceRunsConfig,
  type RebalanceRunsReportDto,
} from "./networkInventoryRebalanceRuns.config";

/**
 * network-inventory-planning's "Rebalance Runs" report, pinned to
 * GET /reports/rebalance-runs and the CONTEXT-LEVEL GET /reports/freshness
 * (apis/openapi.yaml: RebalanceRunsReport; snake_case on the wire).
 */
const config = networkInventoryRebalanceRunsConfig;
const REPORT_URL_PREFIX = config.reportUrl.split("?")[0];
const FRESHNESS_URL = config.freshnessUrl;
const FRESH = { as_of: "2026-10-17T09:59:50Z", lag_seconds: 30 };

function reportDto(overrides: Partial<RebalanceRunsReportDto> = {}): RebalanceRunsReportDto {
  return {
    from: "2026-09-17T00:00:00Z",
    to: "2026-10-17T00:00:00Z",
    days: [
      {
        day: "2026-10-16",
        runs: 2,
        proposals: 14,
        rejected: 2,
        rejection_rate: 0.142857,
        stale_facts: 1,
      },
      {
        day: "2026-10-15",
        runs: 1,
        proposals: 0,
        rejected: 0,
        rejection_rate: 0,
        stale_facts: 0,
      },
    ],
    ...overrides,
  };
}

describe("networkInventoryRebalanceRunsConfig", () => {
  it("calls /reports/rebalance-runs and the context-level freshness over a multi-day window", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/rebalance-runs$/);
    expect(FRESHNESS_URL).toMatch(/\/reports\/freshness$/);
    expect(config.reportUrl.startsWith(REPORTS_BASE_URL.networkInventoryPlanning)).toBe(true);
    const params = new URL(config.reportUrl).searchParams;
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
    render(<ContextReportScreen config={config} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders runs, proposals and the rejection rate, and no calm 0% when nothing was proposed", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () => HttpResponse.json(FRESH)),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() =>
      expect(screen.getByText("Network Inventory: Rebalance Runs")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("columnheader", { name: "Rejected by Safety Checks" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("14.3%")).toBeInTheDocument();
    // The day with zero proposals has rejection_rate 0 on the wire: no reading.
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.getByText("Runs completed")).toBeInTheDocument();
    expect(screen.getByText("Stale facts seen")).toBeInTheDocument();
  });

  it("renders the empty state when no run completed", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto({ days: [] }))),
      http.get(FRESHNESS_URL, () => HttpResponse.json(FRESH)),
    );
    render(<ContextReportScreen config={config} />);
    await waitFor(() =>
      expect(
        screen.getAllByText("No rebalance runs in this window.").length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders one error card on a whole-request failure", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(null, { status: 500 })),
      http.get(FRESHNESS_URL, () => HttpResponse.json(FRESH)),
    );
    render(<ContextReportScreen config={config} />);
    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Couldn't reach network-inventory-planning's reports service/),
    ).toBeInTheDocument();
  });
});
