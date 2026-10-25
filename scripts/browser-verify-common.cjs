"use strict";

const REMOTES = [
  {
    context: "order-management",
    route: "/order-management",
    label: "order-management",
    expectedText: /Order management/i,
  },
  {
    context: "inventory-storage",
    route: "/inventory",
    label: "inventory-storage",
    expectedText: /Inventory/i,
  },
  {
    context: "wes-work-planning",
    route: "/planning",
    label: "wes-work-planning",
    expectedText: /Planning/i,
  },
  {
    context: "fulfillment-execution",
    route: "/fulfillment",
    label: "fulfillment-execution",
    expectedText: /Fulfillment/i,
  },
  {
    context: "workforce-management",
    route: "/workforce",
    label: "workforce-management",
    expectedText: /Workforce/i,
  },
  {
    context: "facility-layout",
    route: "/facility",
    label: "facility-layout",
    expectedText: /Facility/i,
  },
  {
    context: "process-path-management",
    route: "/process-path",
    label: "process-path-management",
    expectedText: /Process paths/i,
  },
  {
    context: "labor-performance",
    route: "/labor",
    label: "labor-performance",
    expectedText: /Labor performance/i,
  },
].map((remote) => ({
  ...remote,
  kind: "remote",
  entryPath: `/mfes/${remote.context}/remoteEntry.js`,
}));

const SHELL_ROUTES = [
  { path: "/", label: "floor", kind: "shell", expectedText: /Floor/i },
  {
    path: "/order-lifecycle",
    label: "order-lifecycle",
    kind: "shell",
    expectedText: /Order Lifecycle/i,
  },
  {
    path: "/contexts",
    label: "contexts",
    kind: "shell",
    expectedText: /Bounded contexts/i,
  },
  {
    path: "/wms-dashboard",
    label: "wms-dashboard",
    kind: "dashboard",
    expectedText: /WMS Dashboard/i,
  },
  {
    path: "/wes-dashboard",
    label: "wes-dashboard",
    kind: "dashboard",
    expectedText: /WES Dashboard/i,
  },
];

const CLUSTER_ROUTES = [
  ...SHELL_ROUTES,
  ...REMOTES.map(({ route, ...remote }) => ({ path: route, ...remote })),
];

const REPORT_SECTIONS = {
  wms: [
    { id: "order-funnel", sourceContext: "order-management", chartKind: "funnel" },
    {
      id: "inventory-flow-accuracy",
      sourceContext: "inventory-storage",
      chartKind: "bar",
    },
    { id: "catalog-growth", sourceContext: "facility-layout", chartKind: "line" },
  ],
  wes: [
    { id: "planning-throughput", sourceContext: "wes-work-planning", chartKind: "line" },
    {
      id: "fulfillment-throughput",
      sourceContext: "fulfillment-execution",
      chartKind: "bar",
    },
    { id: "labor-management", sourceContext: "workforce-management", chartKind: "bar" },
    { id: "labor-performance", sourceContext: "labor-performance", chartKind: "bar" },
  ],
};

