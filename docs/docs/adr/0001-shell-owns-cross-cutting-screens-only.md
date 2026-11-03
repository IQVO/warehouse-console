---
id: 0001-shell-owns-cross-cutting-screens-only
title: 0001 — The shell owns only cross-cutting screens
sidebar_label: 0001 · Shell owns cross-cutting screens only
description: The primary nav lists five destinations, not ten — the six bounded-context remotes live behind one "Contexts" launchpad instead of each getting a top-level nav slot.
---

# 0001 — The shell owns only cross-cutting screens

**Status:** Accepted

## Context

The console's primary navigation originally listed every screen in the
product as a top-level item — the four cross-cutting screens (Floor, Order
Lifecycle, WMS Dashboard, WES Dashboard) plus one entry per bounded-context
remote (order-management, inventory, planning, fulfillment, workforce,
facility). At the same time, the landing page repeated all of those same six
remotes again as launchpad tiles.

That is two competing navigation surfaces showing the same six destinations,
and it crowded a fixed-height nav bar with ten items at a small type size —
a bar meant to orient a user at a glance instead asked them to scan a dense
list on every page.

The forces:

- **This shell owns no bounded-context business logic.** Each remote
  (`order_mgmt_mfe`, `inventory_mfe`, etc.) is built and deployed by its own
  repo; the shell's job for those six is purely hosting (see
  [Module Federation](../architecture/module-federation.md)). Giving each one
  equal billing with the four screens the shell actually implements blurs
  that distinction in the UI.
- **The four cross-cutting screens are what only this shell can provide** —
  Order Lifecycle and the WMS/WES dashboards don't exist anywhere else in the
  fleet. They are the reason this repo has a nav bar at all, beyond hosting.
- **Existing deep links and bookmarks must keep working.** Any nav
  restructuring could not change the six remotes' own route paths
  (`/order-management`, `/inventory`, `/planning`, `/fulfillment`,
  `/workforce`, `/facility`).

## Decision

The primary nav lists **five destinations**: Floor (`/`), Order Lifecycle,
WMS Dashboard, WES Dashboard, and Contexts. The six bounded-context remotes
no longer get individual top-level nav slots — they live behind "Contexts,"
which is also where the launchpad tiles moved (removing the landing page's
duplicate listing).

"Contexts" lights up as active whenever the current route is `/contexts`
itself, or any of the six remote route prefixes
(`/order-management`, `/inventory`, `/planning`, `/fulfillment`,
`/workforce`, `/facility`) — using an anchored prefix match (`isUnder`), not
a bare `startsWith`, so a hypothetical future route like `/inventory-audit`
would not falsely light up "Contexts" for an unrelated screen.

The six remotes' own route paths are unchanged, so existing deep links and
bookmarks keep working exactly as before.

## Consequences

### Easier

- The nav bar reads as "four things this shell actually builds, plus one
  door into everything else" — matching what the shell actually owns.
- The launchpad exists in exactly one place (behind Contexts) instead of two
  competing surfaces showing the same six links.
- Adding a seventh bounded-context remote in the future does not require
  another top-level nav slot — it is one more tile behind Contexts.

### Harder

- A remote is one extra click away from the nav bar itself (nav → Contexts →
  tile) instead of a single click, which trades discoverability for a
  calmer top-level bar.
- The "Contexts is active" check has to enumerate every remote prefix
  (`REMOTE_ROUTE_PREFIXES`, derived from `src/remotes-manifest.json`) and
  stay in sync if a remote's route changes — a small but real piece of
  bookkeeping the flatter nav didn't need.
