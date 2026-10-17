import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  networkInventoryStuckTransfersConfig,
  type StuckTransfersReportDto,
} from "./networkInventoryPlanning.config";

/**
 * network-inventory-planning's "Stuck Transfers" report, pinned to the
 * routes and DTO its reports router serves on develop
 * (internal/adapters/inbound/http/reports_handler.go:
 * GET /reports/stuck-transfers and the CONTEXT-LEVEL
 * GET /reports/freshness, stuckReportDTO -- snake_case on the wire, like
 * the analytics event payloads).
 */
const REPORT_URL_PREFIX = networkInventoryStuckTransfersConfig.reportUrl.split("?")[0];
const FRESHNESS_URL = networkInventoryStuckTransfersConfig.freshnessUrl;

function reportDto(
  overrides: Partial<StuckTransfersReportDto> = {},
): StuckTransfersReportDto {
  return {
    from: "2026-09-17T00:00:00Z",
    to: "2026-10-17T00:00:00Z",
    days: [
      {
        day: "2026-10-16",
        state: "ALLOCATING",
        detections: 3,
        transfers: 1,
      },
    ],
    latest: [
      {
        transfer_id: "TRF-1042",
        state: "ALLOCATING",
        age_seconds: 5400,
        threshold_seconds: 3600,
        detected_at: "2026-10-16T14:02:00Z",
      },
    ],
    ...overrides,
  };
}

describe("networkInventoryStuckTransfersConfig", () => {
  it("calls /reports/stuck-transfers and the context-level freshness", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/stuck-transfers$/);
    // Not a per-report sibling: nip-reports serves one projection freshness
    // for all four of its reports.
    expect(FRESHNESS_URL).toMatch(/\/reports\/freshness$/);
    const params = new URL(networkInventoryStuckTransfersConfig.reportUrl).searchParams;
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
    render(<ContextReportScreen config={networkInventoryStuckTransfersConfig} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders every field the stuck-transfers report returns", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: "2026-10-17T09:59:50Z", lag_seconds: 30 }),
      ),
    );
    render(<ContextReportScreen config={networkInventoryStuckTransfersConfig} />);

    await waitFor(() =>
      expect(
        screen.getByText("Network Inventory: Stuck Transfers"),
      ).toBeInTheDocument(),
    );
    // day/state row, detections vs distinct transfers kept distinct.
    expect(screen.getAllByText("ALLOCATING").length).toBeGreaterThan(1);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    // the latest occurrence: id, age and threshold rendered as durations.
    expect(screen.getAllByText("TRF-1042").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1h 30m").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1h").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("columnheader", { name: "Distinct Transfers" }),
    ).toBeInTheDocument();
    // snake_case lag_seconds feeds the badge exactly like lagSeconds does.
    expect(screen.getByText("30s behind")).toBeInTheDocument();
  });

  it("renders one error card on a whole-request failure, no fabricated numbers", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(null, { status: 500 })),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: "2026-10-17T09:59:50Z", lag_seconds: 10 }),
      ),
    );
    render(<ContextReportScreen config={networkInventoryStuckTransfersConfig} />);

    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(
        /Couldn't reach network-inventory-planning's reports service/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("TRF-1042")).not.toBeInTheDocument();
  });

  it("renders both tables' empty states when nothing matched", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () =>
        HttpResponse.json(reportDto({ days: [], latest: [] })),
      ),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: null, lag_seconds: null }),
      ),
    );
    render(<ContextReportScreen config={networkInventoryStuckTransfersConfig} />);

    await waitFor(() =>
      expect(
        screen.getByText("No stuck-transfer detections in this window."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("No transfers are stuck right now.")).toBeInTheDocument();
  });
});
