# Project: Warehouse Console (the shell — not a bounded context)

The React SPA shell for the `warehouse-systems` micro-frontend fleet. It owns
routing, top navigation, the shared design system consumption, and the four
screens that no single bounded context owns because they are cross-cutting:
Floor (`/`, built on `warehouse-ops-agent`'s `GET /daily-brief`), Order
Lifecycle (`/order-lifecycle`), and the WMS/WES report dashboards
(`/wms-dashboard`, `/wes-dashboard`). The primary nav's fifth destination,
Contexts (`/contexts`), is the launchpad into the eight bounded-context
remotes rather than a cross-cutting screen of its own — see ADR-0001 in
`docs/docs/adr/`. Everything else (`/order-management`, `/inventory`,
`/planning`, `/fulfillment`, `/workforce`, `/facility`, `/process-path`,
`/labor`) is a Module Federation **remote** owned and deployed by that
bounded context's own repo — this shell only lazy-loads and hosts them; it
never contains their business logic.

Source of truth for the domain model: `/Users/claudioed/docs/amazon-fulfillment-ddd.md`
and `/Users/claudioed/warehouse-systems-ddd.md`. This repo does not itself
model a bounded context — it is presentation/composition infrastructure that
sits in front of the eight that do.

## Strategic classification (read this before writing any code)

This is **not** a Generic/Core/Supporting subdomain in the DDD sense — it has
no aggregates, no domain events, no persistence. It is the fleet's **shared
composition root**: a Module Federation **host** that assembles eight
independently-built remotes into one navigable product, plus a thin
BFF-consuming read layer for the two cross-cutting concerns (Order Lifecycle,
WMS/WES dashboards) that no single remote can answer on its own.

**Relationship to the rest of the system**: every bounded-context service is
upstream of this shell for its own remote (`facility-mfe`, `order_mgmt_mfe`,
`process_path_mfe`, `labor_mfe`, etc.) — this repo has zero business logic of
theirs, only the routing/hosting glue. For the two cross-cutting screens,
this shell is a **downstream Conformist** to `warehouse-ops-agent`'s
`console-bff` (Order Lifecycle trace, `GET /console/reports/{wms,wes}`) — it
renders whatever shape the BFF publishes and does not reinterpret domain
meaning. **No shared database, ever**: every cross-service view goes through
a REST API, never a DB.

## Architecture (NON-NEGOTIABLE)

```
src/
  shell/            AppShell composition, RemoteBoundary (lazy+Suspense+error
                     boundary for remotes), RouterLink, useDocumentTitle
  features/
    floor/           Floor: monitor-surface screen ("/"), reads GET /daily-brief
    order-lifecycle/ Cross-service order trace (calls console-bff)
    wms-dashboard/    WMS report dashboard (envelope from console-bff)
    wes-dashboard/    WES report dashboard (envelope from console-bff)
    reports/          Shared report-dashboard rendering (ReportDashboard,
                       envelope types) used by both wms/wes dashboards
    contexts/         Launchpad into the eight bounded-context remotes
    not-found/        Client-rendered 404 (SPA fallback lands here, not a
                       server 404 — see nginx.conf)
  runtime-config.ts  Fetches + validates /config.json ({ apiOrigin }) BEFORE
                       the app mounts; publishes window.__WAREHOUSE_CONFIG__,
                       which every remote also reads
  config.ts          Resolves every API base as <apiOrigin>/api/<context>
                       (Kong); dev-port fallback only when not a production
                       build; a production build without apiOrigin throws
  main.tsx           Boot: loadRuntimeConfig() then a DYNAMIC import of
                       ./App (a static import would read an empty config)
  test/              MSW mocks + test setup
```

No remote's business logic may live here. `lazy()` calls for each remote
MUST be created once at module scope in `App.tsx`, never inside a render
function — see `RemoteBoundary.tsx`'s doc comment for why (remounting a
remote inside a render re-triggers its Module Federation fetch and loses its
internal state).

## Module Federation (this app is the host)

