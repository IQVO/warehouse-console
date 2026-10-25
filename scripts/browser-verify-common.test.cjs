const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CLUSTER_ROUTES,
  REMOTES,
  consoleErrorApproved,
  federationAssetViolation,
  isDocumentRequest,
  requestPolicyViolation,
  runtimeConfig,
  urlAt,
  validateReport,
} = require("./browser-verify-common.cjs");

test("runtime config preserves the existing dev defaults", () => {
  assert.deepEqual(runtimeConfig({}), {
    baseUrl: "http://localhost:5173",
    apiOrigin: "http://localhost:8000",
  });
});

test("runtime config accepts production edge origins and removes trailing slashes", () => {
  assert.deepEqual(
    runtimeConfig({
      BASE_URL: "http://localhost/",
      API_ORIGIN: "http://localhost:8000/",
    }),
    {
      baseUrl: "http://localhost",
      apiOrigin: "http://localhost:8000",
    },
  );
  assert.equal(urlAt("http://localhost/", "/contexts"), "http://localhost/contexts");
});

test("the cluster manifest names all eight remotes with context-specific content", () => {
  assert.equal(REMOTES.length, 8);
  assert.equal(new Set(REMOTES.map(({ context }) => context)).size, 8);
  assert.equal(new Set(REMOTES.map(({ route }) => route)).size, 8);
  for (const remote of REMOTES) {
    assert.match(remote.entryPath, new RegExp(`^/mfes/${remote.context}/remoteEntry\\.js$`));
    assert.ok(remote.expectedText instanceof RegExp);
    assert.notEqual(remote.expectedText.source, "\\S");
  }
  assert.equal(
    CLUSTER_ROUTES.filter(({ kind }) => kind === "remote").length,
    8,
  );
});

test("the request policy keeps assets on web and APIs on the configured API edge", () => {
  const policy = {
    baseUrl: "http://localhost",
    apiOrigin: "http://localhost:8000",
  };

  assert.equal(requestPolicyViolation("http://localhost/assets/app.js", policy), null);
  assert.equal(
    requestPolicyViolation(
      "http://localhost/mfes/order-management/remoteEntry.js",
      policy,
    ),
    null,
  );
  assert.equal(
    requestPolicyViolation("http://localhost:8000/api/order-management/orders", policy),
    null,
  );
  assert.match(
    requestPolicyViolation("http://localhost/api/order-management/orders", policy),
    /API request did not use/,
  );
  assert.match(
    requestPolicyViolation("http://localhost:5181/remoteEntry.js", policy),
    /forbidden development or service port/,
  );
  assert.match(
    requestPolicyViolation("http://localhost:8084/orders", policy),
    /forbidden development or service port/,
  );
  assert.match(
    requestPolicyViolation("http://warehouse-ops-agent.warehouse-systems.svc/daily-brief", policy),
    /Kubernetes service DNS/,
  );
  assert.match(
    requestPolicyViolation("http://localhost:8000/mfes/order-management/remoteEntry.js", policy),
    /asset request reached the API origin/,
  );
  assert.equal(
    requestPolicyViolation("http://localhost/config.json", policy, "fetch"),
    null,
  );
  assert.match(
    requestPolicyViolation("http://localhost/console/reports/wms", policy, "fetch"),
    /fetch\/XHR request did not use/,
  );
  assert.match(
    requestPolicyViolation("http://localhost:8000/config.json", policy, "fetch"),
    /runtime config did not use/,
  );
});

test("cached federation responses inherit the validated JavaScript representation", () => {
  const entry = "http://localhost/mfes/order-management/remoteEntry.js";
  assert.equal(federationAssetViolation(entry, 304, ""), null);
  assert.equal(federationAssetViolation(entry, 200, "application/javascript"), null);
  assert.match(federationAssetViolation(entry, 200, "text/html"), /was not JavaScript/);
  assert.match(federationAssetViolation(entry, 200, ""), /had no Content-Type/);
});

