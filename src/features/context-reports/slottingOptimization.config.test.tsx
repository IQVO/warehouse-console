import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  slottingPlanFunnelConfig,
  type SlotPlanFunnelReportDto,
} from "./slottingOptimization.config";

/**
 * slotting-optimization's "Slot Plan Funnel" report, pinned to the routes
 * and DTO its reports router serves on develop (slotting-optimization ADR
 * 0006: GET /reports/slot-plan-funnel and the CONTEXT-level
 * GET /reports/freshness, snake_case on the wire). Fixture values mirror
 * the openapi.yaml schemas, including the null-percentile zero-count day.
 */
const REPORT_URL_PREFIX = slottingPlanFunnelConfig.reportUrl.split("?")[0];
const FRESHNESS_URL = slottingPlanFunnelConfig.freshnessUrl;

function reportDto(
  overrides: Partial<SlotPlanFunnelReportDto> = {},
): SlotPlanFunnelReportDto {
  return {
    from: "2026-10-05T00:00:00Z",
    to: "2026-10-07T00:00:00Z",
    granularity: "day",
    days: [
      {
        day: "2026-10-05",
        plans_generated: 6,
        plans_approved: 4,
        plans_rejected: 1,
        approval_latency: { count: 4, p50_seconds: 1800, p95_seconds: 5400 },
        supersessions: 2,
      },
      {
        day: "2026-10-06",
        plans_generated: 0,
        plans_approved: 0,
        plans_rejected: 0,
        approval_latency: { count: 0, p50_seconds: null, p95_seconds: null },
        supersessions: 0,
      },
    ],
    ...overrides,
  };
}

describe("slottingPlanFunnelConfig", () => {
  it("calls /reports/slot-plan-funnel and the context-level freshness", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/slot-plan-funnel$/);
    // Not a per-report sibling: slotting-reports serves one projection
    // (the funnel), so freshness is context-level, like inbound-receiving.
    expect(FRESHNESS_URL).toMatch(/\/reports\/freshness$/);
  });

  it("renders the funnel, the day table and the null-percentile day", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () =>
        HttpResponse.json(reportDto(), { status: 200 }),
      ),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: "2026-10-07T00:00:12Z", lag_seconds: 12 }),
      ),
    );
    render(<ContextReportScreen config={slottingPlanFunnelConfig} />);

    // The screen title comes from the config, not the fetched data.
    await waitFor(() => {
      expect(
        screen.getAllByText(/Slot Plan Funnel/i).length,
      ).toBeGreaterThan(0);
    });
    // Window-total funnel stages render.
    await waitFor(() => {
      expect(screen.getAllByText(/^Generated$/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/^Approved$/).length).toBeGreaterThan(0);
    });
    // The zero-count day renders "no reading", never "0s" percentiles.
    expect(screen.queryByText("0s")).toBeNull();
  });

  it("renders the freshness generation from the context-level endpoint", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () =>
        HttpResponse.json(reportDto(), { status: 200 }),
      ),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: null, lag_seconds: null }),
      ),
    );
    render(<ContextReportScreen config={slottingPlanFunnelConfig} />);

    // lag_seconds: null must read as "unknown", never a fabricated 0s.
    await waitFor(() => {
      expect(screen.getByText(/unknown/i)).toBeTruthy();
    });
  });
});
