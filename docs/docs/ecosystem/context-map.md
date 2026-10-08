---
id: context-map
title: Context map
sidebar_label: Context map
description: Where warehouse-console sits among the bounded-context services and warehouse-ops-agent.
---

# Context map

`warehouse-console` is not a bounded context — it has no domain model, no
aggregates, no persistence. It is the fleet's shared **composition root**:
a Module Federation host plus a thin read layer over `console-bff`.

```mermaid
graph TD
  Console["<b>warehouse-console</b><br/><i>SPA shell — no domain model</i>"]

  OM["order-management<br/><i>Generic/Supporting</i>"]
  IS["inventory-storage<br/><i>WMS · Core</i>"]
  WP["wes-work-planning<br/><i>WES · Core</i>"]
  FE["fulfillment-execution<br/><i>Core</i>"]
  WM["workforce-management<br/><i>Supporting</i>"]
  FL["facility-layout<br/><i>Generic</i>"]
  PP["process-path-management<br/><i>Generic</i>"]
  LP["labor-performance<br/><i>Supporting</i>"]
  CP["warehouse-planning<br/><i>capacity planning</i>"]
  PM["product-master<br/><i>WMS · Supporting</i>"]
  NF["network-fulfillment<br/><i>Supporting</i>"]
  NIP["network-inventory-planning<br/><i>network inventory balancing</i>"]
  OA["warehouse-ops-agent<br/>(console-bff)"]

  Console -->|"hosts order_mgmt_mfe"| OM
  Console -->|"hosts inventory_mfe"| IS
  Console -->|"hosts planning_mfe"| WP
  Console -->|"hosts fulfillment_mfe"| FE
  Console -->|"hosts workforce_mfe"| WM
  Console -->|"hosts facility_mfe"| FL
  Console -->|"hosts process_path_mfe"| PP
  Console -->|"hosts labor_mfe"| LP
  Console -->|"hosts capacity_mfe"| CP
  Console -->|"hosts productmaster_mfe"| PM
  Console -->|"hosts network_fulfillment_mfe"| NF
  Console -->|"hosts nip_mfe"| NIP
  Console -->|"Floor, Order Lifecycle, WMS/WES reports"| OA
  Console -.->|"Contexts badge: GET /queues/PICK/depth"| FE
  Console -.->|"Contexts badge: GET /sites"| FL
```

Solid "hosts" edges are Module Federation hosting; the dotted edges are the
only two REST reads the shell makes to a bounded context directly (the
Contexts launchpad's live badges). Each hosted remote calls its own
context's REST API through Kong; for example `productmaster_mfe` (owned by
IQVO/product-master, `web/`) reads and writes `/api/product-master`, behind
the Product Master tile on the Contexts launchpad. The Bounded Context Report
screens (`/reports/<context>`, `src/features/context-reports/`) read their
contexts' `*-reports` services and are omitted from the diagram.

## Relationship to each remote

For the bounded-context remotes, the relationship is **hosting**:
this shell lazy-loads each remote's independently-built bundle and gives it a
route. The one exception is the Contexts launchpad, which polls two read
endpoints directly for its tile badges: fulfillment-execution's
`GET /queues/PICK/depth` and facility-layout's `GET /sites`. It never reaches into a remote's business logic, and a remote never
reaches into this shell's — the only shared surface is
`@warehouse/ui-kit` (design tokens/components) and the singleton libraries
(`react`, `react-dom`, `react-router-dom`).

## Relationship to `warehouse-ops-agent`

For the cross-cutting screens (Floor via `GET /daily-brief`; Order Lifecycle
and the WMS/WES dashboards via `console-bff`), this shell is a downstream
**Conformist** to `warehouse-ops-agent` — it renders whatever shape the agent
publishes and does not reinterpret domain meaning. See
[Cross-cutting screens](../architecture/cross-cutting-screens.md) and
`warehouse-ops-agent`'s own ADR-0002 and ADR-0003 for why the BFF lives
there rather than as a separate service.

## No shared database, ever

Every cross-service view this shell renders goes through a REST API call at
`<apiOrigin>/api/<context>` (Kong, `http://localhost:8000`, in the kind
cluster) — to `warehouse-ops-agent` for the cross-cutting screens, and to
fulfillment-execution and facility-layout for the two launchpad badges. There is no database this repo
reads from directly, and there never will be.
