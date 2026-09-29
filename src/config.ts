/**
 * Endpoint configuration for warehouse-console.
 *
 * One console image has to serve more than one environment, so these are
 * resolved at RUNTIME from `window.__WAREHOUSE_CONFIG__.apiOrigin` (published
 * by runtime-config.ts from nginx's /config.json before the app mounts)
 * rather than baked in at build time. This closes the long-standing
 * "one image is only good for the environment it was built for" gap.
 *
 * In the kind cluster the fleet deliberately splits its two edges onto two
 * independent host entrypoints, and neither proxies to the other:
 *
 *   http://localhost        -> Nginx web gateway -> this shell + the remotes
 *   http://localhost:8000   -> Kong              -> every bounded context API
 *
 * So `apiOrigin` is a genuinely different origin from the page, and Kong
 * carries the matching CORS policy. Every context is addressed uniformly as
 * `<apiOrigin>/api/<context>`.
 *
 * In Vite development each service is still reached directly on its own port,
 * matching e2e-tests/env.sh's HTTP_PORT map.
 */
import type { WarehouseConfig } from "./runtime-config";

export interface ServiceBaseUrls {
  orderManagement: string;
  inventoryStorage: string;
  wesWorkPlanning: string;
  fulfillmentExecution: string;
  workforceManagement: string;
  facilityLayout: string;
}

/**
 * Every bounded context that ships a Bounded Context Report screen --
 * the 8 that already have one plus network-fulfillment, whose own
 * `/reports/...` endpoint is still in an open PR (see ReportsBaseUrls'
 * own doc comment below).
 */
export interface ReportsBaseUrls {
  orderManagement: string;
  inventoryStorage: string;
  wesWorkPlanning: string;
  fulfillmentExecution: string;
  workforceManagement: string;
  facilityLayout: string;
  laborPerformance: string;
  processPathManagement: string;
  networkFulfillment: string;
}

/** Kong's path prefix for each bounded context. */
const API_PATHS: Record<keyof ServiceBaseUrls, string> = {
  orderManagement: "/api/order-management",
  inventoryStorage: "/api/inventory-storage",
  wesWorkPlanning: "/api/wes-work-planning",
  fulfillmentExecution: "/api/fulfillment-execution",
  workforceManagement: "/api/workforce-management",
  facilityLayout: "/api/facility-layout",
};

/**
 * Kong's path prefix for every reports-capable context, including the
 * three that never got a plain ServiceBaseUrls entry (labor-performance,
 * process-path-management, network-fulfillment): the shell never calls
 * their OLTP APIs directly today, only their reports endpoint.
 *
 * IMPORTANT INFRA GAP (verified against warehouse-infra/terraform/services.tf
 * and kong.tf directly, not assumed): today Kong's `ingress`/`gatewayApi`
 * block for each context routes `/api/<context>` to that context's OLTP
 * Service ONLY. Each analytics-enabled chart's `reports-deployment.yaml`
 * stands up a SEPARATE `<context>-reports` Service that nothing in
 * warehouse-infra points a Kong route at yet -- it is reachable only
 * in-cluster (warehouse-ops-agent's console-bff and each context's own
 * mcp-deployment.yaml read it via its `.svc.cluster.local` DNS name, not
 * through Kong). So `${apiOrigin}/api/<context>/reports/...` below is
 * CORRECT SHAPE, wired ahead of the infra that will serve it: it 404s
 * against today's cluster until a follow-up infra PR adds a Kong
 * route/HTTPRoute rule for path `/api/<context>/reports` targeting the
 * `<context>-reports` Service (strip-path leaves exactly `/reports/...`,
 * which is what every reports binary registers). This is the same kind
 * of "wired ahead of its dependency" situation network-fulfillment's
 * report is in twice over -- once for its whole reports endpoint (still
 * an open PR) and once for this Kong route (not yet proposed anywhere).
 */
