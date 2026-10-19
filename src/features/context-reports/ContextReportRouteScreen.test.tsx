import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { ContextReportRouteScreen } from "./ContextReportRouteScreen";
import { REPORT_ROUTES } from "./registry";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reports/:context" element={<ContextReportRouteScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("REPORT_ROUTES registry", () => {
  it("has unique slugs", () => {
    const slugs = REPORT_ROUTES.map((r) => r.path);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has unique report URLs, so no two screens duplicate one endpoint", () => {
    const urls = REPORT_ROUTES.map((r) => r.config.reportUrl.split("?")[0]);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("ContextReportRouteScreen sibling navigation", () => {
  it("links a context's other reports and marks the current one", async () => {
    server.use(
      http.get(/\/api\/warehouse-planning\/reports\//, () =>
        HttpResponse.json(null, { status: 503 }),
      ),
    );
    renderAt("/reports/warehouse-planning-plan-throughput");

    const nav = await screen.findByRole("navigation", {
      name: "warehouse-planning reports",
    });
    expect(nav).toBeInTheDocument();
    expect(
      screen.getByText("Capacity Planning: Plan Throughput", { selector: "span" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Capacity Planning: Shortage Trend" }),
    ).toHaveAttribute("href", "/reports/warehouse-planning");
    expect(
      screen.getByRole("link", { name: "Capacity Planning: Bottleneck Frequency" }),
    ).toHaveAttribute("href", "/reports/warehouse-planning-bottleneck-frequency");
  });

  it("renders no sibling nav for a single-report context", async () => {
    server.use(
      http.get(/\/api\/product-master\/reports\//, () =>
        HttpResponse.json(null, { status: 503 }),
      ),
    );
    renderAt("/reports/product-master");
    await waitFor(() =>
      expect(screen.getByText("Report temporarily unavailable")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("falls through to the 404 screen for an unknown slug", () => {
    renderAt("/reports/no-such-context");
    expect(screen.getByText(/Page not found/i)).toBeInTheDocument();
  });
});
