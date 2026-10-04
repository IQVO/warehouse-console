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
