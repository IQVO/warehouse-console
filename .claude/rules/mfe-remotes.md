---
paths:
  - "vite.config.ts"
  - "vitest.config.ts"
  - "src/App.tsx"
  - "src/shell/**"
  - "scripts/verify-all-routes.cjs"
---
# Module Federation host rules and remote pitfalls (console-side)

## Host contract (this app is the Module Federation host)

`@module-federation/vite` wires thirteen remotes in `vite.config.ts`
(`order_mgmt_mfe`, `inventory_mfe`, `planning_mfe`, `fulfillment_mfe`,
`workforce_mfe`, `facility_mfe`, `process_path_mfe`, `labor_mfe`,
`network_fulfillment_mfe`, `capacity_mfe`, `productmaster_mfe`, `nip_mfe`, `inbound_mfe`), each built and deployed independently by its own
repo. Under `npm run dev` they load from their dev ports (5181-5193, see the
README port table); in a production build from `/mfes/<context>/remoteEntry.js`,
the path the Nginx web gateway on `http://localhost` serves each remote at.

- Keep `vite.config.ts` in object form (section 1 below). It reads `process.argv`
  for the build flag instead of using the callback form.
- Shared singletons: `react`, `react-dom`, `react-router-dom`,
  `@warehouse/ui-kit`, so a version mismatch fails loudly rather than
  double-loading React. `shareStrategy: "loaded-first"` is deliberate: with the
  default version-first a remote shipping a newer react than the shell makes the
  shell's react-dom render against another bundle's react (null dispatcher,
  blank console). Do not change it casually.
- The `lazy()` for each remote MUST be created once at module scope in
  `src/App.tsx`, never inside a render function: remounting a remote re-triggers
  its Module Federation fetch and loses its state (see the doc comment in
  `src/shell/RemoteBoundary.tsx`). Always render a remote through
  `RemoteBoundary`.
- No remote's business logic may live in this repo.
- To add or rename a remote follow the `register-console-remote` skill; a new
  route also goes into `scripts/verify-all-routes.cjs`.

## Remote-side pitfalls

These are pitfalls this shell has already hit that belong to the
remote-hosting side of the contract, not covered elsewhere in this repo's
docs yet.

## 1. `vite.config.ts` in a remote must stay in object form

If a remote's `vite.config.ts` is ever converted to the callback form
(`defineConfig(({ command }) => ({...}))`) to compute a deployment `base`,
that remote's `vitest.config.ts` — which does `mergeConfig(viteConfig,
defineConfig({...}))` — throws `Error: Cannot merge config in form of
callback` and kills its entire test suite. This shell only ever consumes
remotes as built artifacts, but when debugging "why did this remote's CI
`web` job go red on an unrelated change," check for this first before
assuming the shell's own wiring broke.

## 2. A remote's `remoteEntry.js` being tiny and relative is correct

A built remote's `dist/remoteEntry.js` under a `/mfes/<context>/` base is a
~144-byte file containing a RELATIVE re-export
(`./assets/virtual_mf-REMOTE_ENTRY_ID...js`), not an absolute
`/mfes/<context>/`-prefixed import. That is expected — `dist/index.html`
carries the absolute URLs, and every JS chunk resolves relative to
wherever `remoteEntry.js` was actually fetched from (origin-relative
resolution, via `new URL("../" + e, import.meta.url)`), which is exactly
what a path-mounted remote needs. If a remote "isn't loading" and the
`remoteEntry.js` for it looks suspiciously small/relative, that is NOT the
bug — check the actual fetched URL and the browser console's network tab
instead of "fixing" the remote's `base` config.

## 3. Selector collisions mean the wrong pod can answer a probe

Every backend service chart's `selectorLabels` helper historically emitted
only `app.kubernetes.io/name` + `app.kubernetes.io/instance`, identical
across a service's OLTP/MCP/projector/reports pods — so a request routed
"to" a service's OLTP endpoint could be answered by its reports pod
instead (verified live via response headers). This has been fixed
fleet-wide (charts now scope by `app.kubernetes.io/component` too, and
`warehouse-infra`'s CI runs a selector-collision conformance check), but
if a console screen shows implausible/stale data from a specific backend
and everything else checks out, confirm which actual pod answered via
`kubectl get endpointslices -l kubernetes.io/service-name=<svc>` before
assuming this shell's fetch/caching logic is at fault.

## 4. The localhost edge is two independent gateways, not one

`http://localhost` (Nginx) serves this shell and every remote's static
assets at `/mfes/<context>/`; `http://localhost:8000` (Kong) serves every
backend REST API at `/api/<context>`. Neither proxies to the other — this
is a deliberate, reviewed split (`warehouse-infra/docs/exposure/
localhost-edge-topology.md`), not a gap. The `apiOrigin` that `src/runtime-config.ts` reads from
`/config.json` (and `src/config.ts` builds every API URL from) must point at
the Kong origin, never at Nginx's.
