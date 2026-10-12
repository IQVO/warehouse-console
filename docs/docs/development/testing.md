---
id: testing
title: Testing
sidebar_label: Testing
---

# Testing

The console has no domain model, database or message broker, so its test
pyramid is short: fast unit and component tests under Vitest, two Playwright
smoke scripts run by hand against a dev server, and static gates (oxlint,
`tsc`, the agent-guide and repo lints) in CI. There are no integration,
contract, BDD or mutation suites in this repo.

| Layer | Tooling | How to run | Runs in CI? |
|---|---|---|---|
| Unit + component | Vitest 5, jsdom, Testing Library, msw | `make test` / `npm test` | yes (`test`) |
| Type check | `tsc -b --noEmit` | `make typecheck` / `npm run typecheck` | yes (`typecheck`) |
| Lint | oxlint (`.oxlintrc.json`) | `make lint` / `npm run lint` | yes (`lint`) |
| Production build | `tsc -b && vite build` | `make build` / `npm run build` | yes (`build`) |
| Route smoke | Playwright (`scripts/verify-all-routes.cjs`) | `npm run verify:routes` | no |
| Dashboard degradation | Playwright (`scripts/verify-dashboards.cjs`) | `npm run verify:dashboards` | no |
| Agent-guide / repo config lints | Python stdlib (`scripts/harness/`) | `make guide-lint`, `make harness-test`, `python3 scripts/harness/repo_lint.py` | yes (`guide-lint`) |
| Docs site | Docusaurus | `npm ci`, `npm run typecheck`, `npm run build` in `docs/` | yes (`docs`) |

`make check` runs `lint typecheck test build` in that order; `make check-all`
is the same; `make check-fast` is `lint typecheck` (the agent Stop hook's
quick gate).

All the npm scripts need `@warehouse/ui-kit` checked out and **built** at
`../warehouse-ui-kit` (`package.json` depends on `file:../warehouse-ui-kit`),
which is also how CI lays out its workspace.

## Unit and component tests (Vitest)

`vitest.config.ts` merges the app's own `vite.config.ts` and adds:

- `environment: "jsdom"`, `globals: true`, `css: false`,
  `include: ["src/**/*.test.{ts,tsx}"]`, `setupFiles: ["./src/test/setup.ts"]`;
- `resolve.dedupe: ["react", "react-dom"]`, because the ui-kit sibling has its
  own installed React and its `useFetch` would otherwise run against a second
  React instance ("Invalid hook call");
- an alias mapping every `<name>_mfe/App` import to
  `src/test/remoteUnavailable.ts`, a stub that throws on evaluation. A
  test that renders `App` therefore sees every remote fail exactly the way an
  unreachable `remoteEntry.js` does, which is what `RemoteBoundary` must handle.

### Mocks

`src/test/mocks/server.ts` is one shared msw `setupServer()` with **no**
default handlers. `src/test/setup.ts` starts it with
`onUnhandledRequest: "error"`, resets handlers and unmounts (`cleanup()`)
after each test, and closes it at the end. A test registers the endpoints it
needs with `server.use(http.get(...))`; a screen that starts calling an
unstubbed endpoint fails the test instead of quietly rendering its error
state. Build URLs from the same constants the code uses
(`SERVICE_BASE_URL`, `BFF_BASE_URL`, `REPORTS_BASE_URL`) — under Vitest they
resolve to the developer-port fallbacks, since no `config.json` is loaded.

### What is covered (95 tests in 11 files, all passing on this branch)

| File | Tests | What it pins |
|---|---|---|
| `src/runtime-config.test.ts` | 15 | `validateRuntimeConfig` accepts http/https origins and rejects non-objects, missing/blank/non-string/relative origins, non-HTTP schemes, paths, credentials and queries; `loadRuntimeConfig` fetches with `no-store`, and never publishes a non-2xx or non-JSON response |
| `src/config.test.ts` | 5 | URL resolution under an `apiOrigin`, the production "missing origin" error, developer-port fallbacks |
| `src/remotes-registration.test.ts` | 15 | static checks on `vite.config.ts`, `src/App.tsx` and `scripts/verify-all-routes.cjs` for `capacity_mfe`, `productmaster_mfe`, `nip_mfe`, `inbound_mfe`: container name, gateway path, dev port uniqueness, module-scope `lazy()`, splat route, verify:routes coverage |
| `src/App.test.tsx` | 22 | the `/capacity/*`, `/product-master/*`, `/network-inventory/*`, `/inbound-receiving/*` routes render the "unavailable" card when the remote is down, keep "Contexts" active, and do not capture look-alike prefixes |
| `src/shell/RouterLink.test.tsx` | 5 | client-side navigation for nav items and launch tiles, the skip link, external URLs left to the browser |
| `src/features/floor/FloorScreen.test.tsx` | 8 | per-path facts, no-signal vs zero, severity ordering, collapsed evidence, backend-flag alarms, retry, last-good data kept on a failed refresh |
| `src/features/contexts/ContextsScreen.test.tsx` | 4 | the Capacity Planning, Product Master, Network Inventory and Inbound Receiving tiles |
| `src/features/order-lifecycle/toTimelineSteps.test.ts` | 9 | unavailable vs pending stages, every task of a type, sealed vs labeled, line collapsing, cancelled orders |
| `src/features/context-reports/ContextReportScreen.test.tsx` | 4 | loading, populated + freshness badge, whole-request error, freshness-only failure |
| `src/features/context-reports/facilityLayout.config.test.tsx` | 4 | loading, populated, error, empty table |
| `src/features/context-reports/fulfillmentExecution.config.test.tsx` | 4 | loading, populated, error, empty table |

