import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./test/mocks/server";
import { SERVICE_BASE_URL } from "./config";
import { App } from "./App";

/**
 * The shell mounts every remote under `/<prefix>/*` behind a RemoteBoundary,
 * and no remote is running in a unit test, so the lazy `import()` of
 * `capacity_mfe/App` rejects. That is exactly the "remote is down" case the
 * boundary exists for: the route must still be OWNED by the shell (an inline
 * "unavailable" card), not fall through to the "Page not found" screen, and
 * "Contexts" must light up in the nav.
 */
describe("capacity_mfe route (/capacity/*)", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  function stubBadges() {
    server.use(
      http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
        HttpResponse.json({ taskType: "PICK", depth: 0 }),
      ),
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
    );
  }

  it.each(["/capacity", "/capacity/paths", "/capacity/plans"])(
    "%s is a shell route that falls back to the unavailable card when the remote is down",
    async (path) => {
      stubBadges();
      window.history.pushState({}, "", path);
      render(<App />);

      expect(await screen.findByText(/This module is unavailable right now/)).toBeInTheDocument();
      expect(screen.getByText("Capacity Planning")).toBeInTheDocument();
      expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
    },
  );

  it("keeps the Contexts nav item active while /capacity is open", async () => {
    stubBadges();
    window.history.pushState({}, "", "/capacity");
    render(<App />);

    await screen.findByText(/This module is unavailable right now/);
    const contexts = screen.getByRole("link", { name: "Contexts" });
    expect(contexts).toHaveAttribute("aria-current", "page");
  });

  it("does not capture a look-alike prefix", async () => {
    window.history.pushState({}, "", "/capacity-audit");
    render(<App />);

    expect(await screen.findByText(/Page not found/i)).toBeInTheDocument();
  });
});

describe("productmaster_mfe route (/product-master/*)", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  function stubBadges() {
    server.use(
      http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
        HttpResponse.json({ taskType: "PICK", depth: 0 }),
      ),
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
    );
  }

  it.each(["/product-master", "/product-master/register", "/product-master/products/SKU-1"])(
    "%s is a shell route that falls back to the unavailable card when the remote is down",
    async (path) => {
      stubBadges();
      window.history.pushState({}, "", path);
      render(<App />);

      expect(await screen.findByText(/This module is unavailable right now/)).toBeInTheDocument();
      expect(screen.getByText("Product Master")).toBeInTheDocument();
      expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
    },
  );

  it("keeps the Contexts nav item active while /product-master is open", async () => {
    stubBadges();
    window.history.pushState({}, "", "/product-master");
    render(<App />);

    await screen.findByText(/This module is unavailable right now/);
    const contexts = screen.getByRole("link", { name: "Contexts" });
    expect(contexts).toHaveAttribute("aria-current", "page");
  });

  it("does not capture a look-alike prefix", async () => {
    window.history.pushState({}, "", "/product-master-audit");
    render(<App />);

    expect(await screen.findByText(/Page not found/i)).toBeInTheDocument();
  });
});
