import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { REPORTS_BASE_URL } from "../../config";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  pickFaceReplenishmentFunnelConfig,
  type ReplenishmentFunnelReportDto,
} from "./pickFaceReplenishment.config";

/**
 * pick-face-replenishment's "Replenishment Funnel" report, pinned to
 * GET /reports/replenishment-funnel and the CONTEXT-LEVEL
 * GET /reports/freshness (apis/openapi.yaml: ReplenishmentFunnelReport;
 * snake_case on the wire).
 */
const config = pickFaceReplenishmentFunnelConfig;
const REPORT_URL_PREFIX = config.reportUrl.split("?")[0];
const FRESHNESS_URL = config.freshnessUrl;
const FRESH = { as_of: "2026-10-17T09:59:50Z", lag_seconds: 30 };

function reportDto(
  overrides: Partial<ReplenishmentFunnelReportDto> = {},
): ReplenishmentFunnelReportDto {
  return {
    from: "2026-10-05T00:00:00Z",
    to: "2026-10-07T00:00:00Z",
    granularity: "day",
    days: [
      {
        day: "2026-10-05",
        requests_raised: 12,
        units_requested: 288,
        requests_completed: 9,
        units_replenished: 216,
        requests_cancelled: 1,
        completion_latency: { count: 9, p50_seconds: 1800, p95_seconds: 5400 },
        policies_declared: 2,
      },
      {
        day: "2026-10-06",
        requests_raised: 0,
        units_requested: 0,
        requests_completed: 0,
        units_replenished: 0,
        requests_cancelled: 0,
        completion_latency: { count: 0, p50_seconds: null, p95_seconds: null },
        policies_declared: 0,
      },
    ],
    ...overrides,
  };
}

describe("pickFaceReplenishmentFunnelConfig", () => {
  it("calls /reports/replenishment-funnel and the context-level freshness over a multi-day window", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/replenishment-funnel$/);
    expect(FRESHNESS_URL).toMatch(/\/reports\/freshness$/);
    expect(config.reportUrl.startsWith(REPORTS_BASE_URL.pickFaceReplenishment)).toBe(true);
    const params = new URL(config.reportUrl).searchParams;
    const spanMs = Date.parse(params.get("to")!) - Date.parse(params.get("from")!);
    expect(spanMs).toBeGreaterThan(24 * 60 * 60 * 1000);
    // every site: no siteId narrowing
    expect(params.get("siteId")).toBeNull();
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

  it("renders the funnel, units and per-day latency; null percentiles are no reading", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () => HttpResponse.json(FRESH)),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() =>
      expect(screen.getByText("Pick-Face Replenishment: Funnel")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole("columnheader", { name: "Completion p95" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("columnheader", { name: "Units Replenished" })).toBeInTheDocument();
    expect(screen.getByText("Policy versions declared")).toBeInTheDocument();
    // cancelled is a count beside the funnel, not a funnel stage
    expect(screen.getByText("Cancelled", { selector: "dt" })).toBeInTheDocument();
    // the UTC day bucket is shown as served, not shifted by the viewer's timezone
    expect(screen.getByText("2026-10-05", { selector: "td" })).toBeInTheDocument();
    // 288 / 216 units appear in the chart and the table
    expect(screen.getAllByText("288").length).toBeGreaterThan(0);
    expect(screen.getAllByText("216").length).toBeGreaterThan(0);
    // 1800 s -> 30m, 5400 s -> 1h 30m via formatDuration
    expect(screen.getByText("30m")).toBeInTheDocument();
    expect(screen.getByText("1h 30m")).toBeInTheDocument();
    // the zero-count day has null percentiles: two no-reading cells, never "0s"
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("0s")).not.toBeInTheDocument();
    expect(screen.getByText("30s behind")).toBeInTheDocument();
  });

  it("renders the empty state and 'freshness unknown' before the projector applied an event", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto({ days: [] }))),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ as_of: null, lag_seconds: null })),
    );
    render(<ContextReportScreen config={config} />);
    await waitFor(() =>
      expect(
        screen.getAllByText("No replenishment requests in this window.").length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getByText("freshness unknown")).toBeInTheDocument();
  });

  it("renders one error card on a whole-request failure", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(null, { status: 404 })),
      http.get(FRESHNESS_URL, () => HttpResponse.json(FRESH)),
    );
    render(<ContextReportScreen config={config} />);
    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Couldn't reach pick-face-replenishment's reports service/),
    ).toBeInTheDocument();
  });
});
