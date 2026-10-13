---
id: troubleshooting
title: Troubleshooting
sidebar_label: Troubleshooting
---

# Troubleshooting

Start with the browser's DevTools: the **Console** tab shows boot and render
errors, the **Network** tab shows which request failed (`config.json`, a
`remoteEntry.js`, or an API call to Kong) and whether it was a CORS preflight.
The shell has no server-side logic, so almost every failure is visible there.

## Boot and blank screens

| Symptom | Likely cause | Check | Fix |
|---|---|---|---|
| Page shows only `warehouse-console failed to start: Unable to load runtime configuration (HTTP 404)` | `/config.json` not mounted (chart `runtimeConfig.enabled: false`, or ConfigMap missing) | `curl -i http://localhost/config.json` | enable `runtimeConfig` and set `runtimeConfig.apiOrigin`; the console nginx deliberately returns 404 rather than the SPA fallback for this path |
| `… Runtime configuration must be JSON, received "text/html" …` | something served HTML for `/config.json`: under `npm run dev` there is no `public/config.json`, so Vite's fallback answers | Network tab → `config.json` response | create `public/config.json` with `{ "apiOrigin": "http://localhost:8000" }` (do not commit it) |
| `… apiOrigin must be a non-empty string` / `must be an absolute URL` / `must use HTTP or HTTPS` / `must contain only an origin` | malformed `apiOrigin` (e.g. `localhost:8000`, `http://localhost:8000/api`) | `curl -s http://localhost/config.json` | use scheme + host + port only; see [Configuration](./configuration.md#runtime-configuration-configjson) |
| `… window.__WAREHOUSE_CONFIG__.apiOrigin is required in production` | a production bundle evaluated `src/config.ts` without a published config (should not happen through `main.tsx`; seen if the bundle is loaded some other way) | browser console stack trace | load the shell through its own `index.html` |
| **Blank page, every request 200** (`index.html`, assets, `config.json`), no "failed to start" text | the app mounted, then a render error outside any `RemoteBoundary` unmounted the whole tree: the shell has no root error boundary, so a crash in a shell screen (Floor, Contexts, dashboards, report screens) blanks the page | browser console for the React error | fix the data/code the stack points at; a payload shape change in warehouse-ops-agent (`/daily-brief`, `/console/...`) is the usual suspect |
| Blank page with `Cannot read properties of null (reading 'useRef')` | two React copies: a remote's React won the singleton negotiation | `vite.config.ts` `shareStrategy` and `shared` | keep `shareStrategy: "loaded-first"` and the shared `react`/`react-dom`/`react-router-dom`/`@warehouse/ui-kit` singletons; do not switch to `version-first` |
| Shell nav renders, main area empty, no error | should not happen any more: unknown paths render "Page not found" | URL | if it does, check that `<Route path="*">` is still last in `src/App.tsx` |

## Remote (micro-frontend) failures

A remote that fails to load renders the card **"This module is unavailable
right now."** in its route only; the rest of the console keeps working. In
`npm run dev` the card also shows the underlying error message.

| Symptom | Likely cause | Check | Fix |
|---|---|---|---|
| Unavailable card, `remoteEntry.js` → 502 | the remote's `<context>-frontend` pod/Service is down | `curl -I http://localhost/mfes/<context>/remoteEntry.js`; `kubectl get pods,svc -n <apps-namespace>` and look for `<context>-frontend` | fix the remote's deployment (its own repo/chart) |
| Unavailable card, `remoteEntry.js` → **200 with `text/html`** | the web gateway has no `/mfes/<context>/` location for it (missing from warehouse-infra `frontend_remotes`), so the request fell through to the console's SPA fallback and returned `index.html` | `curl -sI http://localhost/mfes/<context>/remoteEntry.js` content type | add the remote to warehouse-infra `terraform/frontends.tf` `frontend_remotes` |
| Unavailable card right after a remote redeploy, then fine | gateway still resolving the old Service IP (resolver `valid=10s`) | retry after ~10 s | none needed |
| Unavailable card under `npm run dev` | the remote's dev server is not running on its port (5181–5193) | `curl -I http://localhost:<port>/remoteEntry.js` | start that remote's `web/` dev server |
| Error mentions a missing container / `<name>` is not a remote | container name in `vite.config.ts` does not match the remote's own `federation({ name })` | compare with the remote repo's `web/vite.config.ts` (e.g. network-fulfillment is `netfulfil_mfe`) | align the `name` field; `src/remotes-registration.test.ts` pins four of them |
| Old remote UI after a remote deploy | the tab still holds the previously loaded `remoteEntry.js`; or the remote's own nginx caches `remoteEntry.js` | reload the page; `curl -sI .../remoteEntry.js` for its `Cache-Control` | reload; remote cache headers live in each remote repo's `web/nginx.conf` |
| Remote remounts and refetches on every navigation | a `lazy()` call was moved inside a component | `src/App.tsx` | keep every `lazy(() => import("<name>_mfe/App"))` at module scope |
| Clicking a nav item reloads the whole page | ui-kit rendering plain `<a href>` (no `NavigationProvider`/`RouterLink`) | `npm run verify:routes` reports `FULL PAGE RELOAD` | keep `NavigationProvider link={RouterLink}` in `src/App.tsx` |

## API, CORS and data problems

| Symptom | Likely cause | Check | Fix |
|---|---|---|---|
| Floor: "The floor view is unavailable"; dashboards: "Couldn't reach the console reports service: Failed to fetch"; Network tab shows a failed `OPTIONS` or a CORS error | Kong CORS does not allow the **page** origin | `curl -si -X OPTIONS -H 'Origin: http://localhost' -H 'Access-Control-Request-Method: GET' http://localhost:8000/api/warehouse-ops-agent/daily-brief` and look for `Access-Control-Allow-Origin` | warehouse-infra's `warehouse-cors` KongClusterPlugin grants exactly `web_origin` (`http://localhost`, or `http://localhost:<port>` when the gateway is not on 80); enable `kong_cors_enabled` and keep it equal to the page origin |
| A remote's write fails in preflight while reads work | the request carries a header Kong's CORS plugin does not list (allowed: `Accept`, `Content-Type`, `Origin`, `Idempotency-Key`; `If-Match` is **not** allowed) | Network tab → preflight response | add the header to warehouse-infra `terraform/kong-cors.tf` |
| Same failures, no CORS error, `net::ERR_CONNECTION_REFUSED` | `apiOrigin` points at the wrong host/port, or Kong is down | `curl -s http://localhost/config.json`; `curl -I http://localhost:8000/` | fix `runtimeConfig.apiOrigin` / Kong |
| Floor shows "refresh failed — showing last known" | a poll of `/daily-brief` failed after an earlier success | Network tab | transient: it retries every 15 s; persistent: warehouse-ops-agent is down |
| Floor metrics show `—` and "no signal from `<service>`" | warehouse-ops-agent could not reach that upstream; the console shows the gap on purpose | warehouse-ops-agent logs | fix the named upstream, not the console |
| Contexts tiles lack the "in PICK" / "sites" badges | `GET /api/fulfillment-execution/queues/PICK/depth` or `GET /api/facility-layout/sites` failed; badges are simply omitted | Network tab | check those two APIs through Kong |
| Order Lifecycle: "Couldn't load order `<id>`: …" | the BFF route `/console/orders/<id>/lifecycle` failed (404 unknown order, 5xx) | Network tab | check the id and warehouse-ops-agent |
| Order Lifecycle stage shows "No signal from `<context>`" | the BFF returned `null` for that stage (upstream unavailable), which is different from "pending" | — | fix that context; not a console bug |
| Dashboard card "Data unavailable" | that section arrived with `available: false` | card text shows the BFF's `error` | fix the named source context |
| Dashboard card "Unsupported chart type" | the BFF sent a `chartKind` other than `funnel`/`bar`/`line` | — | add the chart kind to `ReportDashboard` |
| `/reports/<context>`: "Report temporarily unavailable" with a 404 | no Kong route to that context's `<context>-reports` Service, or the context has no reports binary deployed | `curl -i http://localhost:8000/api/<context>/reports/<name>/freshness` | warehouse-infra `terraform/services.tf` renders a second route `/api/<context>/reports` per analytics-enabled context; network-fulfillment's route lives in `terraform/network-fulfillment.tf`. A context without a reports deployment cannot be fixed from here |
| `/reports/network-fulfillment`: "Submission Failed" is 0 for older days | network-fulfillment added `ordersRejectedSubmissionFailed` additively (its ADR 0015); history projected before the counter existed reads 0 | `curl -s "http://localhost:8000/api/network-fulfillment/reports/acknowledgement?from=<RFC3339>&to=<RFC3339>"` | expected; not a console bug |
| Report numbers never move while the tab stays open | every report config computes its `from`/`to` window once, at module load | compare the request's `to` with now | reload the page |
| `/reports/<something>` shows "Page not found" | slug not in `REPORT_ROUTES` (`src/features/context-reports/registry.ts`) | registry | use one of the nine slugs; warehouse-planning and product-master have no report screen |

## Local development and CI

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm ci` / `vite` cannot resolve `@warehouse/ui-kit` | `../warehouse-ui-kit` missing or not built (`dist/` absent) | clone it as a sibling, then `npm ci && npm run build` there |
| `npm run dev` exits: port 5173 in use | `strictPort: true` | free port 5173 |
| Vitest: "Invalid hook call" / null dispatcher | a second React instance from the ui-kit sibling | keep `resolve.dedupe: ["react", "react-dom"]` in `vitest.config.ts` |
| Vitest: `[MSW] Error: intercepted a request without a matching request handler` | a component calls an endpoint the test did not stub (`onUnhandledRequest: "error"`) | add `server.use(http.get(...))` for it |
| Vitest prints `Error: remote unavailable (unit test stub)` but passes | expected: every `<name>_mfe/App` is aliased to a throwing stub | nothing to fix |
| Docker build: `Cannot find native binding` or npm `EUSAGE` lock file out of sync | building with the macOS-generated lockfile | build with the repo `Dockerfile` (it installs without the lockfile) |
| CI `guide-lint` fails after moving a docs page | a `.claude/` guide still cites the old path | grep `.claude/` for the path before moving |
| CI `helm-lint`, `trivy-scan`, `docker-publish`, `release` show "skipped" | gated to PRs into / pushes to `main` | expected on PRs into `develop` |
