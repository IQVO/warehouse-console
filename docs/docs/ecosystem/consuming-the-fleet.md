---
id: consuming-the-fleet
title: Consuming the fleet
sidebar_label: Consuming the fleet
---

# Consuming the fleet

If you are adding a new remote to the console, or changing how an existing
one is hosted, here is what this shell expects from a bounded-context repo.

## To be hosted as a remote

1. A Vite + `@module-federation/vite` **remote** config exposing an
   `./App` entry, built and served independently (its own `package.json`,
   build, and dev server).
2. A stable dev port, added to the port table in
   [Getting started](../overview/getting-started.md), and a production build
   whose Vite `base` is `/mfes/<context>/`, packaged as its own nginx image
   so the web gateway can serve it at that path.
3. `react`, `react-dom`, `react-router-dom`, and `@warehouse/ui-kit` declared
   as shared singletons with matching version ranges — a mismatch fails
   loudly rather than double-loading React.
4. No dependency on any other bounded context's storage or API from inside
   the remote — a remote talks only to its own service's REST API, at
   `window.__WAREHOUSE_CONFIG__.apiOrigin` + `/api/<context>`. It must not
   bake an API URL into its build.

Once those are in place, this shell adds one entry to
`src/remotes-manifest.json` (name/container, `/mfes/<context>/` path, dev
port, route prefix, label). The federation remotes map in `vite.config.ts`,
the route and its nav prefix in `App.tsx`, and the `verify:routes` entry are
all DERIVED from that one manifest, so they cannot drift. Only two more
things are hand-added: one static `lazy()` import in
`src/shell/remoteComponents.ts` (Vite resolves `import()` at build time, so
the specifier must be a literal), and a `LaunchTile` on the Contexts screen.
The remote also has to be added to `warehouse-infra`'s `frontend_remotes`
map, or the web gateway will never serve it. See
[Module Federation](../architecture/module-federation.md) for the exact rule
around where `lazy()` may be called.

## To back a cross-cutting screen

Floor, Order Lifecycle and the WMS/WES dashboards are answered by
`warehouse-ops-agent` (`GET /daily-brief` and the `console-bff` routes), not
by this shell directly. A service
participates in those screens by being one of the endpoints `console-bff`
fans out to — that wiring lives in `warehouse-ops-agent`, not here. See
[Cross-cutting screens](../architecture/cross-cutting-screens.md).
