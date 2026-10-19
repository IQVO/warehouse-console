import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { REPORTS_BASE_URL } from "../../config";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import {
  taskInterleavingHintAdoptionConfig,
  type HintAdoptionReportDto,
} from "./taskInterleaving.config";

/**
 * task-interleaving's "Hint Adoption" report, pinned to
 * GET /reports/hint-adoption and the CONTEXT-LEVEL GET /reports/freshness
 * (apis/openapi.yaml: HintAdoptionReport; snake_case on the wire).
 */
const config = taskInterleavingHintAdoptionConfig;
const REPORT_URL_PREFIX = config.reportUrl.split("?")[0];
const FRESHNESS_URL = config.freshnessUrl;
const FRESH = { as_of: "2026-10-17T09:59:50Z", lag_seconds: 30 };

function reportDto(overrides: Partial<HintAdoptionReportDto> = {}): HintAdoptionReportDto {
  return {
    from: "2026-10-05T00:00:00Z",
    to: "2026-10-07T00:00:00Z",
    granularity: "day",
    days: [
      {
        day: "2026-10-05",
        hints_issued: 120,
        hints_consumed: 54,
        hints_expired: 40,
        adoption_rate: 0.574,
        consumed_first_rank: 41,
        mean_detour_m: 6.3,
        time_to_consume: { count: 54, p50_seconds: 21.5, p95_seconds: 74 },
      },
      {
        day: "2026-10-06",
        hints_issued: 0,
        hints_consumed: 0,
        hints_expired: 0,
        adoption_rate: null,
        consumed_first_rank: 0,
        mean_detour_m: null,
        time_to_consume: { count: 0, p50_seconds: null, p95_seconds: null },
      },
    ],
    ...overrides,
  };
}

describe("taskInterleavingHintAdoptionConfig", () => {
  it("calls /reports/hint-adoption and the context-level freshness over a multi-day window", () => {
    expect(REPORT_URL_PREFIX).toMatch(/\/reports\/hint-adoption$/);
    expect(FRESHNESS_URL).toMatch(/\/reports\/freshness$/);
    expect(config.reportUrl.startsWith(REPORTS_BASE_URL.taskInterleaving)).toBe(true);
    const params = new URL(config.reportUrl).searchParams;
    const spanMs = Date.parse(params.get("to")!) - Date.parse(params.get("from")!);
    expect(spanMs).toBeGreaterThan(24 * 60 * 60 * 1000);
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

  it("renders adoption per day; a day with no ended hint shows no reading, not 0%", async () => {
    server.use(
      http.get(REPORT_URL_PREFIX, () => HttpResponse.json(reportDto())),
      http.get(FRESHNESS_URL, () => HttpResponse.json(FRESH)),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() =>
      expect(screen.getByText("Task Interleaving: Hint Adoption")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole("columnheader", { name: "Adoption Rate" })).toBeInTheDocument(),
    );
    expect(screen.getByText("57.4%")).toBeInTheDocument();
    expect(screen.getByText("6.3 m")).toBeInTheDocument();
    // 21.5 s -> 22s, 74 s -> 1m via formatDuration
    expect(screen.getByText("22s")).toBeInTheDocument();
    expect(screen.getByText("1m")).toBeInTheDocument();
    expect(screen.getByText("Consumed hints that were rank 1")).toBeInTheDocument();
    // the all-null day: adoption, detour and both percentiles are no reading
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.queryByText("0 m")).not.toBeInTheDocument();
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
        screen.getAllByText("No interleaving hints in this window.").length,
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
      screen.getByText(/Couldn't reach task-interleaving's reports service/),
    ).toBeInTheDocument();
  });
});
