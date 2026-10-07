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
