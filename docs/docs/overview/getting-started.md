---
id: getting-started
title: Getting Started
sidebar_label: Getting Started
---

# Getting started

## Prerequisites

`@warehouse/ui-kit` checked out as a sibling directory (`../warehouse-ui-kit`,
built at least once), a local `public/config.json` (see
[Runtime configuration](#runtime-configuration-configjson) below) and, for a
full-fleet check, each remote's own dev server running on its assigned port.
These ports apply to `npm run dev` only; a production build loads every
remote from `/mfes/<context>/remoteEntry.js` on the web gateway instead.

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
| capacity-mfe | 5190 | warehouse-planning |
| productmaster-mfe | 5191 | product-master |
| nip-mfe | 5192 | network-inventory-planning |
| inbound-mfe | 5193 | inbound-receiving |

## Run it

```bash
# one-time: build the sibling ui-kit
(cd ../warehouse-ui-kit && npm install && npm run build)

npm install
npm run dev          # :5173
npm run typecheck    # tsc -b --noEmit
npm run lint         # oxlint
npm run build
```

## Verify

```bash
# with the shell + every remote dev server the route list covers (including
# capacity_mfe on :5190) running, and the backend services + BFF reachable
# at config.json's apiOrigin (Kong):
npm run verify:routes

# needs only the shell's own dev server -- stubs the console-bff report calls:
npm run verify:dashboards
```

`verify:routes` is a headless Playwright smoke check of every route,
including that client-side navigation never triggers a full-page reload and
that an unknown route renders the app's own "Page not found" screen (not a
server 404).

`verify:dashboards` covers the three states the report screens have to get
right — every section available (charts draw real geometry), one section
`available: false` (that one card degrades, the others still draw), and a
whole-request failure (one dashboard-level error state) — and writes
screenshots to `/tmp/warehouse-console-dashboards`.

## Runtime configuration (`/config.json`)

The shell resolves its API location at runtime, not at build time:
`src/runtime-config.ts` fetches `/config.json` **before** the app mounts,
validates it, and publishes it on `window.__WAREHOUSE_CONFIG__`, which every
remote also reads to build its own API base.

```json
{ "apiOrigin": "http://localhost:8000" }
```

`apiOrigin` must be a bare origin (scheme + host + port, no path). Every
context is then addressed as `<apiOrigin>/api/<context>` — in the kind
cluster that is Kong on `http://localhost:8000`, a different origin from the
Nginx web gateway on `http://localhost` that serves the shell and the
remotes. Neither edge proxies to the other.

This fetch happens in `npm run dev` too, and the repo does not commit a
`config.json`. Without one the dev server answers with its HTML fallback and
the shell refuses to start (`Runtime configuration must be JSON, received
"text/html"`). Create an untracked one before running the dev server:

```bash
mkdir -p public && echo '{ "apiOrigin": "http://localhost:8000" }' > public/config.json
```

In the cluster the file comes from the Helm chart's `runtimeConfig.apiOrigin`
value (default `http://localhost:8000`), mounted from a ConfigMap and served
by the shell's nginx with `Cache-Control: no-store`.
