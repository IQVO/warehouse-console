import { lazy } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AppShell, NavigationProvider, type NavItem } from "@warehouse/ui-kit";
import { FloorScreen } from "./features/floor/FloorScreen";
import { ContextsScreen } from "./features/contexts/ContextsScreen";
import { OrderLifecycleScreen } from "./features/order-lifecycle/OrderLifecycleScreen";
import { WmsDashboardScreen } from "./features/wms-dashboard/WmsDashboardScreen";
import { WesDashboardScreen } from "./features/wes-dashboard/WesDashboardScreen";
import { NotFoundScreen } from "./features/not-found/NotFoundScreen";
import { ContextReportRouteScreen } from "./features/context-reports/ContextReportRouteScreen";
import { RemoteBoundary } from "./shell/RemoteBoundary";
import { RouterLink } from "./shell/RouterLink";

/**
 * Five destinations, not ten.
 *
 * The nav previously listed every screen in the product AND the landing
 * page repeated all of them as launchpad tiles -- two competing navigation
 * surfaces, with ten items crammed into a fixed 56px bar at 13px.
 *
 * The eight bounded-context remotes now live behind "Contexts", which is
 * where the launchpad moved. Their routes are unchanged, so existing deep
 * links and bookmarks keep working.
 */
const NAV: Omit<NavItem, "active">[] = [
  { id: "floor", label: "Floor", href: "/" },
  { id: "order-lifecycle", label: "Order Lifecycle", href: "/order-lifecycle" },
  { id: "wms-dashboard", label: "WMS Dashboard", href: "/wms-dashboard" },
  { id: "wes-dashboard", label: "WES Dashboard", href: "/wes-dashboard" },
  { id: "contexts", label: "Contexts", href: "/contexts" },
];

/** Remote route prefixes. They are not nav items any more, but "Contexts"
 *  must still light up while one of them is open. */
const REMOTE_PREFIXES = [
  "/order-management",
  "/inventory",
  "/planning",
  "/fulfillment",
  "/workforce",
  "/facility",
  "/process-path",
  "/labor",
  "/network-fulfillment",
];

// Each lazy() call MUST run exactly once, at module load, not inside a
// component render -- otherwise React remounts the remote (re-triggering
// its Module Federation fetch and losing its internal state) on every
// Shell re-render, which happens on every navigation via useLocation.
// See RemoteBoundary's doc comment for the full rationale.
/* eslint-disable react-refresh/only-export-components */
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const OrdersRemote = lazy(() => import("order_mgmt_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const InventoryRemote = lazy(() => import("inventory_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const PlanningRemote = lazy(() => import("planning_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const FulfillmentRemote = lazy(() => import("fulfillment_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const WorkforceRemote = lazy(() => import("workforce_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const FacilityRemote = lazy(() => import("facility_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const ProcessPathRemote = lazy(() => import("process_path_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const LaborRemote = lazy(() => import("labor_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const NetworkFulfillmentRemote = lazy(() => import("network_fulfillment_mfe/App"));
/* eslint-enable react-refresh/only-export-components */

/** Anchored prefix match: a bare startsWith would light up "Inventory"
 *  for a hypothetical /inventory-audit route. */
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function Shell() {
  const location = useLocation();
  const nav: NavItem[] = NAV.map((item) => ({
    ...item,
    active:
      item.href === "/"
        ? location.pathname === "/"
        : item.id === "contexts"
          ? // Contexts owns the eight remote routes as well as its own,
            // plus every per-context /reports/<context> detail screen.
            location.pathname.startsWith("/contexts") ||
            location.pathname.startsWith("/reports") ||
            REMOTE_PREFIXES.some((p) => isUnder(location.pathname, p))
          : isUnder(location.pathname, item.href),
  }));

  return (
    <AppShell nav={nav}>
      <Routes>
        <Route path="/" element={<FloorScreen />} />
        <Route path="/contexts" element={<ContextsScreen />} />
        <Route path="/order-lifecycle" element={<OrderLifecycleScreen />} />
        <Route path="/wms-dashboard" element={<WmsDashboardScreen />} />
        <Route path="/wes-dashboard" element={<WesDashboardScreen />} />
        <Route
          path="/order-management/*"
          element={<RemoteBoundary label="Orders" component={OrdersRemote} />}
        />
        <Route
          path="/inventory/*"
          element={<RemoteBoundary label="Inventory" component={InventoryRemote} />}
        />
        <Route
          path="/planning/*"
          element={<RemoteBoundary label="Planning" component={PlanningRemote} />}
        />
        <Route
          path="/fulfillment/*"
          element={<RemoteBoundary label="Fulfillment" component={FulfillmentRemote} />}
        />
        <Route
          path="/workforce/*"
          element={<RemoteBoundary label="Workforce" component={WorkforceRemote} />}
        />
        <Route
          path="/facility/*"
          element={<RemoteBoundary label="Facility" component={FacilityRemote} />}
        />
        <Route
          path="/process-path/*"
          element={<RemoteBoundary label="Process Paths" component={ProcessPathRemote} />}
        />
        <Route
          path="/labor/*"
          element={<RemoteBoundary label="Labor Performance" component={LaborRemote} />}
        />
        <Route
          path="/network-fulfillment/*"
          element={
            <RemoteBoundary
              label="Network Fulfillment"
              component={NetworkFulfillmentRemote}
            />
          }
        />
        <Route path="/reports/:context" element={<ContextReportRouteScreen />} />
        {/* Unmatched URLs used to render the chrome around an empty
            <main> -- a blank page with a working nav and no explanation. */}
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <BrowserRouter>
      {/*
        Supplies the ui-kit with this app's router Link. Without it,
        AppShell's nav, KpiStat's drill-downs and every LaunchTile render
        plain <a href> elements, so each click is a full document
        navigation that tears down the SPA and re-downloads every Module
        Federation remoteEntry.js -- defeating the module-scope lazy()
        work below.
      */}
      <NavigationProvider link={RouterLink}>
        <Shell />
      </NavigationProvider>
    </BrowserRouter>
  );
}
