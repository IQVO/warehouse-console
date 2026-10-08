# Project: Warehouse Console (the shell — not a bounded context)

The React SPA shell for the `warehouse-systems` micro-frontend fleet. It owns
routing, top navigation, the shared design-system consumption, and the screens no
single bounded context owns: Floor (`/`, built on `warehouse-ops-agent`'s
`GET /daily-brief`), Order Lifecycle (`/order-lifecycle`), the WMS/WES report
dashboards (`/wms-dashboard`, `/wes-dashboard`) and per-context report screens
(`/reports/<context>`). The fifth nav destination, Contexts (`/contexts`), is the
launchpad into the twelve bounded-context **remotes** (`/order-management`,
`/inventory`, `/planning`, `/fulfillment`, `/workforce`, `/facility`,
`/process-path`, `/labor`, `/network-fulfillment`, `/capacity`, `/product-master`, `/network-inventory`). Each remote is owned and
deployed by its own repo; this shell only lazy-loads and hosts them. See ADR-0001
in `docs/docs/adr/`.

Domain model source of truth: `/Users/claudioed/docs/amazon-fulfillment-ddd.md` and
`/Users/claudioed/warehouse-systems-ddd.md`. This repo models no bounded context:
no aggregates, no domain events, no persistence.

## Strategic classification (read before writing code)

This is the fleet's **shared composition root**: a Module Federation **host** plus a
thin read layer for the cross-cutting concerns no single remote can answer. For
Order Lifecycle and the WMS/WES dashboards it is a **downstream Conformist** to
`warehouse-ops-agent`'s `console-bff`: it renders whatever shape the BFF publishes
and does not reinterpret domain meaning. **No shared database, ever**: every
cross-service view goes through a REST API.

## Architecture (NON-NEGOTIABLE)

```
src/
  shell/            RemoteBoundary (lazy+Suspense+error boundary), RouterLink, useDocumentTitle
  features/         floor/ order-lifecycle/ wms-dashboard/ wes-dashboard/ reports/
                    contexts/ context-reports/ not-found/
  runtime-config.ts Fetches + validates /config.json ({ apiOrigin }) BEFORE the app mounts
  config.ts         Every API base = <apiOrigin>/api/<context> (Kong)
  main.tsx          loadRuntimeConfig() then a DYNAMIC import of ./App
  test/             MSW server + test setup
```

- No remote's business logic may live here, and no direct DB access.
- `lazy()` for each remote MUST be created once at module scope in `src/App.tsx`,
  never inside a render function (remounting re-fetches the remote and loses its
  state), and rendered through `RemoteBoundary`.
- Keep `vite.config.ts` in object form (never the callback form): `vitest.config.ts`
  merges it and a callback export kills the whole test suite.
- `src/main.tsx` MUST import `./App` dynamically after the runtime config loads.
- Shared singletons `react`, `react-dom`, `react-router-dom`, `@warehouse/ui-kit`
  (with `shareStrategy: "loaded-first"`): do not change casually.
- `@warehouse/ui-kit` (`file:../warehouse-ui-kit`, a sibling checkout) for every
  design-token/component need; never hand-roll a component the kit provides.
- Alarms and thresholds come from the backend, never from the shell. Show staleness
  (`FreshnessBadge`) and a missing reading as "—", never a calm zero.

Details load automatically when you touch the matching files:
`.claude/rules/mfe-remotes.md` (federation host contract, remote pitfalls),
`.claude/rules/runtime-config-and-edge.md` (config.json, nginx, Docker, Helm, the
two gateways) and `.claude/rules/cross-cutting-screens.md` (the screens' rules).

## Runtime configuration and the edge (summary)

One image serves any environment: `apiOrigin` (Helm `runtimeConfig.apiOrigin`,
default `http://localhost:8000` = Kong) is mounted as `/config.json` and fetched
before mount; validation is fail-fast. No `config.json` is committed: for
`npm run dev` create an untracked `public/config.json` or the shell refuses to
start. Nginx (`http://localhost`) serves the shell and remotes at `/mfes/<context>/`;
Kong (`http://localhost:8000`) serves every API; neither proxies to the other, and
`apiOrigin` must be the Kong origin.

## Tech and commands

React 19, TypeScript (strict, `verbatimModuleSyntax`), Vite 8, `react-router-dom` v7
(client-side only), oxlint, vitest + Testing Library + MSW, Playwright for the smoke
scripts. Packaging: `Dockerfile` (Node build, `nginx-unprivileged` on 8080) and
`charts/warehouse-console/` (Helm).

| Command | What it does |
|---|---|
| `make check-fast` | oxlint + `tsc -b --noEmit` (the agent Stop-hook gate) |
| `make check-all` | lint, typecheck, test, build (the CI sensors) |
| `npm test` | vitest; run whenever you touch `src/` |
| `npm run dev` | shell on :5173 (needs `public/config.json`) |
| `npm run verify:dashboards` | Playwright; only the shell dev server, BFF calls stubbed |
| `npm run verify:routes` | Playwright; shell + remote dev servers + reachable backends |
| `make guide-lint` | lint these agent guides (blocking in CI) |

## Skills (`.claude/skills/`)

- `register-console-remote`: add or rename a remote (vite.config.ts, App.tsx route,
  Contexts tile, verify script, README/docs).
- `run-console-locally`: ui-kit sibling, `config.json`, ports, backends,
  verify:routes / verify:dashboards.
- `add-console-screen`: build or change a shell-owned screen or report screen with
  the ui-kit and MSW tests.

## Definition of done

- `make check-fast`, `npm test` and `npm run build` are green.
- New screens/behaviour get a component test (Testing Library + MSW) following
  `src/features/*/*.test.tsx`.
- Before claiming a navigation/routing/remote-hosting change works end to end, run
  `npm run verify:routes` (or exercise it in a browser): Module Federation and
  routing failures often only show up integrated, never in unit tests.
- `README.md` stays accurate: run steps, the remote port table, `verify:*`
  preconditions.

<!-- harness:scoped-rules:start (generated by tools/migrate_v3.py in warehouse-harness-template; do not hand-edit) -->
## Scoped rules and harness

Claude Code loads each rule below automatically when you touch the matching paths. OpenCode and Codex do NOT: read the rule BEFORE editing matching files.

Hooks (`scripts/harness/hook.py`, wired for Claude Code, Codex and OpenCode) block pushes to develop/main, `--no-verify`, bare `rm -rf`, and edits to generated files, and feed gofmt/vet findings back after each edit. Before saying "done" run `make check-fast`; the full gate is `make check-all`. `HARNESS_OFF=1` disables the hooks when debugging the harness itself.
<!-- harness:scoped-rules:end -->
