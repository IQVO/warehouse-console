import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guards for the pieces of remote registration that no render test can
 * observe: the federation entry (vite.config.ts is evaluated by Vite, and the
 * MF plugin does not expose its options) and the verify:routes list, which is
 * not kept in sync with the router automatically.
 */
const read = (rel: string) => readFileSync(resolve(__dirname, "..", rel), "utf8");

describe("capacity_mfe registration", () => {
  it("is a federation remote named capacity_mfe, not planning_mfe", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /capacity_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"capacity_mfe",\s*entry:\s*remoteEntry\("warehouse-planning",\s*5190\),\s*\}/,
    );
    // wes-work-planning keeps its own container; the two must stay distinct.
    expect(vite).toMatch(/name:\s*"planning_mfe",\s*entry:\s*remoteEntry\("wes-work-planning", 5183\)/);
  });

  it("is imported lazily at module scope as capacity_mfe/App", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const CapacityRemote = lazy\(\(\) => import\("capacity_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/capacity\/\*"/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/capacity"');
  });
});

describe("productmaster_mfe registration", () => {
  // Pinned with IQVO/product-master web/vite.config.ts: federation name
  // productmaster_mfe, gateway path /mfes/product-master/, dev port 5191.
  it("is a federation remote named productmaster_mfe served from /mfes/product-master/ (dev :5191)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /productmaster_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"productmaster_mfe",\s*entry:\s*remoteEntry\("product-master",\s*5191\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"productmaster_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*5191\)/g)).toHaveLength(1);
  });

  it("is imported lazily at module scope as productmaster_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const ProductMasterRemote = lazy\(\(\) => import\("productmaster_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/product-master\/\*"/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/product-master"');
  });
});

describe("nip_mfe registration", () => {
  // Pinned with IQVO/network-inventory-planning web/vite.config.ts: federation
  // name nip_mfe, gateway path /mfes/network-inventory-planning/, dev port 5192.
  it("is a federation remote named nip_mfe served from /mfes/network-inventory-planning/ (dev :5192)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /nip_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"nip_mfe",\s*entry:\s*remoteEntry\("network-inventory-planning",\s*5192\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"nip_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*5192\)/g)).toHaveLength(1);
    // Every dev port in the host stays unique.
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as nip_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const NipRemote = lazy\(\(\) => import\("nip_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/network-inventory\/\*"/);
    expect(app).toMatch(/"\/network-inventory",\n\];/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/network-inventory"');
  });
});
