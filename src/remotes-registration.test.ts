import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REPORT_ROUTES } from "./features/context-reports/registry";

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
    expect(app).toMatch(/"\/network-inventory",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/network-inventory"');
  });
});

describe("inbound_mfe registration", () => {
  // Pinned with IQVO/inbound-receiving web/vite.config.ts: federation name
  // inbound_mfe, gateway path /mfes/inbound-receiving/, dev port 5193.
  it("is a federation remote named inbound_mfe served from /mfes/inbound-receiving/ (dev :5193)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /inbound_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"inbound_mfe",\s*entry:\s*remoteEntry\("inbound-receiving",\s*5193\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"inbound_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*5193\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as inbound_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const InboundRemote = lazy\(\(\) => import\("inbound_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/inbound-receiving\/\*"/);
    expect(app).toMatch(/"\/inbound-receiving",\n  "\/slotting",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/inbound-receiving"');
  });
});

describe("slotting_mfe registration", () => {
  // Pinned with IQVO/slotting-optimization web/vite.config.ts: federation
  // name slotting_mfe, gateway path /mfes/slotting-optimization/, dev
  // port 5194 (next free on the ladder after inbound-receiving's 5193).
  it("is a federation remote named slotting_mfe served from /mfes/slotting-optimization/ (dev :5194)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /slotting_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"slotting_mfe",\s*entry:\s*remoteEntry\("slotting-optimization",\s*5194\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"slotting_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*5194\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as slotting_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const SlottingRemote = lazy\(\(\) => import\("slotting_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/slotting\/\*"/);
    expect(app).toMatch(/"\/slotting",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/slotting"');
  });
});

describe("replenishment_mfe registration", () => {
  // Pinned with IQVO/pick-face-replenishment web/vite.config.ts: federation name replenishment_mfe,
  // gateway path /mfes/pick-face-replenishment/, dev port 5196.
  it("is a federation remote named replenishment_mfe served from /mfes/pick-face-replenishment/ (dev :5196)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /replenishment_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"replenishment_mfe",\s*entry:\s*remoteEntry\("pick-face-replenishment",\s*5196\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"replenishment_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*5196\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as replenishment_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const ReplenishmentRemote = lazy\(\(\) => import\("replenishment_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/pick-face-replenishment\/\*"/);
    expect(app).toMatch(/"\/pick-face-replenishment",\n  "\/task-interleaving",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/pick-face-replenishment"');
  });
});

describe("task_interleaving_mfe registration", () => {
  // Pinned with IQVO/task-interleaving web/vite.config.ts: federation name task_interleaving_mfe,
  // gateway path /mfes/task-interleaving/, dev port 5197.
  it("is a federation remote named task_interleaving_mfe served from /mfes/task-interleaving/ (dev :5197)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /task_interleaving_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"task_interleaving_mfe",\s*entry:\s*remoteEntry\("task-interleaving",\s*5197\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"task_interleaving_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*5197\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as task_interleaving_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const TaskInterleavingRemote = lazy\(\(\) => import\("task_interleaving_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/task-interleaving\/\*"/);
    expect(app).toMatch(/"\/task-interleaving",\n  "\/returns-processing",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/task-interleaving"');
  });
});

describe("returns_mfe registration", () => {
  // Pinned with IQVO/returns-processing web/vite.config.ts: federation name
  // returns_mfe, gateway path /mfes/returns-processing/, dev port 4010
  // (off the fully-taken 51xx ladder, chosen by the remote's repo).
  it("is a federation remote named returns_mfe served from /mfes/returns-processing/ (dev :4010)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /returns_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"returns_mfe",\s*entry:\s*remoteEntry\("returns-processing",\s*4010\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"returns_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4010\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as returns_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const ReturnsRemote = lazy\(\(\) => import\("returns_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/returns-processing\/\*"/);
    expect(app).toMatch(/"\/returns-processing",\n  "\/exception-management",\n\];/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/returns-processing"');
  });
});

describe("exceptions_mfe registration", () => {
  // Pinned with IQVO/exception-management web/vite.config.ts: federation
  // name exceptions_mfe, gateway path /mfes/exception-management/, dev
  // port 4011 (off the 51xx ladder like returns_mfe's 4010).
  it("is a federation remote named exceptions_mfe served from /mfes/exception-management/ (dev :4011)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /exceptions_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"exceptions_mfe",\s*entry:\s*remoteEntry\("exception-management",\s*4011\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"exceptions_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4011\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as exceptions_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const ExceptionsRemote = lazy\(\(\) => import\("exceptions_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/exception-management\/\*"/);
    expect(app).toMatch(/"\/exception-management",\n\];/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/exception-management"');
  });
});

describe("remote registry totals", () => {
  // The fleet has eighteen remotes; a hand-edited list that drops or doubles
  // one breaks this before it breaks a route.
  it("registers eighteen remotes with unique keys, container names and ports", () => {
    const vite = read("vite.config.ts");
    const entries = [
      ...vite.matchAll(
        /(\w+_mfe):\s*\{\s*type:\s*"module",\s*name:\s*"([^"]+)",\s*entry:\s*remoteEntry\("([^"]+)",\s*(\d+)\)/g,
      ),
    ];
    expect(entries).toHaveLength(18);
    for (const col of [1, 2, 3, 4]) {
      const values = entries.map((m) => m[col]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("keeps REMOTE_PREFIXES in step with the remote routes in App.tsx", () => {
    const app = read("src/App.tsx");
    const prefixes = [
      ...app.match(/const REMOTE_PREFIXES = \[([^\]]*)\]/)![1].matchAll(/"(\/[^"]+)"/g),
    ].map((m) => m[1]);
    const routes = [...app.matchAll(/path="(\/[^"/]+)\/\*"/g)].map((m) => m[1]);
    expect(prefixes).toHaveLength(18);
    expect([...prefixes].sort()).toEqual([...routes].sort());
  });
});

describe("verify:routes coverage of the router", () => {
  // The list is hand-maintained, so pin the routes it used to miss.
  it("covers the network-fulfillment remote route", () => {
    expect(read("src/App.tsx")).toMatch(/path="\/network-fulfillment\/\*"/);
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/network-fulfillment"');
  });

  it("covers /reports/:context for every registered report slug, plus an unknown slug", () => {
    expect(read("src/App.tsx")).toMatch(/path="\/reports\/:context"/);
    const script = read("scripts/verify-all-routes.cjs");
    for (const { path } of REPORT_ROUTES) {
      expect(script).toContain(`path: "/reports/${path}"`);
    }
    expect(script).toMatch(/path: "\/reports\/no-such-context",[^}]*expect: \/Page not found\/i/);
  });
});