Not covered by unit tests: `WmsDashboardScreen`, `WesDashboardScreen`,
`ReportDashboard`, `OrderLifecycleScreen` (only its mapping function),
`NotFoundScreen`, `RemoteBoundary` in isolation, and seven of the nine
context-report configs. The `App.test.tsx` "remote down" stderr output
(`Error: remote unavailable (unit test stub)` … "React will try to recreate
this component tree … RemoteErrorBoundary") is expected noise from the stub,
not a failure.

Run one file or watch mode:

```bash
npx vitest run src/features/floor/FloorScreen.test.tsx
npm run test:watch
```

## Playwright smoke scripts (manual)

Both scripts drive headless Chromium against `http://localhost:5173`, so start
`npm run dev` first (with a `public/config.json`, see
[Getting started](../overview/getting-started.md#runtime-configuration-configjson)).
Both exit `1` on any collected error.

- **`npm run verify:routes`** visits `/`, `/order-lifecycle`, `/contexts`,
  `/wms-dashboard`, `/wes-dashboard`, the remote routes `/order-management`,
  `/inventory`, `/planning`, `/fulfillment`, `/workforce`, `/facility`,
  `/process-path`, `/labor`, `/capacity`, `/product-master`,
  `/network-inventory`, `/inbound-receiving`, and `/no-such-screen` (must show
  "Page not found"). On each it asserts the expected text, that the nav still
  renders, and records page errors and failed requests. It then clicks the
  Contexts nav link and fails on a full document navigation. It needs every
  listed remote's dev server and the APIs at `apiOrigin`. `/network-fulfillment`
  and `/reports/:context` are not in its list.
- **`npm run verify:dashboards`** needs only the shell's dev server: it
  intercepts `**/console/reports/wms*` and `**/console/reports/wes*` and
  checks three states — all sections available (charts draw real geometry),
  one section `available: false` (only that card degrades), and a refused
  connection (one dashboard-level error). Screenshots go to `SHOT_DIR`
  (default `/tmp/warehouse-console-dashboards`).

## CI (`.github/workflows/ci.yml`)

Triggers: push and pull request on `develop` and `main`. The Node jobs check
out this repo and `IQVO/warehouse-ui-kit@develop` side by side, build the
ui-kit, then `npm ci` here.

| Job | Runs | When |
|---|---|---|
| `lint` | `npm run lint` | every push/PR |
| `guide-lint` | `guide_lint.py`, `repo_lint.py`, `test_hook.py`, `test_repo_lint.py` | every push/PR |
| `test` | `npm test` | every push/PR |
| `typecheck` | `npm run typecheck` | every push/PR |
| `build` | `npm run build` | every push/PR |
| `docs` | in `docs/`: `npm ci`, `npm run typecheck`, `npm run build` (Node 20) | every push/PR |
| `trivy-fs-scan` | Trivy filesystem scan, fails on fixable CRITICAL/HIGH | every push/PR |
| `helm-lint` | `ct lint --charts charts/warehouse-console` | PRs into `main` only |
| `trivy-scan` | builds the image (not pushed), SARIF upload, fails on fixable CRITICAL/HIGH | PRs into `main` only |
| `docker-publish` | builds, pushes, cosign-signs and SBOM-attests `ghcr.io/iqvo/warehouse-console` | push to `main` only |
| `release` | tags the image and git with the next `vX.Y.Z`, packages and pushes the Helm chart to `oci://ghcr.io/iqvo`, creates the GitHub release | push to `main` only, after `docker-publish` |

So on a PR into `develop`, `helm-lint`, `trivy-scan`, `docker-publish` and
`release` show as skipped by design.

Other workflows: `codeql.yml` (push/PR on `main` and `develop`),
`scorecard.yml` (push to `develop` and a schedule), `docs.yml` (builds and
deploys GitHub Pages on push to `main` touching `docs/**`; it has no
`pull_request` trigger, which is why `ci.yml`'s `docs` job exists), and
`ai-review.yml` (PRs into `develop` touching `internal/domain/**`,
`internal/application/**`, `apis/**` or `charts/**`; only `charts/` exists in
this repo, and it is a no-op without the `ANTHROPIC_API_KEY` secret).

## Agent harness (`scripts/harness/`)

| Script | Purpose |
|---|---|
| `guide_lint.py` | checks `.claude/skills/*/SKILL.md` frontmatter, `.claude/rules` `paths:`, that backticked paths, `make` targets and ADR numbers cited by CLAUDE.md / `.claude/**` exist, and the always-loaded context budget |
| `repo_lint.py` | configuration sensors R1–R7: workflow paths and `needs:`, Dependabot directories (no npm entry for the `file:../warehouse-ui-kit` tree), stale owners, template placeholders, Dependabot coverage, workflow script paths |
| `hook.py` / `test_hook.py` | the runtime-agnostic agent pre/post/stop hook and its unit tests |
| `test_repo_lint.py` | unit tests for `repo_lint.py` |
| `fleet_drift.py` | fails when `.claude/rules/fleet/*.md` differ from the canonical copy in IQVO/warehouse-docs (not wired into `ci.yml`) |
| `red_issue.py` | turns a failing scheduled sensor into an issue (not wired into `ci.yml`) |

When you move or rename a docs page, grep `.claude/` for its path first:
`guide-lint` fails the PR if a guide still cites the old path.