`@module-federation/vite` wires eight remotes (`order_mgmt_mfe`,
`inventory_mfe`, `planning_mfe`, `fulfillment_mfe`, `workforce_mfe`,
`facility_mfe`, `process_path_mfe`, `labor_mfe`), each built and deployed
independently by its own repo. `vite.config.ts` loads them from their dev
ports (5181–5187 and 5189, see README's port table) under `npm run dev`, and
from `/mfes/<context>/remoteEntry.js` in a production build — the path the
Nginx web gateway on `http://localhost` serves each remote at. Keep
`vite.config.ts` in object form (see `.claude/rules/mfe-remotes.md`). Shared singletons: `react`, `react-dom`,
`react-router-dom`, `@warehouse/ui-kit` — so a version mismatch on any of
these fails loudly rather than double-loading React.

## Cross-cutting screens (the reason this shell exists beyond hosting)

- **Order Lifecycle**: traces one order across the four services that touch
  it (order-management → inventory-storage → wes-work-planning →
  fulfillment-execution) via `console-bff` (hosted inside
  `warehouse-ops-agent` — see that repo's ADR-0002 and ADR-0003 for why the
  BFF lives there rather than as its own service, and for the report
  envelope shape).
- **WMS/WES dashboards**: read one section-oriented envelope per dashboard
  (`GET /console/reports/{wms,wes}?from=&to=`, default trailing 24h) and
  render each section with the ui-kit's chart primitives keyed by the
  section's own `chartKind`. These are eventually-consistent analytical
  projections, not live reads — every card carries a `FreshnessBadge`
  (staleness is shown, never hidden). A degraded section arrives as
  `available: false` and renders as one "data unavailable" card without
  taking down the rest of the dashboard; only a whole-request failure
  produces a dashboard-level error state.

## Tech & standards

- React 19, TypeScript (strict, `verbatimModuleSyntax`), Vite 8.
- Remote-hosting pitfalls (vite config form, tiny relative `remoteEntry.js`,
  selector collisions, the two-edge topology): `.claude/rules/mfe-remotes.md`.
- `react-router-dom` v7 (client-side only — see `RouterLink.tsx` /
  `useDocumentTitle.ts`; no full-page reload on navigation, no server-side
  routing logic).
- `@warehouse/ui-kit` (`file:../warehouse-ui-kit` sibling dependency — not a
  registry package yet) for every design-tokens/component need; never
  hand-roll a component the ui-kit already provides.
- `oxlint` (lint), `tsc -b` (typecheck), `vitest` + Testing Library + MSW
  (unit/component tests), Playwright (`scripts/verify-all-routes.cjs`,
  `scripts/verify-dashboards.cjs` — headless smoke checks, not part of the
  Docker/CI build).
- Packaging: `Dockerfile` (Node build → `nginx-unprivileged` runtime on
  8080, SPA fallback to `index.html` via `nginx.conf`) and
  `charts/warehouse-console/` (Helm), matching the fleet's Go-service
  Dockerfile/chart conventions where they translate to a static SPA —
  no database/Kafka/OTel blocks, `readOnlyRootFilesystem: true`.

## Runtime configuration and the localhost edge

One image serves any environment: the chart's `runtimeConfig.apiOrigin`
(default `http://localhost:8000`, i.e. Kong) is mounted as `/config.json`
and fetched before the app mounts. Validation is fail-fast — a missing,
non-JSON or path-carrying origin stops the console with an explicit error.
The fetch also happens under `npm run dev`, and no `config.json` is
committed: create an untracked `public/config.json` locally or the dev
server's HTML fallback makes the shell refuse to start. Nginx
(`http://localhost`) serves the shell and remotes; Kong
(`http://localhost:8000`) serves every API at `/api/<context>`; neither
proxies to the other.

## Definition of done

- `npm run lint` (oxlint), `npm run typecheck` (`tsc -b --noEmit`), and
  `npm run build` (`tsc -b && vite build`) all green.
- `npm test` (vitest) green; new screens/behavior get a component test using
  Testing Library + MSW, following the existing pattern in
  `src/features/*/*.test.tsx`.
- `npm run verify:routes` passes with the dev server + all 8 remote dev
  servers + all 8 backend services + `console-bff` running (full-fleet smoke
  check — not required for every change, but required before claiming a
  navigation/routing change works end-to-end).
- No remote's business logic leaks into this repo; no direct DB access, ever.
- README.md stays accurate: run steps, the remote port table, and the
  `verify:*` scripts' preconditions.

## Local quality gate (run before every commit)

- `npm run lint && npm run typecheck && npm run build` — the fast
  self-correction loop; the same sensors CI's `lint`/`typecheck`/`build`
  jobs run. Fix whatever it reports and re-run until green *before* you
  commit.
- `npm test` — run whenever you touch `src/`.
- Before claiming a routing/navigation/remote-hosting change works, run the
  full-fleet `npm run verify:routes` (or at minimum manually exercise it in
  a browser) rather than relying on unit tests alone — Module Federation and
  client-side routing failures often only show up integrated, not in
  isolation.

<!-- harness:scoped-rules:start (generated by tools/migrate_v3.py in warehouse-harness-template; do not hand-edit) -->
## Scoped rules and harness

Claude Code loads each rule below automatically when you touch the matching paths. OpenCode and Codex do NOT: read the rule BEFORE editing matching files.

Hooks (`scripts/harness/hook.py`, wired for Claude Code, Codex and OpenCode) block pushes to develop/main, `--no-verify`, bare `rm -rf`, and edits to generated files, and feed gofmt/vet findings back after each edit. Before saying "done" run `make check-fast`; the full gate is `make check-all`. `HARNESS_OFF=1` disables the hooks when debugging the harness itself.
<!-- harness:scoped-rules:end -->
