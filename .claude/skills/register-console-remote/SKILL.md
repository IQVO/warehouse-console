---
name: register-console-remote
description: Wire a new (or renamed) Module Federation remote into the console shell - federation entry in vite.config.ts, a module-scope lazy() plus route in src/App.tsx, the Contexts launchpad tile, verify:routes coverage, README port table and docs. Use when a bounded-context repo ships a new web/ micro-frontend, when a remote's dev port or federation name changes, or when a remote route 404s or white-screens in the shell.
---

# Register a remote in the console shell

The shell only HOSTS remotes; the remote itself is built and deployed from its own bounded-context repo. A remote is "registered" here in six places. Do all of them in ONE PR in this repo; never build the remote inside this repo.

## Step 0: get the three facts from the remote's own repo

Do not guess; read them from `<context repo>/web/vite.config.ts`:

1. **Federation `name`** (e.g. `netfulfil_mfe`) - what the remote calls itself.
2. **Dev port** (`server.port`, e.g. `5188`). Ports are reserved by the owning chart, so check for a collision first:

```bash
grep -rn "corsAllowedOrigins" ../*/charts/*/values.yaml
```

   A chart may already reserve a port for a remote that does not exist yet (`labor-performance` reserved 5187, `process-path-management` 5189, `network-fulfillment` 5188). Use that port, not "the next free number".
3. **Gateway path** `/mfes/<context>/` - the context's repo name (`network-fulfillment`, `labor-performance`, ...). This must match what warehouse-infra's Nginx web gateway serves.

The remote must expose `./App` and set its production `base` to `/mfes/<context>/` while keeping its own `vite.config.ts` in object form (see `.claude/rules/mfe-remotes.md`).

## The six edits

1. **`vite.config.ts`** - add a `federation.remotes` entry using the `remoteEntry(context, devPort)` helper. The object KEY (`network_fulfillment_mfe`) is the import specifier prefix used in `src/App.tsx`; the `name:` field is the remote's own federation name (`netfulfil_mfe`) and the two may legitimately differ. A wrong `name` fails at runtime only, with a Federation RUNTIME error, not at build time. Do not touch `shareStrategy: "loaded-first"` or the `shared` singletons.
2. **`src/App.tsx`** - three additions:
   - a `lazy(() => import("<key>/App"))` constant at MODULE SCOPE with the existing `// @ts-expect-error` comment above it. Never create it inside `Shell` or any render function: it remounts the remote on every navigation and loses its state (rationale in `src/shell/RemoteBoundary.tsx`).
   - a `<Route path="/<slug>/*" element={<RemoteBoundary label=... component=... />} />` placed BEFORE the `path="*"` NotFound route. The `/*` is required so the remote's own sub-routes resolve.
   - the `/<slug>` prefix in `REMOTE_PREFIXES`, otherwise the "Contexts" nav item does not light up while the remote is open. `isUnder` is an anchored match, so `/inventory` will not capture `/inventory-audit`.
3. **`src/features/contexts/ContextsScreen.tsx`** - add a `ContextTile` (`context=` is the repo name, `href=` is `/<slug>`). A tile gets a "View metrics report" link automatically only if the context is in `REPORT_ROUTES` (`src/features/context-reports/registry.ts`).
4. **`scripts/verify-all-routes.cjs`** - add `{ path: "/<slug>", label: ..., expect: /\S/ }` to `routes`. Check this on every registration: the list is not kept in sync automatically (`/network-fulfillment` is not in it today).
5. **`README.md`** - the remote port table under "Local development". Update the SAME PR.
6. **`docs/docs/architecture/module-federation.md`** - the diagram, the gateway-path list and the remote count. These counts drift (the doc still says eight remotes while `vite.config.ts` has nine); fix what you touch.

If the remote also gets a Bounded Context Report screen, that is a separate shell-owned feature: see the `add-console-screen` skill.

## Verify

```bash
make check-fast          # oxlint + tsc -b --noEmit
npm test
npm run build            # tsc -b && vite build; remotes are NOT fetched at build time
```

Build success proves nothing about the remote. For the real proof run the remote's dev server and the shell together and follow the `run-console-locally` skill (`curl` the remote's `remoteEntry.js`, then `npm run verify:routes`).

## Pitfalls specific to this step

- A remote that renders in dev but is blank behind the gateway: the production entry is `/mfes/<context>/remoteEntry.js` (same origin as the shell, no CORS). Check the URL actually fetched before editing the remote's `base`; a tiny relative `remoteEntry.js` is normal (`.claude/rules/mfe-remotes.md`).
- A remote that is down must not take the console down: `RemoteBoundary` shows an inline "unavailable" card. Always go through it; never render a remote component directly in a `<Route>`.
- "Failed to fetch" INSIDE a remote that otherwise renders is a backend/CORS/`apiOrigin` problem, not a federation problem. The remote reads the same `window.__WAREHOUSE_CONFIG__.apiOrigin` as the shell (`src/runtime-config.ts`).
- Do not add business logic, API clients or domain types for the remote to this repo.
