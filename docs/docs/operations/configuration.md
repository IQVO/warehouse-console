---
id: configuration
title: Configuration
sidebar_label: Configuration
---

# Configuration

The console is a static bundle, so "configuration" lives in four places, each
read at a different time:

| Where | Read when | Controls |
|---|---|---|
| `/config.json` (`src/runtime-config.ts`) | in the browser, before the app mounts | `apiOrigin`: where every API call goes |
| `vite.config.ts` | at `vite build` / `vite` dev start | where each Module Federation remote is loaded from, shared singletons, dev port |
| `nginx.conf` | by the container's nginx | listen port, `/healthz`, cache headers, SPA fallback |
| `charts/warehouse-console/values.yaml` | at `helm install/upgrade` | `runtimeConfig.apiOrigin`, Service port, probes, replicas, security context |

## Build-time environment variables

There are **none**. The code reads no `VITE_*` key and no custom
`import.meta.env` value; endpoints are deliberately not baked into the image.
The only `import.meta.env` reads are Vite built-ins:

| Key | Read in | Effect |
|---|---|---|
| `import.meta.env.PROD` | `src/config.ts` (lines 219, 227, 234) | `true` in a `vite build` bundle: a missing `apiOrigin` throws `window.__WAREHOUSE_CONFIG__.apiOrigin is required in production` instead of falling back to developer ports |
| `import.meta.env.DEV` | `src/shell/RemoteBoundary.tsx` (line 69) | `true` under `npm run dev`: a remote's error card appends the error message (`This module is unavailable right now: <message>`); production shows only `This module is unavailable right now.` |

The one `process.env` read in the repo is a test script knob, not app
configuration: `scripts/verify-dashboards.cjs` writes its screenshots to
`SHOT_DIR` (default `/tmp/warehouse-console-dashboards`).

## Runtime configuration: `/config.json`

`src/main.tsx` calls `loadRuntimeConfig()` (`src/runtime-config.ts`) **before**
it dynamically imports `./App`, so the config exists before any module that
reads it is evaluated. The loader fetches `/config.json` with
`cache: "no-store"`, validates it and publishes the result on
`window.__WAREHOUSE_CONFIG__`, which every federated remote also reads.

```json
{ "apiOrigin": "http://localhost:8000" }
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `apiOrigin` | string | yes | Kong's origin (scheme + host + port only). Every context API is then addressed as `<apiOrigin>/api/<context>`. A trailing slash is normalised away (`new URL(...).origin`). |

Validation is fail-fast; on any failure the shell renders the plain text
`warehouse-console failed to start: <message>` in `#root` and logs
`warehouse-console failed to start` to the console. The messages, in the
order they are checked:

| Condition | Message |
|---|---|
| HTTP status not 2xx | `Unable to load runtime configuration (HTTP <status>)` |
| `Content-Type` does not contain `json` | `Runtime configuration must be JSON, received "<content-type>" — /config.json is probably missing and nginx served the SPA fallback` |
| body is not an object | `Runtime configuration must be an object` |
| `apiOrigin` missing, not a string, or blank | `Runtime configuration apiOrigin must be a non-empty string` |
| not parseable by `new URL()` | `Runtime configuration apiOrigin must be an absolute URL` |
| scheme other than `http:`/`https:` | `Runtime configuration apiOrigin must use HTTP or HTTPS` |
| carries a username, password, path other than `/`, query or fragment | `Runtime configuration apiOrigin must contain only an origin` |

