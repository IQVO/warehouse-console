import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { SERVICE_BASE_URL } from "../../config";
import { ContextsScreen } from "./ContextsScreen";

describe("ContextsScreen launchpad", () => {
  it("lists a Capacity Planning tile that links to the warehouse-planning remote", () => {
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
});
