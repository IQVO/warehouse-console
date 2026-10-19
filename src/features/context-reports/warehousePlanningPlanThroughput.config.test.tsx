import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { REPORTS_BASE_URL } from "../../config";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  warehousePlanningPlanThroughputConfig,
  type PlanThroughputReportDto,
} from "./warehousePlanningPlanThroughput.config";

/**
 * warehouse-planning's "Plan Throughput" report, pinned to
 * GET /reports/plan-throughput and the CONTEXT-LEVEL GET /reports/freshness
 * (apis/openapi.yaml: PlanThroughputReport; snake_case on the wire).
 */
const config = warehousePlanningPlanThroughputConfig;
const REPORT_URL_PREFIX = config.reportUrl.split("?")[0];
const FRESHNESS_URL = config.freshnessUrl;

function reportDto(
  overrides: Partial<PlanThroughputReportDto> = {},
): PlanThroughputReportDto {
  return {
    from: "2026-09-17T00:00:00Z",
    to: "2026-10-17T00:00:00Z",
    days: [
      {
        warehouse_id: "WH-1",
        location: "SIM1",
        day: "2026-10-16",
        plans_created: 5,
        plans_published: 4,
      },
    ],
    latency: [
      {
        warehouse_id: "WH-1",
        location: "SIM1",
        plans: 4,
        median_seconds: 390,
        p95_seconds: 1620,
      },
    ],
    ...overrides,
  };
}

describe("warehousePlanningPlanThroughputConfig", () => {
  it("calls /reports/plan-throughput and the context-level freshness over a multi-day window", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/plan-throughput$/);
    expect(FRESHNESS_URL).toMatch(/\/reports\/freshness$/);
    const params = new URL(config.reportUrl).searchParams;
    const spanMs = Date.parse(params.get("to")!) - Date.parse(params.get("from")!);
    expect(spanMs).toBeGreaterThan(24 * 60 * 60 * 1000);
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

  it("renders the days table and the per-site latency", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: "2026-10-17T09:59:50Z", lag_seconds: 30 }),
      ),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() =>
      expect(screen.getByText("Capacity Planning: Plan Throughput")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getAllByText("WH-1/SIM1").length).toBe(2),
    );
    expect(screen.getByRole("columnheader", { name: "Created" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Plans Measured" })).toBeInTheDocument();
    // 390 s and 1620 s through ui-kit's formatDuration (rounds to minutes)
    expect(screen.getByText("7m")).toBeInTheDocument();
    expect(screen.getByText("27m")).toBeInTheDocument();
    expect(screen.getByText("30s behind")).toBeInTheDocument();
  });

  it("says there is no latency rather than printing zeros when none was observed", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto({ latency: [] }))),
      http.get(FRESHNESS_URL, () => HttpResponse.json({ as_of: null, lag_seconds: null })),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() =>
      expect(screen.getByText(/so there is no latency to report/)).toBeInTheDocument(),
    );
    expect(screen.getByText("freshness unknown")).toBeInTheDocument();
  });

  it("renders one error card on a whole-request failure", async () => {
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
  });
});
