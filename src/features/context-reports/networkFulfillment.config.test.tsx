import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import { networkFulfillmentReportConfig } from "./networkFulfillment.config";
import type { NetworkFulfillmentReportDto } from "./networkFulfillment.config";

/**
 * network-fulfillment's "Network Order Acknowledgement & Translation"
 * report, pinned to the routes and DTO its reports router serves on
 * develop (internal/adapters/inbound/http/reports_handler.go:
 * GET /reports/acknowledgement + /reports/acknowledgement/freshness,
 * acknowledgementRowDTO). The screen used to call the guessed
 * /reports/network-orders path and 404'd.
 */
const REPORT_URL_PREFIX = networkFulfillmentReportConfig.reportUrl.split("?")[0];
const FRESHNESS_URL = networkFulfillmentReportConfig.freshnessUrl;

function reportDto(
  overrides: Partial<NetworkFulfillmentReportDto> = {},
): NetworkFulfillmentReportDto {
  return {
    rows: [
      {
        dayBucket: "2026-10-01T00:00:00Z",
        ordersReceived: 137,
        ordersAcknowledged: 121,
        ordersRejectedUntranslatableSku: 6,
        ordersRejectedDomain: 4,
        acknowledgementDeadlinesMissed: 2,
        ordersRejectedSubmissionFailed: 3,
        avgAcknowledgementLatencySeconds: 5400,
      },
    ],
    ...overrides,
  };
}

describe("networkFulfillmentReportConfig", () => {
  it("calls /reports/acknowledgement and its freshness sibling", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/acknowledgement$/);
    expect(FRESHNESS_URL).toMatch(/\/reports\/acknowledgement\/freshness$/);
    const params = new URL(networkFulfillmentReportConfig.reportUrl).searchParams;
    expect(params.get("from")).not.toBeNull();
    expect(params.get("to")).not.toBeNull();
    // The report is day-bucketed (granularity=day is its only granularity),
    // so the window must span more than one day to show a trend.
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
    render(<ContextReportScreen config={networkFulfillmentReportConfig} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders every field the acknowledgement report returns", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ lagSeconds: 30 })),
    );
    render(<ContextReportScreen config={networkFulfillmentReportConfig} />);

    await waitFor(() =>
      expect(
        screen.getByText("Network Fulfillment: Acknowledgement & Translation"),
      ).toBeInTheDocument(),
    );
    // received / acknowledged appear in the funnel readout and the table.
    expect(screen.getAllByText("137").length).toBeGreaterThan(0);
    expect(screen.getAllByText("121").length).toBeGreaterThan(0);
    // the four rejection causes, each its own column.
    expect(screen.getAllByText("6").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    // avgAcknowledgementLatencySeconds rendered as a duration.
    expect(screen.getAllByText("1h 30m").length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: "Deadlines Missed" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Submission Failed" })).toBeInTheDocument();
    expect(screen.getByText("30s behind")).toBeInTheDocument();
  });

  it("renders one error card on a whole-request failure, no fabricated numbers", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(null, { status: 500 })),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ lagSeconds: 10 })),
    );
    render(<ContextReportScreen config={networkFulfillmentReportConfig} />);

    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Couldn't reach network-fulfillment's reports service/),
    ).toBeInTheDocument();
    expect(screen.queryByText("137")).not.toBeInTheDocument();
  });

  it("renders the table's empty state when the window has no rows", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto({ rows: [] }))),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ lagSeconds: 0 })),
    );
    render(<ContextReportScreen config={networkFulfillmentReportConfig} />);

    await waitFor(() =>
      expect(
        screen.getByText("No network-order activity in this window."),
      ).toBeInTheDocument(),
    );
  });
});
