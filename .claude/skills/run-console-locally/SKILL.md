---
name: run-console-locally
description: Start the console shell dev server and prove it works - the untracked public/config.json, the sibling ui-kit, remote dev ports, backend reachability through Kong, and the verify:routes / verify:dashboards Playwright checks. Use when the console will not start ("Runtime configuration must be JSON"), a screen shows "Failed to fetch", a remote is missing in dev, npm ci or typecheck cannot resolve @warehouse/ui-kit, or before claiming a routing or remote-hosting change works.
---

# Run the console locally and verify it

## 1. Preconditions (each has a distinct failure message)

**ui-kit sibling.** `package.json` depends on `@warehouse/ui-kit` as `file:../warehouse-ui-kit`, resolved relative to THIS checkout, and its `dist/` must be built. From a git worktree the sibling path is the worktree's parent directory, which may not contain a ui-kit; create or symlink one, or `npm ci` / `tsc` will not resolve it.

```bash
(cd ../warehouse-ui-kit && npm install && npm run build)   # once
npm ci
```

**`public/config.json` (untracked, mandatory).** The shell fetches `/config.json` before mounting in EVERY mode, including `npm run dev`; nothing is committed, so without the file Vite's HTML fallback answers and the shell stops with `Runtime configuration must be JSON, received "text/html"`.

```bash
mkdir -p public && echo '{ "apiOrigin": "http://localhost:8000" }' > public/config.json
```

`apiOrigin` is an origin only (no path, query or credentials - `validateRuntimeConfig` in `src/runtime-config.ts` rejects them) and must be the KONG origin (`:8000`), never the Nginx web gateway on `:80`. Keep the file untracked (`git status` must not list it).

## 2. Start things

```bash
npm run dev        # shell on :5173 (strictPort: it fails rather than picking another port)
```

Remote dev servers are started from each remote's own repo (`web/`, `npm run dev`) on the ports in `vite.config.ts` and the README table: 5181 order-management, 5182 inventory-storage, 5183 wes-work-planning, 5184 fulfillment-execution, 5185 workforce-management, 5186 facility-layout, 5187 labor-performance, 5188 network-fulfillment, 5189 process-path-management, 5190 warehouse-planning (capacity_mfe), 5191 product-master (productmaster_mfe), 5192 network-inventory-planning (nip_mfe). Start only the ones you need; an absent remote just shows its inline "unavailable" card.

Never trust `ps` alone. `npm run dev` also spawns Module Federation DTS helper workers that survive their parent and look like a running server. Prove each port answers:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5182/remoteEntry.js   # 200 = remote is federatable
```

`[ Module Federation DTS ] Failed to download types archive` warnings for remotes that are not up are harmless. `Failed to load script resources #RUNTIME-008` AFTER curl returned 200 for that remote is a real problem; if curl was still failing when it was logged, ignore it and reload.

## 3. Backends: "Failed to fetch" inside a rendering screen

With `apiOrigin` set, every call goes to `<apiOrigin>/api/<context>` (`src/config.ts`). Without a cluster, Kong on `:8000` does not exist and data panels fail while the chrome renders fine; that is a missing backend, not a frontend bug.

- Against the kind cluster, confirm Kong answers first (`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/facility-layout/sites`).
- If you port-forward a service yourself, forward the OLTP POD, not the Service: a Service also fronts the projector/reports/MCP pods and `kubectl port-forward svc/...` can land on the wrong one and return a plain 404 on real endpoints (`/healthz` 200 does not prove it is the right pod).

```bash
kubectl get pods -n warehouse-systems --no-headers -o custom-columns=:metadata.name | grep -E "^facility-layout-[a-z0-9]+-[a-z0-9]+$"
kubectl port-forward pod/<oltp-pod> 8081:8080
```

- Without a `config.json` apiOrigin, `src/config.ts` falls back to per-service developer ports (8081-8086, reports 8101-8109, BFF 8096) only in a non-production build. That mode is for standalone service dev; the documented path is `apiOrigin` via Kong.
- Per-context report screens call `/api/<context>/reports/...`, which 404s on the cluster until Kong routes it (documented in `src/config.ts`); do not "fix" that in the shell.

## 4. The two verification scripts

```bash
npm run verify:dashboards   # needs ONLY `npm run dev`; the script stubs console-bff report calls
npm run verify:routes       # needs the shell + remote dev servers + reachable backends
```

- `scripts/verify-dashboards.cjs` checks all-sections-available, one-section `available: false`, and whole-request failure for `/wms-dashboard` and `/wes-dashboard`; screenshots go to `/tmp/warehouse-console-dashboards` (override with `SHOT_DIR`). Only the existence of `public/config.json` matters, not its values.
- `scripts/verify-all-routes.cjs` loads each route headlessly, asserts expected text and that `nav a` renders, and asserts nav clicks are client-side (a full page reload means ui-kit links lost the `NavigationProvider` from `src/App.tsx`). It exits non-zero on page errors or failed requests. It hardcodes `http://localhost:5173`, and its route list is maintained by hand.
- Both need Playwright browsers (`npx playwright install chromium` once).
- Not every change needs `verify:routes`, but a navigation/routing/remote-hosting change must not be called done on unit tests alone.

## 5. What does not need any of this

`make check-fast` (lint + typecheck), `npm test` (vitest + MSW, no network; `onUnhandledRequest: "error"` in `src/test/setup.ts`) and `npm run build` need `node_modules` and the ui-kit but not `config.json`, remotes or a cluster. If `make check-fast` fails with missing modules, it is `npm ci` (and the ui-kit sibling), not the code.

## Checking the production topology without a cluster

`http://localhost` (Nginx) serves the shell and `/mfes/<context>/`; `http://localhost:8000` (Kong) serves APIs; neither proxies to the other (`nginx.conf`, `.claude/rules/runtime-config-and-edge.md`). A production build (`npm run build`, `npm run preview` on :5173) addresses remotes at `/mfes/<context>/remoteEntry.js`, so remotes will not load under preview without a gateway in front.
