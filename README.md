# warehouse-console

The React SPA shell for the [warehouse-systems](https://github.com/claudioed?tab=repositories&q=warehouse)
micro-frontend console. Owns routing, top navigation, the shared design system, and the
primary nav's five destinations — four cross-cutting screens this shell implements directly,
plus one launchpad into everything else (see
[ADR-0001](docs/docs/adr/0001-shell-owns-cross-cutting-screens-only.md) for why the nav is
shaped this way):

- **Floor** (`/`) — the console's monitor surface: every monitored path across every site,
  and what needs attention first. Built entirely on `warehouse-ops-agent`'s existing
  `GET /daily-brief` read model (backlog, staffing, queue depth, stuck-task and correlated
  exception signals across every site/path). Every alarm colour comes from a flag the
  *backend* computed — the shell carries no thresholds of its own — and a missing reading
  renders as "—" in warning tone, never a calm zero (signal-on-silence).
- **Order Lifecycle** (`/order-lifecycle`) — traces one order across all four services that
  touch it (order-management → inventory-storage → wes-work-planning → fulfillment-execution)
  by calling the `console-bff` endpoint on `warehouse-ops-agent`.
- **WMS Dashboard** (`/wms-dashboard`) — the *what & where* of the warehouse: order funnel,
  inventory flow accuracy, catalog growth.
- **WES Dashboard** (`/wes-dashboard`) — the *when & in what order*: planning throughput,
  fulfillment throughput, labor management and labor performance.
- **Contexts** (`/contexts`) — the launchpad grid into every bounded context, following
  established enterprise WMS/ops-dashboard conventions (SAP Fiori's app-tile launchpad). It
  lights up as active for its own route, for any of the nine remote routes below, and for the
  per-context `/reports/<context>` Bounded Context Report screens described below.

Both dashboards read one section-oriented envelope from the console-bff
(`GET /console/reports/{wms,wes}?from=&to=`, default trailing 24h) and render each section
with the ui-kit's SVG chart primitives chosen by the section's own `chartKind`. These are
eventually-consistent analytical projections, not live reads, so every card carries a
`FreshnessBadge` — staleness is shown, never hidden. A section whose upstream is degraded
arrives as `available: false` and renders as a single "data unavailable" card; the rest of
the dashboard still shows its real numbers. Only a whole-request failure produces a
dashboard-level error state.

### Bounded Context Report screens (`/reports/<context>`)

Each of the nine bounded contexts also gets its own **Bounded Context Report** screen,
reachable from a "View metrics report" link on its Contexts tile. Unlike the WMS/WES
dashboards above, these read that context's OWN `GET /reports/...` REST endpoint DIRECTLY —
never through console-bff/warehouse-ops-agent — because they render the unaggregated,
context-specific analytical projection each service's own reports reader already serves, not
a cross-service rollup. This is still shell-owned infrastructure, not remote business logic:
a generic read-only analytics envelope, following the same "shell owns cross-cutting
screens" reasoning as Floor/Order-Lifecycle/WMS/WES above.

Every context's report DTO is genuinely different — different domain, different metric
names, different bucket dimensions (see `src/features/context-reports/*.config.tsx` for the
real endpoint path and field names read directly from each context's own
`reports_handler.go`) — so there is deliberately no single shared row/column schema. One
reusable presentational shell, `ContextReportScreen`
(`src/features/context-reports/ContextReportScreen.tsx`), owns the three degradation states
(loading / populated / whole-request error) and the `FreshnessBadge` reading that context's
sibling `/reports/.../freshness` endpoint; each context's own config object is the only place
that maps its real DTO onto the shared `@warehouse/ui-kit` primitives (`Card`, `DataTable`,
`BarChart`, `LineChart`, `FunnelChart`).

Two things every one of these nine screens needs that do not exist in this cluster yet, both
called out explicitly rather than silently assumed (see `src/config.ts`'s own doc comments for
the full detail):

- **Kong routing gap.** Every analytics-enabled chart stands up a separate `<context>-reports`
  Service, but no Kong `Ingress`/`HTTPRoute` rule points `/api/<context>/reports` at it yet —
  today that Service is reachable only in-cluster (console-bff, each context's own MCP server).
  This shell is wired to the CORRECT eventual path/shape; a follow-up infra PR still needs to
  add that route for any of the nine screens to resolve against a live kind cluster.
- **network-fulfillment's whole reports endpoint is unmerged.** Its `/reports/...` REST
  endpoint, `reports_handler.go` and DTO are still open work on a parallel branch as of this PR
  (verified directly against that branch's tree, not assumed) — see
  `src/features/context-reports/networkFulfillment.config.tsx`'s header comment for the
  endpoint path and field names this screen guesses at today, flagged there as unverified and
  needing reconciliation the moment that PR lands.

Everything else (`/order-management`, `/inventory`, `/planning`, `/fulfillment`, `/workforce`,
`/facility`, `/process-path`, `/labor`, `/network-fulfillment`) is a Module Federation remote owned
by that bounded context's own repo, reachable from the Contexts launchpad — this shell only
lazy-loads and hosts them; it never contains their business logic. An unmatched URL renders
the shell's own client-side "Page not found" screen rather than a server 404.

This repo owns no OpenAPI or AsyncAPI spec of its own: this shell has no
domain model to describe (no aggregates, no endpoints it publishes), so there is nothing to
spec here. Each bounded-context service publishes its own OpenAPI (HTTP) and AsyncAPI (Kafka)
definitions in its own repo; `console-bff`'s report-envelope shape is documented in
`warehouse-ops-agent`'s ADR-0002/ADR-0003 rather than as a formal spec, since it is a
console-only read layer, not a public API.

## Study project disclaimer

This repository, and every other repository in the `warehouse-systems` set, is a personal
study project exploring Domain-Driven Design, hexagonal architecture, and micro-frontend
composition patterns. It is not production software and has no support guarantees.

## Architecture

- **Module Federation** (`@module-federation/vite`) — this app is the federation *host*;
  each remote is built and deployed independently by its own bounded-context repo.
- **No shared database, ever** — cross-service views (Order Lifecycle) go through each
  service's own REST API via a thin BFF (`console-bff`, hosted inside `warehouse-ops-agent`),
  never a shared DB.
- **`@warehouse/ui-kit`** — the shared design-tokens + component library every remote and
  this shell consume, so the same domain status renders identically everywhere it appears.

## Local development

Requires `@warehouse/ui-kit` checked out as a sibling directory (`../warehouse-ui-kit`,
built at least once) and each remote's own dev server running on its assigned port:

| Remote | Port | Repo |
|---|---|---|
| order-mgmt-mfe | 5181 | order-management |
| inventory-mfe | 5182 | inventory-storage |
| planning-mfe | 5183 | wes-work-planning |
| fulfillment-mfe | 5184 | fulfillment-execution |
| workforce-mfe | 5185 | workforce-management |
| facility-mfe | 5186 | facility-layout |
| labor-mfe | 5187 | labor-performance |
| process-path-mfe | 5189 | process-path-management |
| network-fulfillment-mfe | 5188 | network-fulfillment |

```bash
# one-time: build the sibling ui-kit
(cd ../warehouse-ui-kit && npm install && npm run build)

npm install
npm run dev          # :5173
npm run typecheck    # tsc -b --noEmit
npm run lint         # oxlint
npm run build

# with the shell + all 8 remote dev servers running, and the 8 backend
# services + BFF reachable at config.json's apiOrigin (Kong):
npm run verify:routes   # headless Playwright smoke check of every route

# needs only the shell's own dev server -- stubs the console-bff report calls:
npm run verify:dashboards
```

`verify:dashboards` covers the three states the report screens have to get right — every
section available (charts draw real geometry), one section `available: false` (that one card
degrades, the others still draw), and a whole-request failure (one dashboard-level error
state) — and writes screenshots to `/tmp/warehouse-console-dashboards`.

The shell fetches `/config.json` before it mounts in **every** mode, including `npm run dev`
(see "One image, many environments" below). The repo does not commit one, so the dev
server answers that request with its HTML fallback and the shell refuses to start with
`Runtime configuration must be JSON, received "text/html"`. For local development create
an untracked `public/config.json` first:

```bash
mkdir -p public && echo '{ "apiOrigin": "http://localhost:8000" }' > public/config.json
```

With that file in place every API call — the Floor, Order Lifecycle and dashboard BFF
calls and the Contexts badges — goes to `<apiOrigin>/api/<context>` (Kong), not to each
service's own dev port. The remotes themselves are still loaded from their dev servers on
the ports above. `verify:dashboards` intercepts the report calls, so it only needs the
file to exist; its values do not matter.

## Deployment topology (kind / localhost)

The shell and every remote are static bundles served by `nginx-unprivileged`
pods. The fleet deliberately splits its two edges onto two independent host
entrypoints, and **neither proxies to the other**:

```
http://localhost        -> Nginx web gateway -> this shell  (/)
                                             -> each remote (/mfes/<context>/)

http://localhost:8000   -> Kong              -> every bounded-context API
                                                (/api/<context>/...)
```

Kong never serves HTML, JavaScript, CSS or fonts. The web gateway never
proxies an API.

Build the image (the ui-kit is a sibling checkout, so it is supplied as a
named build context):

```bash
docker build --build-context uikit=../warehouse-ui-kit \
  -t warehouse/warehouse-console:local .
```

### One image, many environments

The former known gap — `src/config.ts` baking service URLs in at build time —
is closed. `src/runtime-config.ts` fetches `/config.json` (mounted from the
chart's ConfigMap) *before* the app mounts and publishes the validated result
on `window.__WAREHOUSE_CONFIG__`; every remote reads the same object to build
its own API base.

```json
{ "apiOrigin": "http://localhost:8000" }
```

Set it with `runtimeConfig.apiOrigin` in the Helm chart. Validation is strict
and fail-fast: a missing, malformed, or path-carrying origin stops the console
from mounting and says why, rather than rendering a silently broken UI.

Two details worth knowing before changing this:

- `src/main.tsx` imports `./App` **dynamically**, after the config resolves. A
  static import would be hoisted and evaluated first, so `config.ts` would
  read an empty config and throw in production.
- The ConfigMap is mounted with `subPath`, which kubelet does **not**
  live-update, so the Deployment carries a `checksum/runtime-config`
  annotation to roll the pod whenever the value changes.
