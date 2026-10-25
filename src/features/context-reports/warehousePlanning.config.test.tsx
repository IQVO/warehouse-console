import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  warehousePlanningShortageConfig,
  type ShortageTrendReportDto,
} from "./warehousePlanning.config";

/**
 * warehouse-planning's "Shortage Trend" report, pinned to the routes and
 * DTO its reports router serves on develop (internal/adapters/inbound/http/
 * reports_handler.go: GET /reports/shortage-trend and the CONTEXT-LEVEL
 * GET /reports/freshness, shortageDayDTO -- snake_case on the wire, like
 * the analytics event payloads).
 */
const REPORT_URL_PREFIX = warehousePlanningShortageConfig.reportUrl.split("?")[0];
const FRESHNESS_URL = warehousePlanningShortageConfig.freshnessUrl;

function reportDto(
  overrides: Partial<ShortageTrendReportDto> = {},
): ShortageTrendReportDto {
  return {
    from: "2026-09-17T00:00:00Z",
    to: "2026-10-17T00:00:00Z",
    days: [
      {
        day: "2026-10-16",
        warehouse_id: "WH-1",
        location: "SIM1",
        plans_published: 8,
        plans_with_shortage: 2,
        total_shortage: 5600,
        shortage_rate: 0.25,
      },
    ],
    ...overrides,
  };
}

describe("warehousePlanningShortageConfig", () => {
  it("calls /reports/shortage-trend and the context-level freshness", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/shortage-trend$/);
    // Not a per-report sibling: warehouse-planning serves one projection
    // freshness for all three of its reports.
    expect(FRESHNESS_URL).toMatch(/\/reports\/freshness$/);
    const params = new URL(warehousePlanningShortageConfig.reportUrl).searchParams;
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
    render(<ContextReportScreen config={warehousePlanningShortageConfig} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders every field the shortage-trend report returns", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: "2026-10-17T09:59:50Z", lag_seconds: 30 }),
      ),
    );
    render(<ContextReportScreen config={warehousePlanningShortageConfig} />);

    await waitFor(() =>
      expect(
        screen.getByText("Capacity Planning: Shortage Trend"),
      ).toBeInTheDocument(),
    );
    // site row identity
    expect(screen.getAllByText("WH-1/SIM1").length).toBeGreaterThan(0);
    // published / with-shortage / shortage appear in the cards and the table.
    expect(screen.getAllByText("8").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5,600").length).toBeGreaterThan(0);
    // shortage_rate rendered as a percent.
    expect(screen.getAllByText("25%").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("columnheader", { name: "Shortage (Orders)" }),
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
    render(<ContextReportScreen config={warehousePlanningShortageConfig} />);

    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Couldn't reach warehouse-planning's reports service/),
    ).toBeInTheDocument();
    expect(screen.queryByText("5,600")).not.toBeInTheDocument();
  });

  it("renders the table's empty state when the window has no days", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto({ days: [] }))),
      http.get(FRESHNESS_URL, () =>
        HttpResponse.json({ as_of: null, lag_seconds: null }),
      ),
    );
    render(<ContextReportScreen config={warehousePlanningShortageConfig} />);

    await waitFor(() =>
      expect(
        screen.getByText("No published plans in this window."),
      ).toBeInTheDocument(),
    );
  });
});
