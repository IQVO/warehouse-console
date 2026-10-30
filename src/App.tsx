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
  "/capacity",
  "/product-master",
  "/network-inventory",
  "/inbound-receiving",
  "/slotting",
  "/pick-face-replenishment",
  "/task-interleaving",
  "/returns-processing",
  "/exception-management",
  "/customer-ordering",
  "/delivery-promise",
  "/last-mile-delivery",
  "/linehaul-transportation",
  "/node-performance",
  "/node-topology",
  "/offer-availability",
  "/order-sourcing",
  "/shipping-and-tracking",
  "/seller-inbound",
  "/vendor-connectivity",
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
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const CapacityRemote = lazy(() => import("capacity_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const ProductMasterRemote = lazy(() => import("productmaster_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const NipRemote = lazy(() => import("nip_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const InboundRemote = lazy(() => import("inbound_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const SlottingRemote = lazy(() => import("slotting_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const ReplenishmentRemote = lazy(() => import("replenishment_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const TaskInterleavingRemote = lazy(() => import("task_interleaving_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const ReturnsRemote = lazy(() => import("returns_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const ExceptionsRemote = lazy(() => import("exceptions_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const CustomerOrderingRemote = lazy(() => import("customer_ordering_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const DeliveryPromiseRemote = lazy(() => import("delivery_promise_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const LastMileRemote = lazy(() => import("last_mile_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const LinehaulRemote = lazy(() => import("linehaul_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const NodePerformanceRemote = lazy(() => import("node_performance_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const NodeTopologyRemote = lazy(() => import("node_topology_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const OfferAvailabilityRemote = lazy(() => import("offer_availability_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const OrderSourcingRemote = lazy(() => import("order_sourcing_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const ShippingRemote = lazy(() => import("shipping_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const SellerInboundRemote = lazy(() => import("seller_inbound_mfe/App"));
// @ts-expect-error -- remote module resolved at runtime by Module Federation
const VendorConnectivityRemote = lazy(() => import("vendor_connectivity_mfe/App"));
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
        <Route
          path="/capacity/*"
          element={<RemoteBoundary label="Capacity Planning" component={CapacityRemote} />}
        />
        <Route
          path="/product-master/*"
          element={<RemoteBoundary label="Product Master" component={ProductMasterRemote} />}
        />
        <Route
          path="/network-inventory/*"
          element={<RemoteBoundary label="Network Inventory" component={NipRemote} />}
        />
        <Route
          path="/inbound-receiving/*"
          element={<RemoteBoundary label="Inbound Receiving" component={InboundRemote} />}
        />
        <Route
          path="/slotting/*"
          element={<RemoteBoundary label="Slotting" component={SlottingRemote} />}
        />
        <Route
          path="/pick-face-replenishment/*"
          element={
            <RemoteBoundary
              label="Pick-Face Replenishment"
              component={ReplenishmentRemote}
            />
          }
        />
        <Route
          path="/task-interleaving/*"
          element={
            <RemoteBoundary
              label="Task Interleaving"
              component={TaskInterleavingRemote}
            />
          }
        />
        <Route
          path="/returns-processing/*"
          element={<RemoteBoundary label="Returns" component={ReturnsRemote} />}
        />
        <Route
          path="/exception-management/*"
          element={
            <RemoteBoundary
              label="Problem Solve"
              component={ExceptionsRemote}
            />
          }
        />
        <Route
          path="/customer-ordering/*"
          element={
            <RemoteBoundary
              label="Customer Ordering"
              component={CustomerOrderingRemote}
            />
          }
        />
        <Route
          path="/delivery-promise/*"
          element={
            <RemoteBoundary
              label="Delivery Promise"
              component={DeliveryPromiseRemote}
            />
          }
        />
        <Route
          path="/last-mile-delivery/*"
          element={
            <RemoteBoundary
              label="Last Mile Delivery"
              component={LastMileRemote}
            />
          }
        />
        <Route
          path="/linehaul-transportation/*"
          element={
            <RemoteBoundary
              label="Linehaul Transportation"
              component={LinehaulRemote}
            />
          }
        />
        <Route
          path="/node-performance/*"
          element={
            <RemoteBoundary
              label="Node Performance"
              component={NodePerformanceRemote}
            />
          }
        />
        <Route
          path="/node-topology/*"
          element={
            <RemoteBoundary
              label="Node Topology"
              component={NodeTopologyRemote}
            />
          }
        />
        <Route
          path="/offer-availability/*"
          element={
            <RemoteBoundary
              label="Offer Availability"
              component={OfferAvailabilityRemote}
            />
          }
        />
        <Route
          path="/order-sourcing/*"
          element={
            <RemoteBoundary
              label="Order Sourcing"
              component={OrderSourcingRemote}
            />
          }
        />
        <Route
          path="/shipping-and-tracking/*"
          element={
            <RemoteBoundary
              label="Shipping & Tracking"
              component={ShippingRemote}
            />
          }
        />
        <Route
          path="/seller-inbound/*"
          element={
            <RemoteBoundary
              label="Seller Inbound"
              component={SellerInboundRemote}
            />
          }
        />
        <Route
          path="/vendor-connectivity/*"
          element={
            <RemoteBoundary
              label="Vendor Connectivity"
              component={VendorConnectivityRemote}
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
