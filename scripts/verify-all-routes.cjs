/**
 * Browser route smoke check: loads every route in a real headless browser and
 * confirms each one renders without page errors or failed requests.
 * Defaults to the dev shell (:5173) and accepts BASE_URL/API_ORIGIN overrides.
 * The selected shell, every remote's dev server and the APIs at the resolved
 * apiOrigin (including each <context>-reports reader) must already be
 * running -- this does not start them for you.
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
const {
  isDocumentRequest,
  runtimeConfig,
  urlAt,
} = require("./browser-verify-common.cjs");

const { baseUrl, apiOrigin } = runtimeConfig();

const STUB_API = process.env.VERIFY_STUB_API === "1";

// The route list lives in verify-routes-list.cjs (data module): the
// remote entries are generated from src/remotes-manifest.json so they
// cannot drift from vite.config.ts or src/App.tsx.
const { routes } = require("./verify-routes-list.cjs");

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
  await page.goto(urlAt(baseUrl, STUB_API ? "/order-lifecycle" : "/"), { waitUntil: "networkidle" });
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
  } else {
    errors.push("SHELL MISSING: no /contexts nav link to click");
  }
  console.log();

  console.log("=== ERRORS COLLECTED ===");
  console.log(errors.length === 0 ? "none" : errors.join("\n"));
  await browser.close();
  process.exit(errors.length === 0 ? 0 : 1);
})();
