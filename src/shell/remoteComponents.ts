import { lazy, type ComponentType } from "react";

/**
 * The one piece of remote registration that cannot be derived from
 * src/remotes-manifest.ts: Vite/Module Federation resolve `import()` at
 * build time, so each remote's specifier must appear as a static string
 * literal. They live here, keyed by the manifest's `name`; the parity test
 * in src/remotes-manifest.test.tsx fails the build if these keys and the
 * manifest ever drift apart.
 *
 * Each lazy() call MUST run exactly once, at module load, not inside a
 * component render -- otherwise React remounts the remote (re-triggering
 * its Module Federation fetch and losing its internal state) on every
 * Shell re-render, which happens on every navigation via useLocation.
 * See RemoteBoundary's doc comment for the full rationale.
 */
/* eslint-disable react-refresh/only-export-components */
export const REMOTE_COMPONENTS: Record<string, ComponentType> = {
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  order_mgmt_mfe: lazy(() => import("order_mgmt_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  inventory_mfe: lazy(() => import("inventory_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  planning_mfe: lazy(() => import("planning_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  fulfillment_mfe: lazy(() => import("fulfillment_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  workforce_mfe: lazy(() => import("workforce_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  facility_mfe: lazy(() => import("facility_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  process_path_mfe: lazy(() => import("process_path_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  labor_mfe: lazy(() => import("labor_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  network_fulfillment_mfe: lazy(() => import("network_fulfillment_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  capacity_mfe: lazy(() => import("capacity_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  productmaster_mfe: lazy(() => import("productmaster_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  nip_mfe: lazy(() => import("nip_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  inbound_mfe: lazy(() => import("inbound_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  slotting_mfe: lazy(() => import("slotting_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  replenishment_mfe: lazy(() => import("replenishment_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  task_interleaving_mfe: lazy(() => import("task_interleaving_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  returns_mfe: lazy(() => import("returns_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  exceptions_mfe: lazy(() => import("exceptions_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  customer_ordering_mfe: lazy(() => import("customer_ordering_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  delivery_promise_mfe: lazy(() => import("delivery_promise_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  last_mile_mfe: lazy(() => import("last_mile_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  linehaul_mfe: lazy(() => import("linehaul_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  node_performance_mfe: lazy(() => import("node_performance_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  node_topology_mfe: lazy(() => import("node_topology_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  offer_availability_mfe: lazy(() => import("offer_availability_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  order_sourcing_mfe: lazy(() => import("order_sourcing_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  shipping_mfe: lazy(() => import("shipping_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  seller_inbound_mfe: lazy(() => import("seller_inbound_mfe/App")),
  // @ts-expect-error -- remote module resolved at runtime by Module Federation
  vendor_connectivity_mfe: lazy(() => import("vendor_connectivity_mfe/App")),
};
/* eslint-enable react-refresh/only-export-components */

/** Looks up a remote's lazy component by manifest `name`; fails fast on a typo. */
export function remoteComponent(name: string): ComponentType {
  const component = REMOTE_COMPONENTS[name];
  if (!component) {
    throw new Error(
      `No lazy component registered for remote "${name}". ` +
        `Add a static import("<name>/App") to src/shell/remoteComponents.ts.`,
    );
  }
  return component;
}
