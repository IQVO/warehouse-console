import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { REPORTS_BASE_URL } from "../../config";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  networkInventoryStateDwellConfig,
  type StateDwellReportDto,
} from "./networkInventoryStateDwell.config";

/**
 * network-inventory-planning's "State Dwell" report, pinned to
 * GET /reports/state-dwell and the CONTEXT-LEVEL GET /reports/freshness
 * (apis/openapi.yaml: StateDwellReport; snake_case on the wire).
 */
const config = networkInventoryStateDwellConfig;
const REPORT_URL_PREFIX = config.reportUrl.split("?")[0];
const FRESHNESS_URL = config.freshnessUrl;
const FRESH = { as_of: "2026-10-17T09:59:50Z", lag_seconds: 30 };

function reportDto(overrides: Partial<StateDwellReportDto> = {}): StateDwellReportDto {
  return {
    from: "2026-09-17T00:00:00Z",
    to: "2026-10-17T00:00:00Z",
    days: [
      {
        day: "2026-10-16",
        state: "PROPOSED",
        transitions: 6,
        p50_age_seconds: 200,
        p95_age_seconds: 601.25,
      },
    ],
    ...overrides,
  };
}

describe("networkInventoryStateDwellConfig", () => {
  it("calls /reports/state-dwell and the context-level freshness over a multi-day window", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/state-dwell$/);
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

  it("renders saga age at exit as durations, labelled as age rather than dwell", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () => HttpResponse.json(FRESH)),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() =>
      expect(screen.getByText("Network Inventory: State Dwell")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole("columnheader", { name: "Saga Age p95" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("columnheader", { name: "State Left" })).toBeInTheDocument();
    // 200 s -> 3m, 601.25 s -> 10m (ui-kit formatDuration rounds to minutes)
    expect(screen.getByText("3m")).toBeInTheDocument();
    expect(screen.getByText("10m")).toBeInTheDocument();
    expect(screen.getAllByText("PROPOSED").length).toBeGreaterThan(0);
    expect(screen.getByText(/not the time spent in that state/)).toBeInTheDocument();
  });

  it("renders the empty state when no state was left", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto({ days: [] }))),
      http.get(FRESHNESS_URL, () => HttpResponse.json(FRESH)),
    );
    render(<ContextReportScreen config={config} />);
    await waitFor(() =>
      expect(
        screen.getAllByText("No state transitions in this window.").length,
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