The repo does not commit a `config.json`; `.gitignore` lists
`public/config.json`, so create it locally (see
[Getting started](../overview/getting-started.md#runtime-configuration-configjson))
without risk of staging it.

### URLs derived from `apiOrigin`

`src/config.ts` resolves these once, at module load:

| Constant | Production value | Used by |
|---|---|---|
| `SERVICE_BASE_URL.<context>` | `<apiOrigin>/api/<context>` for order-management, inventory-storage, wes-work-planning, fulfillment-execution, workforce-management, facility-layout | the Contexts launchpad badges |
| `REPORTS_BASE_URL.<context>` | `<apiOrigin>/api/<context>` for the six above plus labor-performance, process-path-management, network-fulfillment | the `/reports/:context` Bounded Context Report screens (the screen appends `/reports/...`) |
| `BFF_BASE_URL` | `<apiOrigin>/api/warehouse-ops-agent` | Floor (`/daily-brief`), Order Lifecycle, WMS/WES dashboards |
| `CONSOLE_REPORTS_URL.wms` / `.wes` | `<BFF_BASE_URL>/console/reports/wms` / `/wes` | WMS and WES dashboards |

When `window.__WAREHOUSE_CONFIG__` has no `apiOrigin` and the bundle is not a
production build, `config.ts` falls back to fixed developer ports. In the
running app this branch is not reached, because `main.tsx` refuses to mount
without a valid `config.json`; it is what unit tests (which import
`config.ts` without the bootstrap) resolve against.

| Fallback | URL |
|---|---|
| order-management / inventory-storage / wes-work-planning / fulfillment-execution / workforce-management / facility-layout API | `http://localhost:8086` / `8082` / `8083` / `8084` / `8085` / `8081` |
| reports readers: facility-layout, inventory-storage, wes-work-planning, fulfillment-execution, workforce-management, order-management, labor-performance, process-path-management, network-fulfillment | `http://localhost:8101` … `8109`, in that order |
| BFF (warehouse-ops-agent) | `http://localhost:8096` |

## Module Federation remotes (`vite.config.ts`)

`remoteEntry(context, devPort)` picks each remote's entry from the command
line: when `process.argv` contains `build` it is `/mfes/<context>/remoteEntry.js`
(same origin as the shell, served by the Nginx web gateway); otherwise it is
`http://localhost:<devPort>/remoteEntry.js`. Remote discovery is therefore
static: the list is compiled into the shell, and adding a remote means a new
entry here plus a route in `src/App.tsx`.

| Remote key | Container name | Gateway path | Dev port | Shell route |
|---|---|---|---|---|
| `order_mgmt_mfe` | `order_mgmt_mfe` | `/mfes/order-management/` | 5181 | `/order-management/*` |
| `inventory_mfe` | `inventory_mfe` | `/mfes/inventory-storage/` | 5182 | `/inventory/*` |
| `planning_mfe` | `planning_mfe` | `/mfes/wes-work-planning/` | 5183 | `/planning/*` |
| `fulfillment_mfe` | `fulfillment_mfe` | `/mfes/fulfillment-execution/` | 5184 | `/fulfillment/*` |
| `workforce_mfe` | `workforce_mfe` | `/mfes/workforce-management/` | 5185 | `/workforce/*` |
| `facility_mfe` | `facility_mfe` | `/mfes/facility-layout/` | 5186 | `/facility/*` |
| `labor_mfe` | `labor_mfe` | `/mfes/labor-performance/` | 5187 | `/labor/*` |
| `network_fulfillment_mfe` | `netfulfil_mfe` | `/mfes/network-fulfillment/` | 5188 | `/network-fulfillment/*` |
| `process_path_mfe` | `process_path_mfe` | `/mfes/process-path-management/` | 5189 | `/process-path/*` |
| `capacity_mfe` | `capacity_mfe` | `/mfes/warehouse-planning/` | 5190 | `/capacity/*` |
| `productmaster_mfe` | `productmaster_mfe` | `/mfes/product-master/` | 5191 | `/product-master/*` |
| `nip_mfe` | `nip_mfe` | `/mfes/network-inventory-planning/` | 5192 | `/network-inventory/*` |
| `inbound_mfe` | `inbound_mfe` | `/mfes/inbound-receiving/` | 5193 | `/inbound-receiving/*` |
| `slotting_mfe` | `slotting_mfe` | `/mfes/slotting-optimization/` | 5194 | `/slotting/*` |
| `replenishment_mfe` | `replenishment_mfe` | `/mfes/pick-face-replenishment/` | 5196 | `/pick-face-replenishment/*` |
| `task_interleaving_mfe` | `task_interleaving_mfe` | `/mfes/task-interleaving/` | 5197 | `/task-interleaving/*` |

Note `network_fulfillment_mfe`: the shell imports it under that key, but the
remote's federation container is named `netfulfil_mfe`.

Other federation settings:

| Setting | Value | Why |
|---|---|---|
| `name` | `warehouse_console` | host container name |
| `shareStrategy` | `loaded-first` | keeps the shell's already-loaded React for every singleton; `version-first` let a remote with a newer React win and produced `Cannot read properties of null (reading 'useRef')` and a blank console |
| `shared` | `react` `^19.2.8`, `react-dom` `^19.2.8`, `react-router-dom` `^7.18.3`, `@warehouse/ui-kit` — all `singleton: true` | one instance across shell and remotes |
| `base` | `/` | the shell is served at the gateway root |
| `server.port` / `preview.port` | `5173`, `strictPort: true`, `cors: true` | dev and preview port |
| `build.target` / `build.modulePreload` | `esnext` / `false` | |

## Nginx (`nginx.conf`)

The image's nginx (`nginxinc/nginx-unprivileged`) listens on **8080**; it
serves only the shell and never proxies to a remote or an API.

| Location | Behaviour | `Cache-Control` |
|---|---|---|
| `= /healthz` | returns `200 ok` (text/plain), access log off | — |
| `= /config.json` | serves the mounted file; `404` if absent (never the SPA fallback) | `no-store` |
| `= /index.html` | entry document | `no-cache` |
| `/assets/` | hashed bundle assets; `404` if absent | `public, max-age=31536000, immutable` |
| `/` | `try_files $uri $uri/ /index.html` — unknown paths render the app's own Page-not-found screen | — |

## Helm chart values (`charts/warehouse-console/values.yaml`)

| Key | Default | Meaning |
|---|---|---|
| `runtimeConfig.enabled` | `true` | render the `<fullname>-runtime-config` ConfigMap and mount it at `/usr/share/nginx/html/config.json` (`subPath`) |
| `runtimeConfig.apiOrigin` | `http://localhost:8000` | written into `config.json`; the template fails (`required`) when empty and `enabled` is true |
| `replicaCount` | `1` | ignored when `autoscaling.enabled` |
| `image.repository` / `image.tag` / `image.pullPolicy` | `ghcr.io/iqvo/warehouse-console` / `""` (falls back to `Chart.appVersion`, `0.1.0`) / `IfNotPresent` | container image |
| `service.type` / `service.port` / `service.targetPort` | `ClusterIP` / `80` / `8080` | the Service listens on 80 and targets the container's `http` port 8080 |
| `ingress.enabled` | `false` | optional Ingress (`warehouse-console.local`, path `/`) |
| `autoscaling.enabled` / `minReplicas` / `maxReplicas` / `targetCPUUtilizationPercentage` | `false` / `1` / `5` / `80` | HPA |
| `livenessProbe` | `GET /healthz` on `http`, delay 5 s, period 10 s | |
| `readinessProbe` | `GET /healthz` on `http`, delay 3 s, period 5 s | |
| `resources` | requests 100m / 128Mi, limits 500m / 256Mi | |
| `podSecurityContext` | `runAsNonRoot: true`, `runAsUser: 101`, `fsGroup: 101` | nginx-unprivileged's uid |
| `securityContext` | `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, drop `ALL` | nginx writes only to the `emptyDir` volumes at `/var/cache/nginx`, `/var/run`, `/tmp` |
| `serviceAccount.create` | `true` | |
| `podAnnotations`, `podLabels`, `nodeSelector`, `tolerations`, `affinity`, `imagePullSecrets`, `nameOverride`, `fullnameOverride` | empty | standard |

The Deployment carries a `checksum/runtime-config` annotation computed from
the ConfigMap template, so changing `apiOrigin` rolls the pods (kubelet does
not live-update a `subPath` mount).

The chart defaults `image.repository` to `ghcr.io/iqvo/warehouse-console`,
the name CI publishes (`src/packaging.test.ts` fails if the two diverge).
`image.tag` still defaults to `Chart.appVersion`; set it to a published tag
(`latest`, `<short-sha>` or `vX.Y.Z`). See the [Runbook](./runbook.md).
