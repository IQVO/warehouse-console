import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { ContextReportScreen } from "./ContextReportScreen";
import type { ContextReportConfig } from "./types";

/**
 * A synthetic config, not one of the nine real ones -- this file tests
 * ContextReportScreen's OWN three degradation states in isolation, which
 * every real per-context config inherits for free. The per-context
 * configs (facilityLayout.config.test.tsx, fulfillmentExecution.config.test.tsx)
 * separately verify their own real DTO shapes render correctly through
 * this same shell.
 */
interface FakeDto {
  widgetsBuilt: number;
}

const REPORT_URL = "https://example.test/reports/widgets";
const FRESHNESS_URL = "https://example.test/reports/widgets/freshness";

function renderBody(data: FakeDto): ReactElement {
  return <div data-testid="widgets-built">{data.widgetsBuilt}</div>;
}

const config: ContextReportConfig<FakeDto> = {
  contextId: "fake-context",
  title: "Fake Context Report",
  subtitle: "A synthetic report for shell-level tests.",
  reportUrl: REPORT_URL,
  freshnessUrl: FRESHNESS_URL,
  renderBody,
};

const stubReport = (dto: FakeDto) => http.get(REPORT_URL, () => HttpResponse.json(dto));
const stubFreshness = (lagSeconds: number) =>
  http.get(FRESHNESS_URL, () => HttpResponse.json({ lagSeconds }));

describe("ContextReportScreen", () => {
  it("shows a loading state before the first response arrives", () => {
    server.use(
      http.get(REPORT_URL, async () => {
        await new Promise(() => {}); // never resolves within the test
      }),
      http.get(FRESHNESS_URL, async () => {
        await new Promise(() => {});
      }),
    );
    render(<ContextReportScreen config={config} />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(
      screen.getByText(/Reading the analytical projection from fake-context/),
    ).toBeInTheDocument();
  });

  it("renders the populated report body and its freshness badge", async () => {
    server.use(stubReport({ widgetsBuilt: 42 }), stubFreshness(30));
    render(<ContextReportScreen config={config} />);

    await waitFor(() => expect(screen.getByTestId("widgets-built")).toHaveTextContent("42"));
    expect(screen.getByText("Fake Context Report")).toBeInTheDocument();
    expect(screen.getByText("30s behind")).toBeInTheDocument();
  });

  /**
   * The whole-request failure state: no fabricated numbers, one error
   * card naming the context, matching ReportDashboard's own philosophy.
   */
  it("renders a single error card on a whole-request failure, no fabricated numbers", async () => {
    server.use(
      http.get(REPORT_URL, () => HttpResponse.json(null, { status: 503 })),
      stubFreshness(10),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Couldn't reach fake-context's reports service/)).toBeInTheDocument();
    expect(screen.queryByTestId("widgets-built")).not.toBeInTheDocument();
  });

  /**
   * Freshness failing independently must NOT block the report body --
   * they are two separate fetches, and the body has its own real numbers
   * regardless of whether the freshness sidecar answered.
   */
  it("still renders the report body when only freshness fails", async () => {
    server.use(
      stubReport({ widgetsBuilt: 7 }),
      http.get(FRESHNESS_URL, () => HttpResponse.json(null, { status: 503 })),
    );
    render(<ContextReportScreen config={config} />);

    await waitFor(() => expect(screen.getByTestId("widgets-built")).toHaveTextContent("7"));
    expect(screen.getByText("freshness unknown")).toBeInTheDocument();
  });
});
