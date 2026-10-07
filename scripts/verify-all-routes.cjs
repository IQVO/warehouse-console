/**
 * Dev-only smoke check: loads every route in a real headless browser and
 * confirms each one renders without page errors or failed requests.
 * Requires the shell (npm run dev, :5173) and all 6 remotes' dev servers
 * to already be running -- this does not start them for you.
 *
 * Usage: npm run verify:routes
 *
 * This script used to read the page text, print it, and throw it away: the
 * exit code depended only on pageerror/requestfailed, so a completely
 * blank page passed. Each route now carries an assertion about what must
 * actually be on screen.
 */
const { chromium } = require("playwright");

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
  { path: "/capacity", label: "capacity", expect: /\S/ },
  { path: "/product-master", label: "product-master", expect: /\S/ },
  { path: "/network-inventory", label: "network-inventory", expect: /\S/ },
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

  for (const route of routes) {
    console.log(`=== ${route.label} (${route.path}) ===`);
    await page.goto(`http://localhost:5173${route.path}`, {
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
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  let documentNavigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) documentNavigations += 1;
  });
  const navLink = page.locator('nav a[href="/contexts"]').first();
  if ((await navLink.count()) > 0) {
    await navLink.click();
    await page.waitForTimeout(500);
    if (documentNavigations > 0) {
      errors.push(
        `FULL PAGE RELOAD on nav click (${documentNavigations}); expected client-side routing`,
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
