/**
 * The route list behind `npm run verify:routes`, as a data module so
 * scripts/verify-all-routes.test.cjs can assert its coverage without
 * launching a browser.
 *
 * The remote entries are GENERATED from src/remotes-manifest.json -- the
 * same single source of truth that vite.config.ts (federation remotes) and
 * src/App.tsx (routes, nav prefixes) derive from -- so adding a remote
 * there adds its smoke check here automatically.
 *
 * Shell-owned screens (/, /contexts, dashboards) and the /reports/<slug>
 * checks stay hand-written: they belong to the shell and to the report
 * registry (src/features/context-reports/registry.ts), not to remote
 * registration. src/remotes-manifest.test.tsx pins that every registered
 * report slug stays covered here.
 */
const manifest = require("../src/remotes-manifest.json");

const REMOTE_ROUTES = manifest.map((remote) => ({
  path: remote.route,
  label: remote.route.slice(1),
  expect: /\S/,
}));

const routes = [
  { path: "/", label: "floor", expect: /Floor/i },
  { path: "/order-lifecycle", label: "order-lifecycle", expect: /Order Lifecycle/i },
  { path: "/contexts", label: "contexts", expect: /Bounded contexts/i },
  // These two shipped with the dashboards but were never added here.
  { path: "/wms-dashboard", label: "wms-dashboard", expect: /WMS Dashboard/i },
  { path: "/wes-dashboard", label: "wes-dashboard", expect: /WES Dashboard/i },
  ...REMOTE_ROUTES,
  // Deep link under a remote's splat route: product-master's packaging
  // screen (web/, products/:sku/packaging). The bare /product-master entry
  // above is generated from the manifest; this deeper URL is not.
  { path: "/product-master/products/SKU-1/packaging", label: "product-master-packaging", expect: /\S/ },
  // /reports/:context -- one Bounded Context Report screen per slug in
  // src/features/context-reports/registry.ts. Each must render its own
  // heading whether the reports reader answers or the error card shows.
  { path: "/reports/order-management", label: "report:order-management", expect: /Orders: Funnel/i },
  { path: "/reports/inventory-storage", label: "report:inventory-storage", expect: /Inventory: Flow/i },
  { path: "/reports/wes-work-planning", label: "report:wes-work-planning", expect: /Planning: Release/i },
  { path: "/reports/fulfillment-execution", label: "report:fulfillment-execution", expect: /Fulfillment: Throughput/i },
  { path: "/reports/workforce-management", label: "report:workforce-management", expect: /Workforce: Labor/i },
  { path: "/reports/facility-layout", label: "report:facility-layout", expect: /Facility: Catalog Growth/i },
  { path: "/reports/process-path-management", label: "report:process-path-management", expect: /Process Paths: Catalogue/i },
  { path: "/reports/labor-performance", label: "report:labor-performance", expect: /Labor: Performance/i },
  { path: "/reports/network-fulfillment", label: "report:network-fulfillment", expect: /Network Fulfillment: Acknowledgement/i },
  { path: "/reports/warehouse-planning", label: "report:warehouse-planning", expect: /Capacity Planning: Shortage/i },
  { path: "/reports/network-inventory-planning", label: "report:network-inventory-planning", expect: /Network Inventory: Stuck/i },
  { path: "/reports/product-master", label: "report:product-master", expect: /Product Master: Data Quality/i },
  { path: "/reports/inbound-receiving", label: "report:inbound-receiving", expect: /Inbound: Receiving/i },
  { path: "/reports/slotting-optimization", label: "report:slotting-optimization", expect: /Slotting: Slot Plan Funnel/i },
  { path: "/reports/warehouse-planning-bottleneck-frequency", label: "report:warehouse-planning-bottleneck-frequency", expect: /Capacity Planning: Bottleneck Frequency/i },
  { path: "/reports/warehouse-planning-plan-throughput", label: "report:warehouse-planning-plan-throughput", expect: /Capacity Planning: Plan Throughput/i },
  { path: "/reports/network-inventory-planning-transfer-funnel", label: "report:network-inventory-planning-transfer-funnel", expect: /Network Inventory: Transfer Funnel/i },
  { path: "/reports/network-inventory-planning-state-dwell", label: "report:network-inventory-planning-state-dwell", expect: /Network Inventory: State Dwell/i },
  { path: "/reports/network-inventory-planning-rebalance-runs", label: "report:network-inventory-planning-rebalance-runs", expect: /Network Inventory: Rebalance Runs/i },
  { path: "/reports/pick-face-replenishment", label: "report:pick-face-replenishment", expect: /Pick-Face Replenishment: Funnel/i },
  { path: "/reports/task-interleaving", label: "report:task-interleaving", expect: /Task Interleaving: Hint Adoption/i },
  // An unknown report slug falls through to the shell's own 404 screen.
  { path: "/reports/no-such-context", label: "report:404", expect: /Page not found/i },
  // An unmatched URL must explain itself, not render empty chrome.
  { path: "/no-such-screen", label: "404", expect: /Page not found/i },
];

module.exports = { routes };
