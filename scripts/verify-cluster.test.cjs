const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { REMOTES } = require("./browser-verify-common.cjs");

function report(kind) {
  const specs = kind === "wms"
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
      series: [{ label: `fixture-${index + 1}`, value: index + 10 }],
    })),
  };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

function runVerifier(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/verify-cluster.cjs"], {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function shellHtml(apiOrigin, fault) {
  const remoteManifest = Object.fromEntries(
    REMOTES.map(({ route, context, expectedText }) => [route, [context, expectedText.source]]),
  );
  return `<!doctype html>
<html><body><nav>
  <a href="/">Floor</a>
  <a href="/order-lifecycle">Order Lifecycle</a>
  <a href="/wms-dashboard">WMS Dashboard</a>
  <a href="/wes-dashboard">WES Dashboard</a>
  <a href="/contexts">Contexts</a>
</nav><main></main>
<script>
const API_ORIGIN = ${JSON.stringify(apiOrigin)};
${fault === "console" ? "console.error('fixture console failure');" : ""}
${fault === "request" ? "const failed = new Image(); failed.src = '/forced-request-failure';" : ""}
const remotes = ${JSON.stringify(remoteManifest)};
const remoteLinks = ${JSON.stringify(REMOTES.map(({ route, context }) => ({ route, context })))};
async function render() {
  const main = document.querySelector('main');
  const route = location.pathname;
  if (route === '/') {
    await fetch(API_ORIGIN + '/api/warehouse-ops-agent/daily-brief');
    main.innerHTML = '<h1>Floor</h1><p>Every monitored path.</p>';
    return;
  }
  if (route === '/order-lifecycle') {
    await fetch(API_ORIGIN + '/api/warehouse-ops-agent/console/orders/fixture');
    main.innerHTML = '<h1>Order Lifecycle</h1><p>fixture order trace</p>';
    return;
  }
  if (route === '/contexts') {
    main.innerHTML = '<h1>Bounded contexts</h1>' + remoteLinks.map(({route, context}) =>
      '<a href="' + route + '">' + context + '</a>').join(' ');
    return;
  }
  if (route === '/wms-dashboard' || route === '/wes-dashboard') {
    const kind = route.startsWith('/wms') ? 'wms' : 'wes';
    const response = await fetch(API_ORIGIN + '/api/warehouse-ops-agent/console/reports/' + kind);
    const payload = await response.json();
    main.innerHTML = '<h1>' + kind.toUpperCase() + ' Dashboard</h1>' + payload.sections.map((section) =>
      '<article><h2>' + section.title + '</h2><div>source: ' + section.sourceContext +
      '</div><div>' + section.series[0].label + '</div><svg width="20" height="20"><rect width="10" height="10"></rect></svg></article>').join('');
    return;
  }
  const remote = remotes[route];
  if (remote) {
    main.innerHTML = '<h1>' + remote[1].replaceAll('\\\\', '') + '</h1><p>' + remote[0] + '</p>';
    const script = document.createElement('script');
    script.type = 'module';
    script.src = '/mfes/' + remote[0] + '/remoteEntry.js';
    script.onerror = () => {
      main.innerHTML = '<h2>' + remote[0] + '</h2><div>This module is unavailable right now.</div>';
    };
    document.head.appendChild(script);
    return;
  }
  main.innerHTML = '<h1>Page not found</h1>';
}
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="/"]');
  if (!link) return;
  event.preventDefault();
  history.pushState({}, '', link.getAttribute('href'));
  render();
});
addEventListener('popstate', render);
render();
</script></body></html>`;
}

test("cluster verifier accepts the split edge and rejects browser failures", { timeout: 90_000 }, async () => {
  let webServer;
  let apiServer;
  let fault = null;
  try {
    apiServer = http.createServer((request, response) => {
      response.setHeader("Access-Control-Allow-Origin", webOrigin);
      response.setHeader("Content-Type", "application/json");
      if (request.url.endsWith("/console/reports/wms")) {
        response.end(JSON.stringify(report("wms")));
      } else if (request.url.endsWith("/console/reports/wes")) {
        response.end(JSON.stringify(report("wes")));
      } else {
        response.end(JSON.stringify({ ok: true }));
      }
    });
    const apiPort = await listen(apiServer);
    const apiOrigin = `http://127.0.0.1:${apiPort}`;

    webServer = http.createServer((request, response) => {
      const url = new URL(request.url, webOrigin);
      if (url.pathname === "/forced-request-failure") {
        request.socket.destroy();
        return;
      }
      if (url.pathname === "/config.json") {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ apiOrigin }));
        return;
      }
      const entry = url.pathname.match(/^\/mfes\/([^/]+)\/remoteEntry\.js$/);
      if (entry) {
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("ETag", `"${entry[1]}-fixture"`);
        if (request.headers["if-none-match"] === `"${entry[1]}-fixture"`) {
          response.statusCode = 304;
          response.end();
          return;
        }
        response.setHeader("Content-Type", "application/javascript");
        response.end(`import "./assets/${entry[1]}-chunk.js";`);
        return;
      }
      if (/^\/mfes\/[^/]+\/assets\/[^/]+-chunk\.js$/.test(url.pathname)) {
        response.setHeader("Content-Type", "application/javascript");
        response.end("globalThis.__fixtureChunkLoaded = true;");
        return;
      }
      response.setHeader("Content-Type", "text/html");
      response.end(shellHtml(apiOrigin, fault));
    });
    const webPort = await listen(webServer);
    var webOrigin = `http://127.0.0.1:${webPort}`;

    const artifactDir = mkdtempSync(path.join(os.tmpdir(), "warehouse-console-cluster-test-"));
    const result = await runVerifier({
      BASE_URL: webOrigin,
      API_ORIGIN: apiOrigin,
      ARTIFACT_DIR: artifactDir,
      VERIFY_TIMEOUT_MS: "10000",
    });

    assert.equal(
      result.code,
      0,
      `verifier exited ${result.code} (${result.signal})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    assert.match(result.stdout, new RegExp(`${REMOTES.length} remote entries and chunks stayed on the web origin`));
    assert.match(result.stdout, /real WMS and WES report responses rendered/);
    assert.match(result.stdout, /remote boundary isolated order-management/);

    fault = "console";
    const consoleFailure = await runVerifier({
      BASE_URL: webOrigin,
      API_ORIGIN: apiOrigin,
      ARTIFACT_DIR: mkdtempSync(path.join(os.tmpdir(), "warehouse-console-console-test-")),
      VERIFY_TIMEOUT_MS: "10000",
    });
    assert.notEqual(consoleFailure.code, 0, "console.error must fail the browser gate");
    assert.match(consoleFailure.stderr, /console\.error: fixture console failure/);

    fault = "request";
    const requestFailure = await runVerifier({
      BASE_URL: webOrigin,
      API_ORIGIN: apiOrigin,
      ARTIFACT_DIR: mkdtempSync(path.join(os.tmpdir(), "warehouse-console-request-test-")),
      VERIFY_TIMEOUT_MS: "10000",
    });
    assert.notEqual(requestFailure.code, 0, "request failures must fail the browser gate");
    assert.match(requestFailure.stderr, /request failed: .*forced-request-failure/);
  } finally {
    if (webServer?.listening) await close(webServer);
    if (apiServer?.listening) await close(apiServer);
  }
});
