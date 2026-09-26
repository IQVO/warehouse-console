import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import { fulfillmentThroughputConfig } from "./fulfillmentExecution.config";
import type { FulfillmentThroughputReportDto } from "./fulfillmentExecution.config";

/**
 * fulfillment-execution's pick/pack/SLAM throughput report -- the second
 * of the "2 of 9" chosen configs, deliberately a different shape from
 * facility-layout's (hour-bucketed task/station rows with lease-expiry
 * and weigh-check-divert exception counts, vs facility's day-bucketed
 * catalog totals).
 */
const REPORT_URL_PREFIX = fulfillmentThroughputConfig.reportUrl.split("?")[0];
const FRESHNESS_URL = fulfillmentThroughputConfig.freshnessUrl;

function reportDto(
  overrides: Partial<FulfillmentThroughputReportDto> = {},
): FulfillmentThroughputReportDto {
  return {
    rows: [
      {
        taskType: "PICK",
        stationId: "station-1",
        hourBucket: "2026-09-05T09:00:00Z",
        completions: 120,
        avgClaimToCompleteSeconds: 45,
        leaseExpiries: 3,
        weighCheckDiverts: 1,
      },
    ],
    ...overrides,
  };
}

describe("fulfillmentThroughputConfig", () => {
  it("renders a loading state before the response arrives", () => {
    server.use(
      http.get(REPORT_URL_PREFIX, async () => {
        await new Promise(() => {});
      }),
      http.get(FRESHNESS_URL, async () => {
        await new Promise(() => {});
      }),
    );
    render(<ContextReportScreen config={fulfillmentThroughputConfig} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders completions and exception totals when populated", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ lagSeconds: 12 })),
    );
    render(<ContextReportScreen config={fulfillmentThroughputConfig} />);

    await waitFor(() =>
      expect(screen.getByText("Fulfillment: Throughput")).toBeInTheDocument(),
    );
    expect(screen.getAllByText("PICK").length).toBeGreaterThan(0);
    expect(screen.getByText("station-1")).toBeInTheDocument();
    expect(screen.getAllByText("120").length).toBeGreaterThan(0);
    expect(screen.getByText("12s behind")).toBeInTheDocument();
  });

  it("renders one error card on a whole-request failure, no fabricated numbers", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(null, { status: 502 })),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ lagSeconds: 8 })),
    );
    render(<ContextReportScreen config={fulfillmentThroughputConfig} />);

    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Couldn't reach fulfillment-execution's reports service/),
    ).toBeInTheDocument();
    expect(screen.queryByText("PICK")).not.toBeInTheDocument();
  });

  it("renders the table's empty state when the window has no rows", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto({ rows: [] }))),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ lagSeconds: 3 })),
    );
    render(<ContextReportScreen config={fulfillmentThroughputConfig} />);

    await waitFor(() =>
      expect(screen.getByText("No completions in this window.")).toBeInTheDocument(),
    );
  });
});
