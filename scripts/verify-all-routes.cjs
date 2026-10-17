/**
 * Dev-only smoke check: loads every route in a real headless browser and
 * confirms each one renders without page errors or failed requests.
 * Requires the shell (npm run dev, :5173), every remote's dev server and the
 * APIs at config.json's apiOrigin (including each <context>-reports reader)
 * to already be running -- this does not start them for you.
 *
 * Usage: npm run verify:routes
 *        VERIFY_STUB_API=1 npm run verify:routes   (no backends, see below)
 *
 * VERIFY_STUB_API=1 answers every call to config.json's apiOrigin with a
 * 503 inside the browser (page.route), so no backend and no Kong CORS are
 * needed. Every screen is designed to render its heading and an error state
 * when its API is down, so the same routes and assertions still apply; what
 * it proves is what unit tests cannot: each remote's remoteEntry loads and
 * mounts, routing, nav and the 404 screens. It does not prove data panels.
 *
 * This script used to read the page text, print it, and throw it away: the
 * exit code depended only on pageerror/requestfailed, so a completely
 * blank page passed. Each route now carries an assertion about what must
 * actually be on screen.
 */
const { chromium } = require("playwright");

const STUB_API = process.env.VERIFY_STUB_API === "1";

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
  { path: "/network-fulfillment", label: "network-fulfillment", expect: /\S/ },
  { path: "/capacity", label: "capacity", expect: /\S/ },
  { path: "/product-master", label: "product-master", expect: /\S/ },
  { path: "/network-inventory", label: "network-inventory", expect: /\S/ },
  { path: "/inbound-receiving", label: "inbound-receiving", expect: /\S/ },
  // slotting-optimization's remote (connect-all 2.2b): container
  // slotting_mfe, gateway path /mfes/slotting-optimization/, dev :5194.
  { path: "/slotting", label: "slotting-optimization", expect: /\S/ },
  // /reports/:context -- one Bounded Context Report screen per slug in
  // src/features/context-reports/registry.ts (src/remotes-registration.test.ts
  // fails when a registered slug is missing here). Each must render its own
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
  // An unknown report slug falls through to the shell's own 404 screen.
  { path: "/reports/no-such-context", label: "report:404", expect: /Page not found/i },
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
  if (STUB_API) {
    const { apiOrigin } = require("../public/config.json");
    await page.route(`${apiOrigin}/**`, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/problem+json",
        headers: { "access-control-allow-origin": "*" },
        body: '{"title":"verify:routes stub: no backend","status":503}',
      }),
    );
  }
  page.on("requestfailed", (req) => {
    // ERR_ABORTED is the page cancelling its own fetch (ui-kit's useFetch aborts
    // on effect cleanup, and StrictMode runs every dev effect twice), not a backend failure.
    if (req.failure()?.errorText === "net::ERR_ABORTED") return;
    if (!req.url().includes("mf-types") && !req.url().includes("@vite")) {
      errors.push(
        `[${page.url()}] REQUEST FAILED: ${req.url()} ${req.failure()?.errorText}`,
      );
    }
  });

  for (const route of routes) {
    console.log(`=== ${route.label} (${route.path}) ===`);
    await page.goto(`http://localhost:5173${route.path}`, {
      waitUntil: "networkidle",
      timeout: 20000,
    });
    await page.waitForTimeout(800);

    const bodyText = await page.locator("body").innerText();
    console.log(bodyText.slice(0, 500));

    // RemoteBoundary swallows a remote that failed to load or threw on mount
    // (404 remoteEntry, wrong federation name, missing ./App) behind this card,
    // which satisfies every /\S/ expectation and raises no pageerror.
    if (/This module is unavailable right now/i.test(bodyText)) {
      errors.push(`[${route.path}] REMOTE UNAVAILABLE: RemoteBoundary rendered its fallback card`);
    }

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
  await page.goto(`http://localhost:5173${STUB_API ? "/order-lifecycle" : "/"}`, { waitUntil: "networkidle" });
  // Playwright's framenavigated also fires for history.pushState (client-side)
  // navigations, so it cannot tell them from reloads (it flagged every healthy
  // click). A window flag set before the click survives only a same-document one.
  await page.evaluate(() => {
    window.__spaNavMarker = true;
  });
  const navLink = page.locator('nav a[href="/contexts"]').first();
  if ((await navLink.count()) > 0) {
    await navLink.click();
    await page.waitForTimeout(500);
    if (await page.evaluate(() => window.__spaNavMarker === true)) {
      console.log("ok: nav click routed client-side");
    } else {
      errors.push("FULL PAGE RELOAD on nav click; expected client-side routing");
    }
  } else {
    errors.push("SHELL MISSING: no /contexts nav link to click");
  }
  console.log();

  console.log("=== ERRORS COLLECTED ===");
  console.log(errors.length === 0 ? "none" : errors.join("\n"));
  await browser.close();
  process.exit(errors.length === 0 ? 0 : 1);
})();
