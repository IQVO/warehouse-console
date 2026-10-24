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
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/product-master/products/SKU-1/packaging"');
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
    expect(app).toMatch(/"\/returns-processing",\n  "\/exception-management",\n/);
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
    expect(app).toMatch(/"\/exception-management",\n  "\/customer-ordering",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/exception-management"');
  });
});

describe("customer_ordering_mfe registration", () => {
  // Pinned with IQVO/customer-ordering web/vite.config.ts: federation name
  // customer_ordering_mfe, gateway path /mfes/customer-ordering/, dev port 4012
  // (off the fully-taken 51xx ladder, 40xx series).
  it("is a federation remote named customer_ordering_mfe served from /mfes/customer-ordering/ (dev :4012)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /customer_ordering_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"customer_ordering_mfe",\s*entry:\s*remoteEntry\("customer-ordering",\s*4012\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"customer_ordering_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4012\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as customer_ordering_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const CustomerOrderingRemote = lazy\(\(\) => import\("customer_ordering_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/customer-ordering\/\*"/);
    expect(app).toMatch(/"\/customer-ordering",\n  "\/delivery-promise",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/customer-ordering"');
  });
});

describe("delivery_promise_mfe registration", () => {
  // Pinned with IQVO/delivery-promise web/vite.config.ts: federation name
  // delivery_promise_mfe, gateway path /mfes/delivery-promise/, dev port 4013
  // (off the fully-taken 51xx ladder, 40xx series).
  it("is a federation remote named delivery_promise_mfe served from /mfes/delivery-promise/ (dev :4013)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /delivery_promise_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"delivery_promise_mfe",\s*entry:\s*remoteEntry\("delivery-promise",\s*4013\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"delivery_promise_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4013\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as delivery_promise_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const DeliveryPromiseRemote = lazy\(\(\) => import\("delivery_promise_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/delivery-promise\/\*"/);
    expect(app).toMatch(/"\/delivery-promise",\n  "\/last-mile-delivery",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/delivery-promise"');
  });
});

describe("last_mile_mfe registration", () => {
  // Pinned with IQVO/last-mile-delivery web/vite.config.ts: federation name
  // last_mile_mfe, gateway path /mfes/last-mile-delivery/, dev port 4014
  // (off the fully-taken 51xx ladder, 40xx series).
  it("is a federation remote named last_mile_mfe served from /mfes/last-mile-delivery/ (dev :4014)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /last_mile_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"last_mile_mfe",\s*entry:\s*remoteEntry\("last-mile-delivery",\s*4014\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"last_mile_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4014\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as last_mile_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const LastMileRemote = lazy\(\(\) => import\("last_mile_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/last-mile-delivery\/\*"/);
    expect(app).toMatch(/"\/last-mile-delivery",\n  "\/linehaul-transportation",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/last-mile-delivery"');
  });
});

describe("linehaul_mfe registration", () => {
  // Pinned with IQVO/linehaul-transportation web/vite.config.ts: federation name
  // linehaul_mfe, gateway path /mfes/linehaul-transportation/, dev port 4015
  // (off the fully-taken 51xx ladder, 40xx series).
  it("is a federation remote named linehaul_mfe served from /mfes/linehaul-transportation/ (dev :4015)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /linehaul_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"linehaul_mfe",\s*entry:\s*remoteEntry\("linehaul-transportation",\s*4015\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"linehaul_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4015\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as linehaul_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const LinehaulRemote = lazy\(\(\) => import\("linehaul_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/linehaul-transportation\/\*"/);
    expect(app).toMatch(/"\/linehaul-transportation",\n  "\/node-performance",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/linehaul-transportation"');
  });
});

describe("node_performance_mfe registration", () => {
  // Pinned with IQVO/node-performance web/vite.config.ts: federation name
  // node_performance_mfe, gateway path /mfes/node-performance/, dev port 4016
  // (off the fully-taken 51xx ladder, 40xx series).
  it("is a federation remote named node_performance_mfe served from /mfes/node-performance/ (dev :4016)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /node_performance_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"node_performance_mfe",\s*entry:\s*remoteEntry\("node-performance",\s*4016\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"node_performance_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4016\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as node_performance_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const NodePerformanceRemote = lazy\(\(\) => import\("node_performance_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/node-performance\/\*"/);
    expect(app).toMatch(/"\/node-performance",\n  "\/node-topology",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/node-performance"');
  });
});

describe("node_topology_mfe registration", () => {
  // Pinned with IQVO/node-topology web/vite.config.ts: federation name
  // node_topology_mfe, gateway path /mfes/node-topology/, dev port 4017
  // (off the fully-taken 51xx ladder, 40xx series).
  it("is a federation remote named node_topology_mfe served from /mfes/node-topology/ (dev :4017)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /node_topology_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"node_topology_mfe",\s*entry:\s*remoteEntry\("node-topology",\s*4017\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"node_topology_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4017\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as node_topology_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const NodeTopologyRemote = lazy\(\(\) => import\("node_topology_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/node-topology\/\*"/);
    expect(app).toMatch(/"\/node-topology",\n  "\/offer-availability",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/node-topology"');
  });
});

describe("offer_availability_mfe registration", () => {
  // Pinned with IQVO/offer-availability web/vite.config.ts: federation name
  // offer_availability_mfe, gateway path /mfes/offer-availability/, dev port 4018
  // (off the fully-taken 51xx ladder, 40xx series).
  it("is a federation remote named offer_availability_mfe served from /mfes/offer-availability/ (dev :4018)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /offer_availability_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"offer_availability_mfe",\s*entry:\s*remoteEntry\("offer-availability",\s*4018\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"offer_availability_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4018\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as offer_availability_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const OfferAvailabilityRemote = lazy\(\(\) => import\("offer_availability_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/offer-availability\/\*"/);
    expect(app).toMatch(/"\/offer-availability",\n  "\/order-sourcing",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/offer-availability"');
  });
});

describe("order_sourcing_mfe registration", () => {
  // Pinned with IQVO/order-sourcing web/vite.config.ts: federation name
  // order_sourcing_mfe, gateway path /mfes/order-sourcing/, dev port 4019
  // (off the fully-taken 51xx ladder, 40xx series).
  it("is a federation remote named order_sourcing_mfe served from /mfes/order-sourcing/ (dev :4019)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /order_sourcing_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"order_sourcing_mfe",\s*entry:\s*remoteEntry\("order-sourcing",\s*4019\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"order_sourcing_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4019\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as order_sourcing_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const OrderSourcingRemote = lazy\(\(\) => import\("order_sourcing_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/order-sourcing\/\*"/);
    expect(app).toMatch(/"\/order-sourcing",\n  "\/shipping-and-tracking",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/order-sourcing"');
  });
});

describe("shipping_mfe registration", () => {
  // Pinned with IQVO/shipping-and-tracking web/vite.config.ts: federation name
  // shipping_mfe, gateway path /mfes/shipping-and-tracking/, dev port 4020
  // (off the fully-taken 51xx ladder, 40xx series).
  it("is a federation remote named shipping_mfe served from /mfes/shipping-and-tracking/ (dev :4020)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /shipping_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"shipping_mfe",\s*entry:\s*remoteEntry\("shipping-and-tracking",\s*4020\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"shipping_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4020\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as shipping_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const ShippingRemote = lazy\(\(\) => import\("shipping_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/shipping-and-tracking\/\*"/);
    expect(app).toMatch(/"\/shipping-and-tracking",\n  "\/vendor-connectivity",\n/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/shipping-and-tracking"');
  });
});

describe("vendor_connectivity_mfe registration", () => {
  // Pinned with IQVO/vendor-connectivity web/vite.config.ts: federation name
  // vendor_connectivity_mfe, gateway path /mfes/vendor-connectivity/, dev port 4021
  // (off the fully-taken 51xx ladder, 40xx series).
  it("is a federation remote named vendor_connectivity_mfe served from /mfes/vendor-connectivity/ (dev :4021)", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(
      /vendor_connectivity_mfe:\s*\{\s*type:\s*"module",\s*name:\s*"vendor_connectivity_mfe",\s*entry:\s*remoteEntry\("vendor-connectivity",\s*4021\),\s*\}/,
    );
  });

  it("does not reuse another remote's container name or dev port", () => {
    const vite = read("vite.config.ts");
    expect(vite.match(/name:\s*"vendor_connectivity_mfe"/g)).toHaveLength(1);
    expect(vite.match(/remoteEntry\("[^"]+",\s*4021\)/g)).toHaveLength(1);
    const ports = [...vite.matchAll(/remoteEntry\("[^"]+",\s*(\d+)\)/g)].map((m) => m[1]);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("is imported lazily at module scope as vendor_connectivity_mfe/App and mounted on a splat route", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/^const VendorConnectivityRemote = lazy\(\(\) => import\("vendor_connectivity_mfe\/App"\)\);$/m);
    expect(app).toMatch(/path="\/vendor-connectivity\/\*"/);
    expect(app).toMatch(/"\/vendor-connectivity",\n\];/);
  });

  it("is covered by verify:routes", () => {
    expect(read("scripts/verify-all-routes.cjs")).toContain('path: "/vendor-connectivity"');
  });
});

describe("remote registry totals", () => {
  // The fleet has twenty-eight remotes; a hand-edited list that drops or doubles
  // one breaks this before it breaks a route.
  it("registers twenty-eight remotes with unique keys, container names and ports", () => {
    const vite = read("vite.config.ts");
    const entries = [
      ...vite.matchAll(
        /(\w+_mfe):\s*\{\s*type:\s*"module",\s*name:\s*"([^"]+)",\s*entry:\s*remoteEntry\("([^"]+)",\s*(\d+)\)/g,
      ),
    ];
    expect(entries).toHaveLength(28);
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
    expect(prefixes).toHaveLength(28);
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
