---
paths:
  - "src/features/**"
  - "src/styles/**"
  - "src/test/**"
---
# Cross-cutting screens (why the shell has any UI of its own)

Authoritative how-to: the `add-console-screen` skill. Decision record:
`docs/docs/adr/0001-shell-owns-cross-cutting-screens-only.md`.

- **Floor (`/`)**: built on `warehouse-ops-agent`'s `GET /daily-brief`. Every
  alarm colour comes from a flag the backend computed; the shell has no
  thresholds of its own. A missing reading renders as "—" in warning tone, never a
  calm zero (signal-on-silence). Steady state is monochrome; colour is reserved for
  what a supervisor must act on (`src/styles/screens.css`).
- **Order Lifecycle**: traces one order across order-management -> inventory-storage
  -> wes-work-planning -> fulfillment-execution via `console-bff`, which is hosted
  inside `warehouse-ops-agent` (that repo's records 0002-micro-frontend-console-architecture and
  0003-console-bff-report-dashboards explain why the BFF lives there and the
  report envelope shape).
  The shell is a downstream Conformist: it renders the shape the BFF publishes and
  does not reinterpret domain meaning.
- **WMS/WES dashboards**: one section-oriented envelope per dashboard
  (`GET /console/reports/{wms,wes}?from=&to=`, default trailing 24h), each section
  rendered with the ui-kit chart primitive named by its own `chartKind`. These are
  eventually-consistent projections, so every card carries a `FreshnessBadge`
  (staleness is shown, never hidden). A degraded section arrives as
  `available: false` and renders as one "data unavailable" card without taking the
  dashboard down; only a whole-request failure produces a dashboard-level error.
- **Per-context report screens (`/reports/<context>`)**: read that context's OWN
  `GET /reports/...` endpoint directly, never through console-bff. Each context's
  DTO is genuinely different, so there is deliberately no shared row schema:
  `ContextReportScreen` owns loading/populated/error and the freshness badge, and
  each `*.config.tsx` maps its own DTO onto ui-kit primitives. `REPORT_ROUTES` in
  `src/features/context-reports/registry.ts` is the single list driving routes and
  Contexts-tile links.
- **No shared database, ever**: every cross-service view goes through a REST API.
- Tests: Testing Library + MSW; the shared server has no default handlers and
  unhandled requests fail the test on purpose (`src/test/setup.ts`).
