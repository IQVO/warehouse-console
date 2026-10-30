/**
 * Browser check for the two report dashboards (/wms-dashboard, /wes-dashboard).
 * Defaults to the dev shell (:5173) and accepts BASE_URL/API_ORIGIN overrides.
 *
 * Unlike verify:routes this does NOT need a live backend: it intercepts the
 * console-bff report calls and serves fixtures, so it exercises the three
 * states that matter independently of whether warehouse-ops-agent is up --
 *
 *   1. every section available   -> real charts draw real geometry
 *   2. one section unavailable   -> that ONE card degrades, the rest still draw
 *   3. the whole request fails   -> a single dashboard-level error state
 *
 * Requires only the shell's own dev server (npm run dev, :5173).
 *
 * Usage: npm run verify:dashboards
 */
const { chromium } = require("playwright");
const { runtimeConfig, urlAt } = require("./browser-verify-common.cjs");

const { baseUrl: BASE, apiOrigin: API_ORIGIN } = runtimeConfig();
const REPORTS_BASE = `${API_ORIGIN}/api/warehouse-ops-agent/console/reports`;
const SHOT_DIR = process.env.SHOT_DIR || "/tmp/warehouse-console-dashboards";

const wmsReport = {
  from: "2026-09-04T00:00:00Z",
  to: "2026-09-05T00:00:00Z",
  generatedAt: "2026-09-05T00:12:00Z",
  sections: [
    {
      id: "order-funnel",
      title: "Order Funnel",
      sourceContext: "order-management",
      chartKind: "funnel",
      available: true,
      error: null,
      freshnessLagSeconds: 12.3,
      series: [
        { label: "Received", value: 1204 },
        { label: "Allocated", value: 1131 },
        { label: "Released", value: 1088 },
        { label: "Shipped", value: 1042 },
      ],
    },
    {
      id: "inventory-flow-accuracy",
      title: "Inventory Flow Accuracy",
      sourceContext: "inventory-storage",
      chartKind: "bar",
      available: true,
      error: null,
      freshnessLagSeconds: 47,
      series: [
        { label: "Receiving", value: 99.1 },
        { label: "Putaway", value: 98.4 },
        { label: "Picking", value: 97.2 },
      ],
    },
    {
      id: "catalog-growth",
      title: "Catalog Growth",
      sourceContext: "order-management",
      chartKind: "line",
      available: true,
      error: null,
      freshnessLagSeconds: 310,
      series: [
        { label: "Mon", value: 8120 },
        { label: "Tue", value: 8190 },
        { label: "Wed", value: 8265 },
        { label: "Thu", value: 8301 },
        { label: "Fri", value: 8402 },
      ],
    },
  ],
};

/** WES fixture with labor-management degraded -- the partial-degradation case. */
const wesReport = {
  from: "2026-09-04T00:00:00Z",
  to: "2026-09-05T00:00:00Z",
  generatedAt: "2026-09-05T00:12:00Z",
  sections: [
    {
      id: "planning-throughput",
      title: "Planning Throughput",
      sourceContext: "wes-work-planning",
      chartKind: "line",
      available: true,
      error: null,
      freshnessLagSeconds: 8,
      series: [
        { label: "06:00", value: 210 },
        { label: "08:00", value: 340 },
        { label: "10:00", value: 305 },
        { label: "12:00", value: 388 },
      ],
    },
    {
      id: "fulfillment-throughput",
      title: "Fulfillment Throughput",
      sourceContext: "fulfillment-execution",
      chartKind: "bar",
      available: true,
      error: null,
      freshnessLagSeconds: 21,
      series: [
        { label: "PICK", value: 1420 },
        { label: "PACK", value: 1310 },
        { label: "SLAM", value: 1288 },
      ],
    },
    {
      id: "labor-management",
      title: "Labor Management",
      sourceContext: "workforce-management",
      chartKind: "bar",
      available: false,
      error: "workforce-management reports endpoint returned 503",
      freshnessLagSeconds: null,
      series: [],
    },
    {
      id: "labor-performance",
      title: "Labor Performance",
      sourceContext: "workforce-management",
      chartKind: "bar",
      available: true,
      error: null,
      freshnessLagSeconds: 64,
      series: [
        { label: "Zone A", value: 118 },
        { label: "Zone B", value: 96 },
        { label: "Zone C", value: 104 },
      ],
    },
  ],
};

const failures = [];

