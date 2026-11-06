import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { SERVICE_BASE_URL } from "../../config";
import { ContextsScreen } from "./ContextsScreen";

// facility-layout GET /sites answers {items,nextCursor} since 2026-11-01
// (REST guideline 5.2); the Facility tile badge counts every site.
const site = (siteCode: string) => ({ siteCode, name: `Site ${siteCode}`, status: "Active" });

function stubPick(): void {
  server.use(
    http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
      HttpResponse.json({ taskType: "PICK", depth: 3 }),
    ),
  );
}

function renderScreen(): void {
  render(
    <MemoryRouter>
      <ContextsScreen />
    </MemoryRouter>,
  );
}

describe("ContextsScreen Facility badge (paged GET /sites)", () => {
  it("counts the sites on every page, following nextCursor to the last page", async () => {
    stubPick();
    const cursors: Array<string | null> = [];
    server.use(
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        if (cursor === null) {
          return HttpResponse.json({ items: [site("A1"), site("A2")], nextCursor: "c1" });
        }
        if (cursor === "c1") {
          return HttpResponse.json({ items: [site("B1"), site("B2")], nextCursor: "c2" });
        }
        return HttpResponse.json({ items: [site("C1")] });
      }),
    );
    renderScreen();

    await waitFor(() => expect(screen.getByRole("link", { name: /Facility/ })).toHaveTextContent("5 sites"));
    expect(cursors).toEqual([null, "c1", "c2"]);
  });

  it("singularises a one-site page", async () => {
    stubPick();
    server.use(
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () =>
        HttpResponse.json({ items: [site("A1")] }),
      ),
    );
    renderScreen();

    await waitFor(() => expect(screen.getByRole("link", { name: /Facility/ })).toHaveTextContent("1 site"));
    expect(screen.getByRole("link", { name: /Facility/ })).not.toHaveTextContent("1 sites");
  });

  it("shows an empty-but-valid page as 0 sites", async () => {
    stubPick();
    server.use(
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json({ items: [] })),
    );
    renderScreen();

    await waitFor(() => expect(screen.getByRole("link", { name: /Facility/ })).toHaveTextContent("0 sites"));
  });

  it.each([
    ["a bare array (the retired shape)", [site("A1")]],
    ["an object without items", { sites: [site("A1")] }],
    ["items null", { items: null }],
  ])("refuses %s instead of reading it as a count", async (_name, body) => {
    stubPick();
    let hits = 0;
    server.use(
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => {
        hits += 1;
        return HttpResponse.json(body);
      }),
    );
    renderScreen();

    await waitFor(() => expect(hits).toBeGreaterThan(0));
    // Let the response settle; the badge must stay absent, never "0 sites" / "undefined sites".
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("link", { name: /Facility/ })).not.toHaveTextContent(/\d+ sites?\b/);
    expect(screen.getByRole("link", { name: /Facility/ })).not.toHaveTextContent("undefined");
  });
});
