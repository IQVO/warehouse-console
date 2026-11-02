import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./test/mocks/server";
import { SERVICE_BASE_URL } from "./config";
import { App } from "./App";
import { REPORT_ROUTES } from "./features/context-reports/registry";
import { REMOTES, REMOTE_ROUTE_PREFIXES, federationRemotes } from "./remotes-manifest";
import { REMOTE_COMPONENTS } from "./shell/remoteComponents";

/**
 * Guards for the remotes manifest -- the single source of truth
 * src/remotes-manifest.json that vite.config.ts (federation remotes),
 * src/App.tsx (routes + nav prefixes) and scripts/verify-routes-list.cjs
 * (verify:routes entries) all derive from.
 *
 * These replace src/remotes-registration.test.ts, which asserted the OLD
 * duplication by regex-scraping those three files' source text. The
 * manifest removes the duplication, so the guards now check the actual
 * runtime data: manifest invariants, the generated federation map, the
 * one hand-maintained sibling (the static lazy() imports), and that every
 * manifest route really renders through RemoteBoundary.
 */

/** The fleet's current remote count; catch an accidental drop or double. */
const EXPECTED_REMOTE_COUNT = 29;

describe("remotes manifest invariants", () => {
  it(`registers ${EXPECTED_REMOTE_COUNT} remotes`, () => {
    expect(REMOTES).toHaveLength(EXPECTED_REMOTE_COUNT);
  });

  it("has unique names, container names, gateway paths, dev ports and routes", () => {
    for (const key of ["name", "path", "port", "route"] as const) {
      const values = REMOTES.map((remote) => String(remote[key]));
      expect(new Set(values).size).toBe(values.length);
    }
    const containers = REMOTES.map((remote) => remote.container ?? remote.name);
    expect(new Set(containers).size).toBe(containers.length);
  });

  it("uses well-formed routes and positive ports", () => {
    for (const remote of REMOTES) {
      expect(remote.route).toMatch(/^\/[a-z0-9-]+$/);
      expect(remote.port).toBeGreaterThan(0);
      expect(remote.label.length).toBeGreaterThan(0);
    }
  });

  it("keeps the two planning remotes distinct", () => {
    const capacity = REMOTES.find((remote) => remote.name === "capacity_mfe");
    const planning = REMOTES.find((remote) => remote.name === "planning_mfe");
    expect(capacity).toMatchObject({ path: "warehouse-planning", port: 5190, route: "/capacity" });
    expect(planning).toMatchObject({ path: "wes-work-planning", port: 5183, route: "/planning" });
  });

  it("network-fulfillment registers its own container name netfulfil_mfe", () => {
    const nf = REMOTES.find((remote) => remote.name === "network_fulfillment_mfe");
    expect(nf).toMatchObject({ container: "netfulfil_mfe", path: "network-fulfillment", port: 5188 });
  });
});

describe("federationRemotes() (vite.config.ts consumes this)", () => {
  it("dev entries address each remote's own dev server by port", () => {
    const remotes = federationRemotes(false);
    expect(Object.keys(remotes).sort()).toEqual([...REMOTES.map((r) => r.name)].sort());
    for (const remote of REMOTES) {
      expect(remotes[remote.name]).toEqual({
        type: "module",
        name: remote.container ?? remote.name,
        entry: `http://localhost:${remote.port}/remoteEntry.js`,
      });
    }
  });

  it("build entries address each remote's web-gateway path", () => {
    const remotes = federationRemotes(true);
    for (const remote of REMOTES) {
      expect(remotes[remote.name].entry).toBe(`/mfes/${remote.path}/remoteEntry.js`);
    }
  });
});

describe("REMOTE_COMPONENTS parity (the static lazy() imports)", () => {
  it("has exactly one component per manifest remote, no strays", () => {
    const manifestNames = REMOTES.map((remote) => remote.name).sort();
    const componentNames = Object.keys(REMOTE_COMPONENTS).sort();
    expect(componentNames).toEqual(manifestNames);
  });
});

describe("every manifest route renders through RemoteBoundary", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it.each(REMOTES.map((remote) => [remote.route, remote.label] as const))(
    "%s is a shell route that falls back to the unavailable card when the remote is down",
    async (route, label) => {
      server.use(
        http.get(`${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`, () =>
          HttpResponse.json({ taskType: "PICK", depth: 0 }),
        ),
        http.get(`${SERVICE_BASE_URL.facilityLayout}/sites`, () => HttpResponse.json([])),
      );
      window.history.pushState({}, "", route);
      render(<App />);

      expect(await screen.findByText(/This module is unavailable right now/)).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
    },
  );

  it("REMOTE_ROUTE_PREFIXES mirrors the manifest routes", () => {
    expect([...REMOTE_ROUTE_PREFIXES]).toEqual(REMOTES.map((remote) => remote.route));
  });
});

describe("verify:routes coverage of the report registry", () => {
  // The /reports/<slug> entries in scripts/verify-routes-list.cjs are the
  // one list still hand-synced (a plain-Node script cannot import the TS
  // registry), so this guard keeps it honest. Remote-route coverage is
  // asserted by scripts/verify-all-routes.test.cjs against the manifest.
  const script = readFileSync(
    resolve(__dirname, "..", "scripts", "verify-routes-list.cjs"),
    "utf8",
  );

  it("covers every registered report slug plus an unknown slug", () => {
    for (const { path } of REPORT_ROUTES) {
      expect(script).toContain(`path: "/reports/${path}"`);
    }
    expect(script).toContain('path: "/reports/no-such-context"');
  });
});
