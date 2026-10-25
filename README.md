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
  lights up as active for its own route and for any of the eight remote routes below.

Both dashboards read one section-oriented envelope from the console-bff
(`GET /console/reports/{wms,wes}?from=&to=`, default trailing 24h) and render each section
with the ui-kit's SVG chart primitives chosen by the section's own `chartKind`. These are
eventually-consistent analytical projections, not live reads, so every card carries a
`FreshnessBadge` — staleness is shown, never hidden. A section whose upstream is degraded
arrives as `available: false` and renders as a single "data unavailable" card; the rest of
the dashboard still shows its real numbers. Only a whole-request failure produces a
dashboard-level error state.

Everything else (`/order-management`, `/inventory`, `/planning`, `/fulfillment`, `/workforce`,
`/facility`, `/process-path`, `/labor`) is a Module Federation remote owned by that bounded
context's own repo, reachable from the Contexts launchpad — this shell only lazy-loads and
hosts them; it never contains their business logic. An unmatched URL renders the shell's own
client-side "Page not found" screen rather than a server 404.

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

# against the deployed kind product (Nginx assets on :80, Kong APIs on :8000):
npm run verify:cluster
```

`verify:routes` and `verify:dashboards` accept `BASE_URL` and `API_ORIGIN`; their defaults
remain `http://localhost:5173` and `http://localhost:8000`. `verify:cluster` pins the
production split edge and checks deep-link refresh, all eight context-specific remote
screens, federation entry/chunk origins, Kong-only API traffic, real WMS/WES reports,
client-side navigation, browser/request failures, and an in-browser remote-entry outage
that exercises `RemoteBoundary` without changing the cluster. The report gate requires
the exact seven dashboard sections, non-zero series, and projection freshness no older
than `MAX_REPORT_FRESHNESS_SECONDS` (default: 300), so run it after the ecosystem
analytics setup has created the run-scoped facts. Set `ARTIFACT_DIR` to choose where
HARs, request logs, console logs, screenshots and failure traces are written (default:
`/tmp/warehouse-console-cluster-verify`).

Cluster CI jobs can invoke the same gate in the runner that owns the kind cluster with
the checked-in composite action. The caller must first check out `warehouse-console`
and `warehouse-ui-kit` as siblings and deploy/seed the cluster; the action deliberately
does not mutate cluster workloads:

```yaml
- uses: claudioed/warehouse-console/.github/actions/verify-cluster@<warehouse-console-sha>
  with:
    working-directory: warehouse-console
    artifact-name: cluster-browser-${{ github.run_id }}
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
