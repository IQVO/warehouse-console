---
name: add-console-screen
description: Add or change a shell-owned console screen with @warehouse/ui-kit - a feature folder under src/features, route and nav wiring in src/App.tsx, API URLs from src/config.ts, loading/error/stale handling via useFetch, and a Testing Library + MSW test. Covers the per-context Bounded Context Report screens (src/features/context-reports). Use when asked to build or modify the Floor, Order Lifecycle, WMS/WES dashboard, Contexts or report screens, or to render new backend data in the shell.
---

# Add or adjust a shell-owned screen

First decide whether the screen belongs HERE. The shell owns only cross-cutting screens that no single bounded context can answer (Floor, Order Lifecycle, WMS/WES dashboards, the Contexts launchpad, per-context report screens). A screen about ONE bounded context's domain belongs in that context's own remote repo; see ADR-0001 (`docs/docs/adr/0001-shell-owns-cross-cutting-screens-only.md`) and the `register-console-remote` skill. Do not put remote business logic, aggregates or domain rules here.

## Anatomy of an existing screen (copy these patterns)

- `src/features/floor/FloorScreen.tsx` + `types.ts` + `FloorScreen.test.tsx`: reads the BFF's `GET /daily-brief`; a screen = component + the DTO types it consumes + a test, in one folder.
- `src/features/wms-dashboard/WmsDashboardScreen.tsx`: a thin wrapper passing a title, subtitle and URL to `src/features/reports/ReportDashboard.tsx` (shared envelope rendering; WMS and WES differ only in endpoint).
- `src/features/contexts/ContextsScreen.tsx`: the launchpad; `useFetch` with `pollMs` for live badges.
- `src/features/not-found/NotFoundScreen.tsx`: the client-rendered 404.

## Steps

1. **DTO types** in the feature folder, mirroring what the backend actually returns. Read the real handler/OpenAPI in the owning service repo (`reports_handler.go`, the service's OpenAPI spec); do not guess field names. If you cannot verify a shape, say so in the file header the way `src/features/context-reports/networkFulfillment.config.tsx` does.
2. **URL from `src/config.ts`**, never a literal host. Use `SERVICE_BASE_URL.<ctx>` (OLTP), `BFF_BASE_URL` / `CONSOLE_REPORTS_URL` (console-bff in warehouse-ops-agent) or `REPORTS_BASE_URL.<ctx>` (a context's own `/reports/...` reader). All resolve to `<apiOrigin>/api/<context>` (Kong) at runtime. A new service means adding to the path maps AND the dev-port fallback maps in `src/config.ts`, plus a case in `src/config.test.ts`.
3. **Fetch with `useFetch` from `@warehouse/ui-kit`.** It keeps the last good payload across a failed refresh (`data`, `stale`, `error`, `loading` only on first load) and has NO default poll interval on purpose: pass `pollMs` only for read-only endpoints. Some fleet endpoints publish Kafka events as a side effect of being read, so never poll one casually.
4. **Render with ui-kit primitives** (`Card`, `DataTable`, `KpiStat`, `StatusPill`, `Timeline`, `FreshnessBadge`, `BarChart`, `LineChart`, `FunnelChart`, `LaunchTile`, all exported from the kit's `src/index.ts` in the sibling `warehouse-ui-kit` repo). Never hand-roll a component the kit already provides; style with the `--wh-*` CSS tokens, not literal colours. A genuinely missing primitive is a separate PR in the ui-kit repo. Page-level styles go in `src/styles/screens.css` (imported once in `src/main.tsx`; a per-component `.css` import does not resolve under this tsconfig).
5. **Degrade honestly.** Analytics here are eventually-consistent projections: show a `FreshnessBadge`, show a missing reading as "—" in warning tone (never a calm zero), render a degraded section (`available: false`) as one "data unavailable" card without breaking the rest, and use a single dashboard-level error state only when the whole request fails. The shell carries no alarm thresholds of its own; colour comes from flags the backend computed.
6. **Title and route.** Call `useDocumentTitle("<Name>")` (`src/shell/useDocumentTitle.ts`). Add the `<Route>` in `src/App.tsx` before the `path="*"` NotFound route; add a `NAV` entry only for a primary destination (there are exactly five today; the bar is a fixed height, so prefer a tile on the Contexts launchpad).
7. **Test** next to the screen: `render(...)`, stub endpoints with `server.use(http.get(URL, () => HttpResponse.json(...)))` from `src/test/mocks/server.ts`, import the URL from `src/config.ts` so the test and the screen cannot drift. The server has NO default handlers and `src/test/setup.ts` uses `onUnhandledRequest: "error"`: a screen that calls an unstubbed endpoint fails the test, by design. Cover loading, populated, partial degradation and whole-request error.

## Adding a Bounded Context Report screen (`/reports/<context>`)

1. Create `src/features/context-reports/<context>.config.tsx` exporting a `ContextReportConfig<Dto>` (`contextId`, `title`, `subtitle`, `reportUrl`, `freshnessUrl`, `renderBody`) built on `REPORTS_BASE_URL` and the window helpers in `src/features/context-reports/reportWindow.ts` (the context's own endpoint requires `from`/`to`; hour-bucketed reports use a trailing 24h window, day-bucketed catalog-growth reports 30d).
2. Add `{ path: "<repo-name>", config }` to `REPORT_ROUTES` in `src/features/context-reports/registry.ts`. That ONE list drives both the single `/reports/:context` route (`ContextReportRouteScreen.tsx`) and the "View metrics report" link on the Contexts tile; do not add per-context routes.
3. Add a `REPORTS_BASE_URL` entry in `src/config.ts` if the context is new (path map + dev-port map + the `ReportsBaseUrls` interface).
4. Test it through `ContextReportScreen` like `facilityLayout.config.test.tsx`; loading/error/empty states are already covered once in `ContextReportScreen.test.tsx`.
5. Know the open gap: the reports Service has no Kong route yet, so these screens 404 on a live cluster until warehouse-infra adds one (documented in `src/config.ts`). A green unit test does not prove they work end-to-end.

## Before you say done

```bash
make check-fast && npm test && npm run build
npm run verify:dashboards     # if you touched a dashboard (needs only the dev server)
```

Add the route to `scripts/verify-all-routes.cjs` for a new top-level screen and keep `README.md` in step. For a routing/navigation change also run `npm run verify:routes` (see `run-console-locally`).
