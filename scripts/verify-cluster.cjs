#!/usr/bin/env node
"use strict";

const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
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

const { baseUrl, apiOrigin } = runtimeConfig();
const timeoutMs = Number.parseInt(process.env.VERIFY_TIMEOUT_MS || "30000", 10);
const maxReportFreshnessSeconds = Number.parseFloat(
  process.env.MAX_REPORT_FRESHNESS_SECONDS || "300",
);
const artifactDir = path.resolve(
  process.env.ARTIFACT_DIR || "/tmp/warehouse-console-cluster-verify",
);
const degradedContext = process.env.DEGRADED_REMOTE_CONTEXT || "order-management";

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  throw new Error("VERIFY_TIMEOUT_MS must be a positive integer");
}
if (!Number.isFinite(maxReportFreshnessSeconds) || maxReportFreshnessSeconds < 0) {
  throw new Error("MAX_REPORT_FRESHNESS_SECONDS must be a non-negative number");
}
if (baseUrl === apiOrigin) {
  throw new Error("BASE_URL and API_ORIGIN must be different origins for the split edge");
}
if (!REMOTES.some(({ context }) => context === degradedContext)) {
  throw new Error(`DEGRADED_REMOTE_CONTEXT is not a configured remote: ${degradedContext}`);
}

mkdirSync(artifactDir, { recursive: true });

function mainText(page) {
  return page.locator("main").innerText();
}

