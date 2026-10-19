import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { REPORTS_BASE_URL } from "../../config";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  networkInventoryTransferFunnelConfig,
  type TransferFunnelReportDto,
} from "./networkInventoryTransferFunnel.config";

/**
 * network-inventory-planning's "Transfer Funnel" report, pinned to
 * GET /reports/transfer-funnel and the CONTEXT-LEVEL GET /reports/freshness
 * (apis/openapi.yaml: TransferFunnelReport; snake_case on the wire).
 */
const config = networkInventoryTransferFunnelConfig;
const REPORT_URL_PREFIX = config.reportUrl.split("?")[0];
const FRESHNESS_URL = config.freshnessUrl;
const FRESH = { as_of: "2026-10-17T09:59:50Z", lag_seconds: 30 };

function reportDto(overrides: Partial<TransferFunnelReportDto> = {}): TransferFunnelReportDto {
  return {
    from: "2026-09-17T00:00:00Z",
    to: "2026-10-17T00:00:00Z",
    days: [
      { day: "2026-10-16", state: "APPROVED", transfers: 5 },
      { day: "2026-10-16", state: "ALLOCATING", transfers: 3 },
      { day: "2026-10-15", state: "APPROVED", transfers: 4 },
    ],
    ...overrides,
  };
}

describe("networkInventoryTransferFunnelConfig", () => {
  it("calls /reports/transfer-funnel and the context-level freshness over a multi-day window", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/transfer-funnel$/);
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

  it("renders the states reached, totalled across days, and the per-day rows", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () => HttpResponse.json(FRESH)),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() =>
      expect(screen.getByText("Network Inventory: Transfer Funnel")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole("columnheader", { name: "State Reached" })).toBeInTheDocument(),
    );
    // APPROVED: 5 + 4 across two days, in the chart's bar title.
    expect(screen.getByText("APPROVED: 9")).toBeInTheDocument();
    expect(screen.getByText("ALLOCATING: 3")).toBeInTheDocument();
    expect(screen.getByText("30s behind")).toBeInTheDocument();
  });

  it("renders the empty state when no transfer moved", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto({ days: [] }))),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ as_of: null, lag_seconds: null })),
    );
    render(<ContextReportScreen config={config} />);
    await waitFor(() =>
      expect(
        screen.getAllByText("No transfer transitions in this window.").length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getByText("freshness unknown")).toBeInTheDocument();
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
