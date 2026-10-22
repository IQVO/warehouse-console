import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { SERVICE_BASE_URL } from "../../config";
import { ContextsScreen } from "./ContextsScreen";

describe("ContextsScreen launchpad", () => {
  // 15s budget: this test renders the full launchpad and is the one that
  // tips over the default 5s when the suite grows (it did when the slotting
  // report-config file joined the same worker pool). It passes in
  // isolation; the budget covers loaded CI/dev machines, not a hang.
  it("lists a Capacity Planning tile that links to the warehouse-planning remote", { timeout: 15_000 }, () => {
    // The two live badges (queue depth, sites) are best-effort; stub them so
    // the unhandled-request guard in test/setup.ts stays strict.
    server.use(
      http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
        HttpResponse.json({ taskType: "PICK", depth: 3 }),
      ),
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
    );
    render(
      <MemoryRouter>
        <ContextsScreen />
      </MemoryRouter>,
    );

    const tile = screen.getByRole("link", { name: /Capacity Planning/ });
    expect(tile).toHaveAttribute("href", "/capacity");
  });

  it("lists a Product Master tile that links to the product-master remote", () => {
    server.use(
      http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
        HttpResponse.json({ taskType: "PICK", depth: 3 }),
      ),
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
    );
    render(
      <MemoryRouter>
        <ContextsScreen />
      </MemoryRouter>,
    );

    const tile = screen.getByRole("link", { name: /Product Master/ });
    expect(tile).toHaveAttribute("href", "/product-master");
    expect(tile).toHaveTextContent("product-master");
  });

  it("lists a Network Inventory tile that links to the network-inventory-planning remote", () => {
    server.use(
      http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
        HttpResponse.json({ taskType: "PICK", depth: 3 }),
      ),
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
    );
    render(
      <MemoryRouter>
        <ContextsScreen />
      </MemoryRouter>,
    );

    const tile = screen.getByRole("link", { name: /Network Inventory/ });
    expect(tile).toHaveAttribute("href", "/network-inventory");
    expect(tile).toHaveTextContent("network-inventory-planning");
  });

  it("lists an Inbound Receiving tile that links to the inbound-receiving remote", () => {
    server.use(
      http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
        HttpResponse.json({ taskType: "PICK", depth: 3 }),
      ),
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
    );
    render(
      <MemoryRouter>
        <ContextsScreen />
      </MemoryRouter>,
    );

    const tile = screen.getByRole("link", { name: /Inbound Receiving/ });
    expect(tile).toHaveAttribute("href", "/inbound-receiving");
    expect(tile).toHaveTextContent("inbound-receiving");
  });

  it("lists a Slotting Optimization tile that links to the slotting-optimization remote", () => {
    server.use(
      http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
        HttpResponse.json({ taskType: "PICK", depth: 3 }),
      ),
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
    );
    render(
      <MemoryRouter>
        <ContextsScreen />
      </MemoryRouter>,
    );

    const tile = screen.getByRole("link", { name: /Slotting Optimization/ });
    expect(tile).toHaveAttribute("href", "/slotting");
    expect(tile).toHaveTextContent("slotting-optimization");
  });

  it("lists a Pick-Face Replenishment tile that links to the pick-face-replenishment remote", () => {
    server.use(
      http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
        HttpResponse.json({ taskType: "PICK", depth: 3 }),
      ),
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
    );
    render(
      <MemoryRouter>
        <ContextsScreen />
      </MemoryRouter>,
    );

    const tile = screen.getByRole("link", { name: /Pick-Face Replenishment/ });
    expect(tile).toHaveAttribute("href", "/pick-face-replenishment");
    expect(tile).toHaveTextContent("pick-face-replenishment");
  });

  it("lists a Task Interleaving tile that links to the task-interleaving remote", () => {
    server.use(
      http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
        HttpResponse.json({ taskType: "PICK", depth: 3 }),
      ),
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
    );
    render(
      <MemoryRouter>
        <ContextsScreen />
      </MemoryRouter>,
    );

    const tile = screen.getByRole("link", { name: /Task Interleaving/ });
    expect(tile).toHaveAttribute("href", "/task-interleaving");
    expect(tile).toHaveTextContent("task-interleaving");
  });

  it("lists a Returns tile that links to the returns-processing remote", () => {
    server.use(
      http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
        HttpResponse.json({ taskType: "PICK", depth: 3 }),
      ),
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
    );
    render(
      <MemoryRouter>
        <ContextsScreen />
      </MemoryRouter>,
    );

    const tile = screen.getByRole("link", { name: /Returns/ });
    expect(tile).toHaveAttribute("href", "/returns-processing");
    expect(tile).toHaveTextContent("returns-processing");
  });

  it("lists a Problem Solve tile that links to the exception-management remote", () => {
    server.use(
      http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
        HttpResponse.json({ taskType: "PICK", depth: 3 }),
      ),
      http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
    );
    render(
      <MemoryRouter>
        <ContextsScreen />
      </MemoryRouter>,
    );

    const tile = screen.getByRole("link", { name: /Problem Solve/ });
    expect(tile).toHaveAttribute("href", "/exception-management");
    expect(tile).toHaveTextContent("exception-management");
  });
});