async function poll(description, predicate) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ""}`,
  );
}

function dashboardEndpoint(kind) {
  return `${apiOrigin}/api/warehouse-ops-agent/console/reports/${kind}`;
}

(async () => {
  const failures = [];
  const consoleLog = [];
  const requestLog = [];
  const entries = new Set();
  const chunks = new Set();
  const reportKinds = new Set();
  let browser;
  let mainContext;
  let degradationBrowserContext;
  let page;
  let degradationPage;
  let fatalError = null;

  const recordFailure = (message) => {
    if (!failures.includes(message)) failures.push(message);
  };

  function attachGuards(guardedPage, state) {
    guardedPage.on("pageerror", (error) => {
      recordFailure(`[${guardedPage.url()}] pageerror: ${error.message}`);
    });
    guardedPage.on("console", (message) => {
      const entry = {
        page: state.name,
        type: message.type(),
        url: guardedPage.url(),
        text: message.text(),
      };
      consoleLog.push(entry);
      if (message.type() !== "error") return;

      const approvedRemoteFailure = consoleErrorApproved(entry.text, state);
      if (!approvedRemoteFailure) {
        recordFailure(`[${guardedPage.url()}] console.error: ${entry.text}`);
      }
    });
    guardedPage.on("request", (request) => {
      const url = request.url();
      requestLog.push({
        page: state.name,
        method: request.method(),
        resourceType: request.resourceType(),
        url,
      });
      const violation = requestPolicyViolation(
        url,
        { baseUrl, apiOrigin },
        request.resourceType(),
      );
      if (violation) recordFailure(violation);

      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }
      for (const remote of REMOTES) {
        if (parsed.pathname === remote.entryPath) entries.add(remote.context);
        if (
          parsed.pathname.startsWith(`/mfes/${remote.context}/assets/`) &&
          /\.m?js$/i.test(parsed.pathname)
        ) {
          chunks.add(remote.context);
        }
      }
    });
    guardedPage.on("requestfailed", (request) => {
      let expected = false;
      if (state.degrading) {
        const remote = REMOTES.find(({ context }) => context === state.degrading);
        try {
          expected = new URL(request.url()).pathname === remote.entryPath;
        } catch {
          expected = false;
        }
      }
      if (expected) state.expectedEntryFailure = true;
      if (!expected) {
        recordFailure(
          `[${guardedPage.url()}] request failed: ${request.url()} (${request.failure()?.errorText || "unknown"})`,
        );
      }
    });
    guardedPage.on("response", (response) => {
      if (response.status() >= 400) {
        recordFailure(
          `[${guardedPage.url()}] HTTP ${response.status()}: ${response.url()}`,
        );
      }
      const federationViolation = federationAssetViolation(
        response.url(),
        response.status(),
        response.headers()["content-type"] || "",
      );
      if (federationViolation) recordFailure(federationViolation);
    });
  }

  async function assertRendered(targetPage, route) {
    const main = targetPage.locator("main");
    await main.waitFor({ state: "visible", timeout: timeoutMs });
    await main.getByText(route.expectedText).first().waitFor({
      state: "visible",
      timeout: timeoutMs,
    });
    const text = (await main.innerText()).trim();
    if (text.length < 10) {
      throw new Error(`${route.path} rendered blank main content`);
    }
    if (/hydration (?:failed|error)|did not match the server/i.test(text)) {
      throw new Error(`${route.path} rendered a hydration failure`);
    }
    if ((await targetPage.locator("nav a").count()) === 0) {
      throw new Error(`${route.path} lost the shell navigation`);
    }
  }

  async function visitRoute(route) {
    let reportResponsePromise;
    const kind = route.path === "/wms-dashboard" ? "wms" : route.path === "/wes-dashboard" ? "wes" : null;
    if (kind) {
      reportResponsePromise = page.waitForResponse(
        (response) => response.url().startsWith(dashboardEndpoint(kind)),
        { timeout: timeoutMs },
      );
    }

    const navigation = await page.goto(urlAt(baseUrl, route.path), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    if (!navigation || navigation.status() >= 400) {
      throw new Error(`${route.path} deep load failed with HTTP ${navigation?.status() ?? "none"}`);
    }
    await assertRendered(page, route);

    if (route.kind === "remote") {
      await poll(`${route.context} federation entry and chunk`, () =>
        entries.has(route.context) && chunks.has(route.context),
      );
    }

    if (kind) {
      const response = await reportResponsePromise;
      if (response.status() !== 200) {
        throw new Error(`${kind.toUpperCase()} report returned HTTP ${response.status()}`);
      }
      const sections = validateReport(
        kind,
        await response.json(),
        maxReportFreshnessSeconds,
      );
      reportKinds.add(kind);
      const rendered = await mainText(page);
      for (const section of sections) {
        if (!rendered.includes(section.title) || !rendered.includes(section.sourceContext)) {
          throw new Error(
            `${kind.toUpperCase()} dashboard did not render ${section.title} from ${section.sourceContext}`,
          );
        }
      }
      const charts = await page.locator("main svg").count();
      if (charts < sections.length) {
        throw new Error(
          `${kind.toUpperCase()} dashboard rendered ${charts} charts for ${sections.length} sections`,
        );
      }
    }
  }

  try {
    browser = await chromium.launch();
    mainContext = await browser.newContext({
      recordHar: {
        path: path.join(artifactDir, "requests.har"),
        content: "embed",
      },
      viewport: { width: 1440, height: 1100 },
    });
    await mainContext.tracing.start({ screenshots: true, snapshots: true, sources: true });
    page = await mainContext.newPage();
    attachGuards(page, { name: "acceptance", degrading: null });

    console.log(`web edge: ${baseUrl}`);
    console.log(`API edge: ${apiOrigin}`);

    for (const route of CLUSTER_ROUTES) {
      console.log(`checking ${route.label}: ${route.path}`);
      await visitRoute(route);
    }

    const deepRoute = CLUSTER_ROUTES.find(({ context }) => context === "process-path-management");
    await page.goto(urlAt(baseUrl, deepRoute.path), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await assertRendered(page, deepRoute);
    const refresh = await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
    if (!refresh || refresh.status() >= 400) {
      throw new Error(`deep refresh returned HTTP ${refresh?.status() ?? "none"}`);
    }
    await assertRendered(page, deepRoute);
    console.log(`PASS shell deep refresh: ${deepRoute.path}`);

    await page.goto(urlAt(baseUrl, "/contexts"), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    const documentRequests = [];
    const documentRequestListener = (request) => {
      if (isDocumentRequest(request)) documentRequests.push(request.url());
    };
    page.on("request", documentRequestListener);
    await page.locator('a[href="/order-management"]').first().click();
    await page.waitForURL(urlAt(baseUrl, "/order-management"), { timeout: timeoutMs });
    await assertRendered(
      page,
      CLUSTER_ROUTES.find(({ context }) => context === "order-management"),
    );
    page.off("request", documentRequestListener);
    if (documentRequests.length > 0) {
      throw new Error(
        `client-side navigation caused document request(s): ${documentRequests.join(", ")}`,
      );
    }
    console.log("PASS client-side navigation caused no document reload");

    for (const remote of REMOTES) {
      if (!entries.has(remote.context) || !chunks.has(remote.context)) {
        throw new Error(`missing federation entry or chunk for ${remote.context}`);
      }
    }
    console.log(`PASS ${REMOTES.length} remote entries and chunks stayed on the web origin`);

    if (reportKinds.size !== 2) {
      throw new Error("both real report APIs were not observed");
    }
    console.log("PASS real WMS and WES report responses rendered (no mocked routes)");

    degradationBrowserContext = await browser.newContext({
      recordHar: {
        path: path.join(artifactDir, "degradation.har"),
        content: "embed",
      },
      viewport: { width: 1440, height: 1100 },
    });
    await degradationBrowserContext.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    const degradedRemote = REMOTES.find(({ context }) => context === degradedContext);
    degradationPage = await degradationBrowserContext.newPage();
    const degradationState = {
      name: "remote-degradation",
      degrading: degradedContext,
      degradedEntryUrl: urlAt(baseUrl, degradedRemote.entryPath),
      expectedEntryFailure: false,
      outageArmed: true,
    };
    attachGuards(degradationPage, degradationState);
    await degradationPage.route(
      (candidate) =>
        candidate.origin === new URL(baseUrl).origin &&
        candidate.pathname === degradedRemote.entryPath,
      (route) => route.abort("connectionrefused"),
    );
    await degradationPage.goto(urlAt(baseUrl, degradedRemote.route), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await degradationPage
      .locator("main")
      .getByText(/This module is unavailable right now/i)
      .waitFor({ state: "visible", timeout: timeoutMs });
    if (!degradationState.expectedEntryFailure) {
      throw new Error(`controlled outage did not fail ${degradedRemote.entryPath}`);
    }
    if ((await degradationPage.locator("nav a").count()) === 0) {
      throw new Error("remote boundary failure took down the shell navigation");
    }

    const degradedDocumentRequests = [];
    const degradedDocumentListener = (request) => {
      if (isDocumentRequest(request)) degradedDocumentRequests.push(request.url());
    };
    degradationPage.on("request", degradedDocumentListener);
    await degradationPage.locator('nav a[href="/contexts"]').first().click();
    await degradationPage.waitForURL(urlAt(baseUrl, "/contexts"), { timeout: timeoutMs });
    await degradationPage.locator('a[href="/inventory"]').first().click();
    await degradationPage.waitForURL(urlAt(baseUrl, "/inventory"), { timeout: timeoutMs });
    await assertRendered(
      degradationPage,
      CLUSTER_ROUTES.find(({ context }) => context === "inventory-storage"),
    );
    degradationPage.off("request", degradedDocumentListener);
    if (degradedDocumentRequests.length > 0) {
      throw new Error(
        `navigation after remote failure reloaded the document: ${degradedDocumentRequests.join(", ")}`,
      );
    }
    degradationState.degrading = null;
    console.log(`PASS remote boundary isolated ${degradedContext} and another remote remained usable`);

    await poll("all guarded browser events to settle", () => true);
    if (failures.length > 0) {
      throw new Error(failures.join("\n"));
    }
  } catch (error) {
    fatalError = error;
    if (!failures.includes(error.message)) failures.push(error.message);
    if (page && !page.isClosed()) {
      await page
        .screenshot({ path: path.join(artifactDir, "failure.png"), fullPage: true })
        .catch(() => {});
    }
    if (degradationPage && !degradationPage.isClosed()) {
      await degradationPage
        .screenshot({ path: path.join(artifactDir, "degradation-failure.png"), fullPage: true })
        .catch(() => {});
    }
  } finally {
    writeFileSync(
      path.join(artifactDir, "console.json"),
      `${JSON.stringify(consoleLog, null, 2)}\n`,
    );
    writeFileSync(
      path.join(artifactDir, "requests.json"),
      `${JSON.stringify(requestLog, null, 2)}\n`,
    );
    writeFileSync(
      path.join(artifactDir, "failures.txt"),
      failures.length ? `${failures.join("\n")}\n` : "none\n",
    );

    if (degradationBrowserContext) {
      await degradationBrowserContext.tracing
        .stop(
          fatalError
            ? { path: path.join(artifactDir, "degradation-trace.zip") }
            : undefined,
        )
        .catch(() => {});
      await degradationBrowserContext.close().catch(() => {});
    }
    if (mainContext) {
      await mainContext.tracing
        .stop(fatalError ? { path: path.join(artifactDir, "trace.zip") } : undefined)
        .catch(() => {});
      await mainContext.close().catch(() => {});
    }
    if (browser) await browser.close().catch(() => {});
  }

  if (fatalError) {
    console.error(`\nCLUSTER VERIFY FAILED\n${failures.join("\n")}`);
    console.error(`artifacts: ${artifactDir}`);
    process.exitCode = 1;
    return;
  }

  console.log("PASS no page, console, request, hydration, or blank-content failures");
  console.log(`artifacts: ${artifactDir}`);
})();
