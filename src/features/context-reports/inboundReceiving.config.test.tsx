import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  inboundReceivingPerformanceConfig,
  type ReceivingPerformanceReportDto,
} from "./inboundReceiving.config";

/**
 * inbound-receiving's "Receiving Performance" report, pinned to the routes
 * and DTO its reports router serves on develop (internal/adapters/inbound/
 * http/reports_handler.go: GET /reports/receiving-performance and the
 * CONTEXT-LEVEL GET /reports/freshness, performanceReportDTO -- snake_case
 * on the wire, like the analytics event payloads). Fixture values mirror
 * the openapi.yaml example, including the null-percentile zero-count day.
 */
const REPORT_URL_PREFIX = inboundReceivingPerformanceConfig.reportUrl.split("?")[0];
const FRESHNESS_URL = inboundReceivingPerformanceConfig.freshnessUrl;

function reportDto(
  overrides: Partial<ReceivingPerformanceReportDto> = {},
): ReceivingPerformanceReportDto {
  return {
    from: "2026-10-05T00:00:00Z",
    to: "2026-10-07T00:00:00Z",
    days: [
      {
        day: "2026-10-05",
        receipts_closed: 14,
        lines_received: 52,
        units_good: 1840,
        units_damaged: 36,
        discrepancies: { short: 3, over: 1, damaged: 4 },
        receipt_cycle: { count: 14, p50_seconds: 2700, p95_seconds: 6900 },
        appointments: { booked: 18, checked_in: 15, cancelled: 2, completed: 14 },
        dock_dwell: { count: 14, p50_seconds: 3300, p95_seconds: 8100 },
      },
      {
        day: "2026-10-06",
        receipts_closed: 0,
        lines_received: 0,
        units_good: 0,
        units_damaged: 0,
        discrepancies: { short: 0, over: 0, damaged: 0 },
        receipt_cycle: { count: 0, p50_seconds: null, p95_seconds: null },
        appointments: { booked: 0, checked_in: 0, cancelled: 0, completed: 0 },
        dock_dwell: { count: 0, p50_seconds: null, p95_seconds: null },
      },
    ],
    current: { open_receipts: 2, expected_today: 9, expected_today_started: 5 },
    ...overrides,
  };
}

describe("inboundReceivingPerformanceConfig", () => {
  it("calls /reports/receiving-performance and the context-level freshness", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/receiving-performance$/);
    // Not a per-report sibling: inbound-reports serves one projection
    // freshness for its single report.
    expect(FRESHNESS_URL).toMatch(/\/reports\/freshness$/);
    const params = new URL(inboundReceivingPerformanceConfig.reportUrl).searchParams;
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
    render(<ContextReportScreen config={inboundReceivingPerformanceConfig} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders every field the receiving-performance report returns", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: "2026-10-07T11:59:55Z", lag_seconds: 4.2 }),
      ),
    );
    render(<ContextReportScreen config={inboundReceivingPerformanceConfig} />);

    await waitFor(() =>
      expect(
        screen.getByText("Inbound: Receiving Performance"),
      ).toBeInTheDocument(),
    );
    // daily throughput and units, in the cards and the table.
    expect(screen.getAllByText("14").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1,840").length).toBeGreaterThan(0);
    // the current snapshot, as its own card.
    expect(screen.getByText("Open receipts right now")).toBeInTheDocument();
    expect(screen.getAllByText("9").length).toBeGreaterThan(0);
    // timing percentiles rendered as durations, null as no reading.
    expect(screen.getAllByText("45m").length).toBeGreaterThan(0);
    expect(screen.getAllByText("55m").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("columnheader", { name: "Units Damaged" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Cycle p50" }),
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
    render(<ContextReportScreen config={inboundReceivingPerformanceConfig} />);

    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Couldn't reach inbound-receiving's reports service/),
    ).toBeInTheDocument();
    expect(screen.queryByText("1,840")).not.toBeInTheDocument();
  });

  it("renders the table's empty state when the window has no days", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () =>
        HttpResponse.json(
          reportDto({
            days: [],
            current: { open_receipts: 0, expected_today: 0, expected_today_started: 0 },
          }),
        ),
      ),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: null, lag_seconds: null }),
      ),
    );
    render(<ContextReportScreen config={inboundReceivingPerformanceConfig} />);

    await waitFor(() =>
      expect(
        screen.getByText("No receiving activity in this window."),
      ).toBeInTheDocument(),
    );
  });
});