const REPORTS_API_PATHS: Record<keyof ReportsBaseUrls, string> = {
  orderManagement: "/api/order-management",
  inventoryStorage: "/api/inventory-storage",
  wesWorkPlanning: "/api/wes-work-planning",
  fulfillmentExecution: "/api/fulfillment-execution",
  workforceManagement: "/api/workforce-management",
  facilityLayout: "/api/facility-layout",
  laborPerformance: "/api/labor-performance",
  processPathManagement: "/api/process-path-management",
  networkFulfillment: "/api/network-fulfillment",
};

/** Standalone dev ports, mirroring e2e-tests/env.sh's HTTP_PORT map. */
const DEV_BASE_URLS: ServiceBaseUrls = {
  orderManagement: "http://localhost:8086",
  inventoryStorage: "http://localhost:8082",
  wesWorkPlanning: "http://localhost:8083",
  fulfillmentExecution: "http://localhost:8084",
  workforceManagement: "http://localhost:8085",
  facilityLayout: "http://localhost:8081",
};

/**
 * Standalone dev ports for each context's SEPARATE `<svc>-reports` reader
 * binary -- NOT the OLTP ports above (that process registers no
 * `/reports/*` route at all; see cmd/<svc>/main.go using NewRouter, never
 * NewReportsRouter). facilityLayout..laborPerformance mirror
 * e2e-tests/env.sh's *_REPORTS_HTTP_PORT map (8101-8107) exactly.
 *
 * processPathManagement (8108) and networkFulfillment (8109) continue
 * that file's own sequential-assignment convention (each new reports port
 * is simply the next free integer after 8107, not a computed offset --
 * see env.sh's own comment on LABOR_REPORTS_HTTP_PORT) but are NOT
 * actually present in e2e-tests/env.sh today: process-path-management's
 * reports binary has no harness-assigned dev port yet, and
 * network-fulfillment's whole reports endpoint is still an open PR with
 * no port assigned anywhere. Both are placeholders for local standalone
 * dev only, wired ahead of their real assignment so this screen activates
 * the moment each lands -- flagged explicitly in this repo's PR
 * description rather than silently guessed.
 */
const DEV_REPORTS_BASE_URLS: ReportsBaseUrls = {
  facilityLayout: "http://localhost:8101",
  inventoryStorage: "http://localhost:8102",
  wesWorkPlanning: "http://localhost:8103",
  fulfillmentExecution: "http://localhost:8104",
  workforceManagement: "http://localhost:8105",
  orderManagement: "http://localhost:8106",
  laborPerformance: "http://localhost:8107",
  processPathManagement: "http://localhost:8108",
  networkFulfillment: "http://localhost:8109",
};

const BFF_API_PATH = "/api/warehouse-ops-agent";
const DEV_BFF_BASE_URL = "http://localhost:8096";

const MISSING_ORIGIN = "window.__WAREHOUSE_CONFIG__.apiOrigin is required in production";

function apiOriginOf(
  runtimeConfig: Partial<WarehouseConfig>,
  isProduction: boolean,
): string | undefined {
  const apiOrigin = runtimeConfig.apiOrigin?.replace(/\/+$/, "");
  if (!apiOrigin) {
    // Falling back to a developer port in a real deployment would leave the
    // console silently talking to nothing, so refuse to start instead.
    if (isProduction) {
      throw new Error(MISSING_ORIGIN);
    }
    return undefined;
  }
  return apiOrigin;
}

export function resolveServiceBaseUrls(
  runtimeConfig: Partial<WarehouseConfig>,
  isProduction: boolean,
): ServiceBaseUrls {
  const apiOrigin = apiOriginOf(runtimeConfig, isProduction);
  if (apiOrigin === undefined) {
    return DEV_BASE_URLS;
  }
  // Built explicitly rather than via Object.fromEntries: that returns a
  // string-index signature which does not structurally satisfy ServiceBaseUrls,
  // so it would need an unsound double cast to compile.
  return {
    orderManagement: `${apiOrigin}${API_PATHS.orderManagement}`,
    inventoryStorage: `${apiOrigin}${API_PATHS.inventoryStorage}`,
    wesWorkPlanning: `${apiOrigin}${API_PATHS.wesWorkPlanning}`,
    fulfillmentExecution: `${apiOrigin}${API_PATHS.fulfillmentExecution}`,
    workforceManagement: `${apiOrigin}${API_PATHS.workforceManagement}`,
    facilityLayout: `${apiOrigin}${API_PATHS.facilityLayout}`,
  };
}

