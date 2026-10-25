/**
 * Browser route smoke check: loads every route in a real headless browser and
 * confirms each one renders without page errors or failed requests.
 * Defaults to the dev shell (:5173) and accepts BASE_URL/API_ORIGIN overrides.
 * The selected shell and all 8 remotes must already be running; this script
 * does not start them.
 *
 * Usage: npm run verify:routes
 *
 * This script used to read the page text, print it, and throw it away: the
 * exit code depended only on pageerror/requestfailed, so a completely
 * blank page passed. Each route now carries an assertion about what must
 * actually be on screen.
 */
const { chromium } = require("playwright");
const {
  isDocumentRequest,
  runtimeConfig,
  urlAt,
} = require("./browser-verify-common.cjs");

const { baseUrl, apiOrigin } = runtimeConfig();

const routes = [
  { path: "/", label: "floor", expect: /Floor/i },
  { path: "/order-lifecycle", label: "order-lifecycle", expect: /Order Lifecycle/i },
  { path: "/contexts", label: "contexts", expect: /Bounded contexts/i },
  // These two shipped with the dashboards but were never added here.
  { path: "/wms-dashboard", label: "wms-dashboard", expect: /WMS Dashboard/i },
  { path: "/wes-dashboard", label: "wes-dashboard", expect: /WES Dashboard/i },
  { path: "/order-management", label: "order-management", expect: /\S/ },
  { path: "/inventory", label: "inventory", expect: /\S/ },
  { path: "/planning", label: "planning", expect: /\S/ },
  { path: "/fulfillment", label: "fulfillment", expect: /\S/ },
  { path: "/workforce", label: "workforce", expect: /\S/ },
  { path: "/facility", label: "facility", expect: /\S/ },
  { path: "/process-path", label: "process-path", expect: /\S/ },
  { path: "/labor", label: "labor", expect: /\S/ },
  // An unmatched URL must explain itself, not render empty chrome.
  { path: "/no-such-screen", label: "404", expect: /Page not found/i },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) =>
    errors.push(`[${page.url()}] PAGE ERROR: ${err.message}`),
  );
  page.on("requestfailed", (req) => {
    if (!req.url().includes("mf-types") && !req.url().includes("@vite")) {
      errors.push(
        `[${page.url()}] REQUEST FAILED: ${req.url()} ${req.failure()?.errorText}`,
      );
    }
  });

  console.log(`web: ${baseUrl}`);
  console.log(`expected API origin: ${apiOrigin}`);
  for (const route of routes) {
    console.log(`=== ${route.label} (${route.path}) ===`);
    await page.goto(urlAt(baseUrl, route.path), {
      waitUntil: "networkidle",
      timeout: 20000,
    });
    await page.waitForTimeout(800);

    const bodyText = await page.locator("body").innerText();
    console.log(bodyText.slice(0, 500));

    if (!route.expect.test(bodyText)) {
      errors.push(
        `[${route.path}] CONTENT ASSERTION FAILED: expected ${route.expect} in rendered page`,
      );
    }

    // The nav must survive on every route; losing it means the shell
    // itself failed to render, which a text assertion alone can miss.
    const navCount = await page.locator("nav a").count();
    if (navCount === 0) {
      errors.push(`[${route.path}] SHELL MISSING: no navigation links rendered`);
    }
    console.log();
  }

  // Navigation must be client-side. A document-level navigation here means
  // the ui-kit is emitting plain <a href> again, which tears down and
  // re-downloads every Module Federation remote on every click.
  console.log("=== client-side navigation ===");
  await page.goto(urlAt(baseUrl, "/"), { waitUntil: "networkidle" });
  const documentRequests = [];
  const documentRequestListener = (request) => {
    if (isDocumentRequest(request)) documentRequests.push(request.url());
  };
  page.on("request", documentRequestListener);
  const navLink = page.locator('nav a[href="/contexts"]').first();
  if ((await navLink.count()) > 0) {
    await navLink.click();
    await page.waitForURL(urlAt(baseUrl, "/contexts"), { timeout: 20000 });
    page.off("request", documentRequestListener);
    if (documentRequests.length > 0) {
      errors.push(
        `FULL PAGE RELOAD on nav click (${documentRequests.join(", ")}); expected client-side routing`,
      );
    } else {
      console.log("ok: nav click routed client-side");
    }
  }
  console.log();

  console.log("=== ERRORS COLLECTED ===");
  console.log(errors.length === 0 ? "none" : errors.join("\n"));
  await browser.close();
  process.exit(errors.length === 0 ? 0 : 1);
})();