test("remote-outage console approval is scoped to the deliberately failed entry", () => {
  const entry = "http://localhost/mfes/order-management/remoteEntry.js";
  assert.equal(
    consoleErrorApproved(`Failed to fetch dynamically imported module: ${entry}`, {
      degradedEntryUrl: entry,
      expectedEntryFailure: true,
    }),
    true,
  );
  assert.equal(
    consoleErrorApproved("Failed to fetch http://localhost:8000/api/orders", {
      degradedEntryUrl: entry,
      expectedEntryFailure: true,
    }),
    false,
  );
  assert.equal(
    consoleErrorApproved("An error occurred in one of your React components.", {
      degradedEntryUrl: entry,
      expectedEntryFailure: false,
      outageArmed: false,
    }),
    false,
  );
  assert.equal(
    consoleErrorApproved("An error occurred in one of your React components.", {
      degradedEntryUrl: entry,
      expectedEntryFailure: true,
      outageArmed: true,
    }),
    true,
  );
  assert.equal(
    consoleErrorApproved("Failed to load resource: net::ERR_CONNECTION_REFUSED", {
      degradedEntryUrl: entry,
      expectedEntryFailure: false,
      outageArmed: true,
    }),
    true,
  );
});

test("client-side navigation detection counts document requests, not history events", () => {
  assert.equal(isDocumentRequest({ resourceType: () => "document" }), true);
  assert.equal(isDocumentRequest({ resourceType: () => "fetch" }), false);
});

function validReport(kind) {
  const specs =
    kind === "wms"
      ? [
          ["order-funnel", "Order Funnel", "order-management", "funnel"],
          ["inventory-flow-accuracy", "Inventory Flow Accuracy", "inventory-storage", "bar"],
          ["catalog-growth", "Catalog Growth", "facility-layout", "line"],
        ]
      : [
          ["planning-throughput", "Planning Throughput", "wes-work-planning", "line"],
          ["fulfillment-throughput", "Fulfillment Throughput", "fulfillment-execution", "bar"],
          ["labor-management", "Workforce Labor", "workforce-management", "bar"],
          ["labor-performance", "Labor Performance (Efficiency %)", "labor-performance", "bar"],
        ];
  return {
    from: "2026-09-25T00:00:00Z",
    to: "2026-09-26T00:00:00Z",
    generatedAt: "2026-09-26T00:00:01Z",
    sections: specs.map(([id, title, sourceContext, chartKind], index) => ({
      id,
      title,
      sourceContext,
      chartKind,
      available: true,
      error: null,
      freshnessLagSeconds: index + 1,
      series: [{ label: `run-${index + 1}`, value: index + 1 }],
    })),
  };
}

test("report validation requires the complete owned section contract and bounded live data", () => {
  assert.equal(validateReport("wms", validReport("wms"), 60).length, 3);
  assert.equal(validateReport("wes", validReport("wes"), 60).length, 4);

  const wrongOwner = validReport("wms");
  wrongOwner.sections[2].sourceContext = "wes-work-planning";
  assert.throws(() => validateReport("wms", wrongOwner, 60), /expected owner facility-layout/);

  const missingSection = validReport("wes");
  missingSection.sections.pop();
  assert.throws(() => validateReport("wes", missingSection, 60), /missing section labor-performance/);

  const empty = validReport("wes");
  empty.sections[0].series = [];
  assert.throws(() => validateReport("wes", empty, 60), /has no real series data/);

  const zeroOnly = validReport("wms");
  zeroOnly.sections[0].series[0].value = 0;
  assert.throws(() => validateReport("wms", zeroOnly, 60), /has no non-zero series data/);

  const stale = validReport("wms");
  stale.sections[0].freshnessLagSeconds = 61;
  assert.throws(() => validateReport("wms", stale, 60), /freshness lag 61s exceeds 60s/);
});