export function resolveBffBaseUrl(
  runtimeConfig: Partial<WarehouseConfig>,
  isProduction: boolean,
): string {
  const apiOrigin = apiOriginOf(runtimeConfig, isProduction);
  return apiOrigin === undefined ? DEV_BFF_BASE_URL : `${apiOrigin}${BFF_API_PATH}`;
}

/**
 * Base URL for each context's OWN `/reports/...` reader, read DIRECTLY --
 * never through console-bff/ops-agent. See REPORTS_API_PATHS' doc comment
 * for the Kong-routing gap this still needs on the infra side.
 */
export function resolveReportsBaseUrls(
  runtimeConfig: Partial<WarehouseConfig>,
  isProduction: boolean,
): ReportsBaseUrls {
  const apiOrigin = apiOriginOf(runtimeConfig, isProduction);
  if (apiOrigin === undefined) {
    return DEV_REPORTS_BASE_URLS;
  }
  return {
    orderManagement: `${apiOrigin}${REPORTS_API_PATHS.orderManagement}`,
    inventoryStorage: `${apiOrigin}${REPORTS_API_PATHS.inventoryStorage}`,
    wesWorkPlanning: `${apiOrigin}${REPORTS_API_PATHS.wesWorkPlanning}`,
    fulfillmentExecution: `${apiOrigin}${REPORTS_API_PATHS.fulfillmentExecution}`,
    workforceManagement: `${apiOrigin}${REPORTS_API_PATHS.workforceManagement}`,
    facilityLayout: `${apiOrigin}${REPORTS_API_PATHS.facilityLayout}`,
    laborPerformance: `${apiOrigin}${REPORTS_API_PATHS.laborPerformance}`,
    processPathManagement: `${apiOrigin}${REPORTS_API_PATHS.processPathManagement}`,
    networkFulfillment: `${apiOrigin}${REPORTS_API_PATHS.networkFulfillment}`,
  };
}

const runtimeConfig = window.__WAREHOUSE_CONFIG__ ?? {};

export const SERVICE_BASE_URL: ServiceBaseUrls = resolveServiceBaseUrls(
  runtimeConfig,
  import.meta.env.PROD,
);

/** Each of the 9 bounded contexts' OWN reports base URL, read directly by
 *  this shell's per-context Bounded Context Report screens (never through
 *  console-bff/ops-agent -- see ReportsBaseUrls' doc comment). */
export const REPORTS_BASE_URL: ReportsBaseUrls = resolveReportsBaseUrls(
  runtimeConfig,
  import.meta.env.PROD,
);

/** The BFF lives inside warehouse-ops-agent itself (new routes on its
 *  existing HTTP server, reusing the 5 already-built MCP client ports)
 *  rather than as a separate process -- see the "single BFF" decision in
 *  the MFE architecture proposal. */
export const BFF_BASE_URL: string = resolveBffBaseUrl(runtimeConfig, import.meta.env.PROD);

/** The two analytical report endpoints backing the WMS and WES dashboards.
 *  Both answer the same envelope shape (see features/reports/types.ts) and
 *  both take optional `?from=&to=` (default: trailing 24h). These are
 *  eventually-consistent projections, not live reads -- every section
 *  carries its own freshness lag, which the dashboards surface rather than
 *  hide. */
export const CONSOLE_REPORTS_URL = {
  wms: `${BFF_BASE_URL}/console/reports/wms`,
  wes: `${BFF_BASE_URL}/console/reports/wes`,
} as const;