function check(name, ok, detail) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` -- ${detail}` : ""}`);
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

/** Counts <rect>/<polygon>/<path> nodes that actually occupy pixels, which is
 *  the difference between "a chart component mounted" and "a chart drew". */
async function drawnMarkCount(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("svg rect, svg polygon, svg path")).filter(
      (el) => {
        const box = el.getBoundingClientRect();
        return box.width > 1 && box.height > 1;
      },
    ).length,
  );
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.route(`${REPORTS_BASE}/wms*`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wmsReport) }),
  );
  await page.route(`${REPORTS_BASE}/wes*`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wesReport) }),
  );

  /* --- 1. WMS: every section available ------------------------------- */
  console.log("=== /wms-dashboard (all sections available) ===");
  await page.goto(urlAt(BASE, "/wms-dashboard"), { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(500);
  let body = await page.locator("body").innerText();

  check("heading renders", body.includes("WMS Dashboard"));
  for (const s of wmsReport.sections) {
    check(`section "${s.title}" card renders`, body.includes(s.title));
  }
  check("funnel stage labels drawn", body.includes("Received") && body.includes("Shipped"));
  check("bar category labels drawn", body.includes("Putaway"));
  // LineChart labels only the first and last bucket by design, not every tick.
  check("line endpoint labels drawn", body.includes("Mon") && body.includes("Fri"));
  check("freshness badges visible", (body.match(/behind/g) || []).length >= 3,
    `${(body.match(/behind/g) || []).length} badge(s)`);
  let svgs = await page.locator("svg").count();
  check("three charts mounted", svgs >= 3, `${svgs} svg`);
  let marks = await drawnMarkCount(page);
  check("charts drew real geometry", marks >= 10, `${marks} painted marks`);
  check("no unavailable placeholder", !body.includes("Data unavailable"));
  await page.screenshot({ path: `${SHOT_DIR}/wms-dashboard.png`, fullPage: true });

  /* --- 2. WES: one section degraded ---------------------------------- */
  console.log("\n=== /wes-dashboard (labor-management available:false) ===");
  await page.goto(urlAt(BASE, "/wes-dashboard"), { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(500);
  body = await page.locator("body").innerText();

  check("heading renders", body.includes("WES Dashboard"));
  for (const s of wesReport.sections) {
    check(`section "${s.title}" card renders`, body.includes(s.title));
  }
  check("degraded section shows placeholder", body.includes("Data unavailable"));
  check("degraded section explains why", body.includes("returned 503"));
  check("only one section degraded", (body.match(/Data unavailable/g) || []).length === 1);
  check("healthy sections still drew", body.includes("PICK") && body.includes("Zone A"));
  svgs = await page.locator("svg").count();
  check("three healthy charts mounted", svgs >= 3, `${svgs} svg`);
  marks = await drawnMarkCount(page);
  check("healthy charts drew real geometry", marks >= 8, `${marks} painted marks`);
  await page.screenshot({ path: `${SHOT_DIR}/wes-dashboard.png`, fullPage: true });

  /* --- 3. whole-response failure ------------------------------------- */
  console.log("\n=== /wms-dashboard (BFF unreachable) ===");
  await page.unroute(`${REPORTS_BASE}/wms*`);
  await page.route(`${REPORTS_BASE}/wms*`, (route) => route.abort("connectionrefused"));
  await page.goto(urlAt(BASE, "/wms-dashboard"), { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(500);
  body = await page.locator("body").innerText();

  check("dashboard-level error state", body.includes("Dashboard temporarily unavailable"));
  check("not confused with per-section degradation", !body.includes("Data unavailable"));
  await page.screenshot({ path: `${SHOT_DIR}/wms-dashboard-unavailable.png`, fullPage: true });

  /* --- 4. launchpad + nav wiring ------------------------------------- */
  console.log("\n=== / (launchpad + nav links) ===");
  await page.goto(urlAt(BASE, "/"), { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(300);
  check("nav has WMS Dashboard", (await page.locator('a[href="/wms-dashboard"]').count()) >= 1);
  check("nav has WES Dashboard", (await page.locator('a[href="/wes-dashboard"]').count()) >= 1);

  console.log(`\n=== PAGE ERRORS ===\n${pageErrors.length ? pageErrors.join("\n") : "none"}`);
  if (pageErrors.length) failures.push(`${pageErrors.length} page error(s)`);

  await browser.close();
  console.log(`\n=== ${failures.length === 0 ? "ALL CHECKS PASSED" : `${failures.length} CHECK(S) FAILED`} ===`);
  if (failures.length) console.log(failures.join("\n"));
  console.log(`screenshots: ${SHOT_DIR}`);
  process.exit(failures.length === 0 ? 0 : 1);
})();