function normalizeOrigin(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error(`${name} must be an absolute http(s) URL: ${error.message}`);
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${name} must be an origin without a path, query, or fragment`);
  }
  return parsed.origin;
}

function runtimeConfig(env = process.env) {
  return {
    baseUrl: normalizeOrigin(env.BASE_URL || "http://localhost:5173", "BASE_URL"),
    apiOrigin: normalizeOrigin(env.API_ORIGIN || "http://localhost:8000", "API_ORIGIN"),
  };
}

function urlAt(baseUrl, path) {
  return new URL(path, `${normalizeOrigin(baseUrl, "base URL")}/`).href;
}

function isDocumentRequest(request) {
  return request.resourceType() === "document";
}

function requestPolicyViolation(rawUrl, { baseUrl, apiOrigin }, resourceType = "") {
  let requested;
  try {
    requested = new URL(rawUrl);
  } catch {
    return `request URL is not valid: ${rawUrl}`;
  }

  if (!["http:", "https:"].includes(requested.protocol)) return null;

  const webOrigin = normalizeOrigin(baseUrl, "BASE_URL");
  const kongOrigin = normalizeOrigin(apiOrigin, "API_ORIGIN");
  const port = requested.port || (requested.protocol === "https:" ? "443" : "80");

  if (requested.hostname.endsWith(".svc") || requested.hostname.includes(".svc.")) {
    return `request used Kubernetes service DNS: ${rawUrl}`;
  }
  if (port === "5173" || /^518\d$/.test(port) || /^808\d$/.test(port) || /^809\d$/.test(port)) {
    return `request used forbidden development or service port ${port}: ${rawUrl}`;
  }
  if (requested.pathname.startsWith("/api/") && requested.origin !== kongOrigin) {
    return `API request did not use ${kongOrigin}: ${rawUrl}`;
  }
  if (["fetch", "xhr"].includes(resourceType)) {
    if (requested.pathname === "/config.json" && requested.origin !== webOrigin) {
      return `runtime config did not use ${webOrigin}: ${rawUrl}`;
    }
    if (requested.pathname !== "/config.json" && requested.origin !== kongOrigin) {
      return `fetch/XHR request did not use ${kongOrigin}: ${rawUrl}`;
    }
  }
  if (
    requested.origin === kongOrigin &&
    (requested.pathname.startsWith("/mfes/") ||
      /\.(?:html?|m?js|css|map|woff2?|ttf|png|jpe?g|gif|svg|ico)$/i.test(requested.pathname))
  ) {
    return `asset request reached the API origin: ${rawUrl}`;
  }
  if (requested.origin !== webOrigin && requested.origin !== kongOrigin) {
    return `request used unapproved origin ${requested.origin}: ${rawUrl}`;
  }
  return null;
}

function isFederationAsset(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  return (
    parsed.pathname.endsWith("/remoteEntry.js") ||
    /\/mfes\/[^/]+\/assets\/.*\.m?js$/i.test(parsed.pathname)
  );
}

function federationAssetViolation(rawUrl, status, contentType) {
  if (!isFederationAsset(rawUrl) || status === 304) return null;
  if (!contentType) return `federation asset had no Content-Type: ${rawUrl}`;
  if (!/javascript|ecmascript/i.test(contentType)) {
    return `federation asset was not JavaScript: ${rawUrl}`;
  }
  return null;
}

function consoleErrorApproved(
  text,
  { degradedEntryUrl, expectedEntryFailure, outageArmed },
) {
  if (!degradedEntryUrl) return false;
  if (text.includes(degradedEntryUrl)) return true;
  if (outageArmed && /^Failed to load resource: net::ERR_CONNECTION_REFUSED$/i.test(text)) {
    return true;
  }
  return (
    expectedEntryFailure === true &&
    /error occurred in (?:one of )?your React components|error boundary/i.test(text)
  );
}

function validateReport(kind, payload, maxFreshnessSeconds) {
  const expected = REPORT_SECTIONS[kind];
  if (!expected) throw new Error(`unknown dashboard kind: ${kind}`);
  if (!Number.isFinite(maxFreshnessSeconds) || maxFreshnessSeconds < 0) {
    throw new Error("max report freshness must be a non-negative number");
  }
  if (!payload || !Array.isArray(payload.sections)) {
    throw new Error(`${kind.toUpperCase()} report did not return a sections array`);
  }
  if (payload.sections.length !== expected.length) {
    const actualIds = new Set(payload.sections.map((section) => section?.id));
    const missing = expected.find(({ id }) => !actualIds.has(id));
    if (missing) throw new Error(`${kind.toUpperCase()} report is missing section ${missing.id}`);
    throw new Error(
      `${kind.toUpperCase()} report returned ${payload.sections.length} sections; expected exactly ${expected.length}`,
    );
  }

  const sectionsById = new Map(payload.sections.map((section) => [section?.id, section]));
  for (const spec of expected) {
    const section = sectionsById.get(spec.id);
    if (!section) throw new Error(`${kind.toUpperCase()} report is missing section ${spec.id}`);
    if (section.sourceContext !== spec.sourceContext) {
      throw new Error(
        `${kind.toUpperCase()} section ${spec.id} expected owner ${spec.sourceContext}, got ${section.sourceContext || "<missing>"}`,
      );
    }
    if (section.chartKind !== spec.chartKind) {
      throw new Error(
        `${kind.toUpperCase()} section ${spec.id} expected chart ${spec.chartKind}, got ${section.chartKind || "<missing>"}`,
      );
    }
    if (section.available !== true) {
      throw new Error(
        `${kind.toUpperCase()} section ${spec.id} is degraded: ${section.error || "unavailable"}`,
      );
    }
    if (!Array.isArray(section.series) || section.series.length === 0) {
      throw new Error(`${kind.toUpperCase()} section ${spec.id} has no real series data`);
    }
    if (
      section.series.some(
        (point) =>
          !point || typeof point.label !== "string" || !Number.isFinite(point.value),
      )
    ) {
      throw new Error(`${kind.toUpperCase()} section ${spec.id} has invalid series data`);
    }
    if (!section.series.some(({ value }) => value !== 0)) {
      throw new Error(`${kind.toUpperCase()} section ${spec.id} has no non-zero series data`);
    }
    if (!Number.isFinite(section.freshnessLagSeconds) || section.freshnessLagSeconds < 0) {
      throw new Error(`${kind.toUpperCase()} section ${spec.id} has no bounded freshness`);
    }
    if (section.freshnessLagSeconds > maxFreshnessSeconds) {
      throw new Error(
        `${kind.toUpperCase()} section ${spec.id} freshness lag ${section.freshnessLagSeconds}s exceeds ${maxFreshnessSeconds}s`,
      );
    }
  }
  return payload.sections;
}

module.exports = {
  CLUSTER_ROUTES,
  REMOTES,
  REPORT_SECTIONS,
  SHELL_ROUTES,
  consoleErrorApproved,
  federationAssetViolation,
  isDocumentRequest,
  requestPolicyViolation,
  runtimeConfig,
  urlAt,
  validateReport,
};
