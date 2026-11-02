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
import { remoteComponent } from "./shell/remoteComponents";
import { REMOTES, REMOTE_ROUTE_PREFIXES } from "./remotes-manifest";

/**
 * Five destinations, not ten.
 *
 * The nav previously listed every screen in the product AND the landing
 * page repeated all of them as launchpad tiles -- two competing navigation
 * surfaces, with ten items crammed into a fixed 56px bar at 13px.
 *
 * The bounded-context remotes now live behind "Contexts", which is where
 * the launchpad moved. Their routes are unchanged, so existing deep links
 * and bookmarks keep working.
 */
const NAV: Omit<NavItem, "active">[] = [
  { id: "floor", label: "Floor", href: "/" },
  { id: "order-lifecycle", label: "Order Lifecycle", href: "/order-lifecycle" },
  { id: "wms-dashboard", label: "WMS Dashboard", href: "/wms-dashboard" },
  { id: "wes-dashboard", label: "WES Dashboard", href: "/wes-dashboard" },
  { id: "contexts", label: "Contexts", href: "/contexts" },
];

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
          ? // Contexts owns the remote routes as well as its own,
            // plus every per-context /reports/<context> detail screen.
            location.pathname.startsWith("/contexts") ||
            location.pathname.startsWith("/reports") ||
            REMOTE_ROUTE_PREFIXES.some((p) => isUnder(location.pathname, p))
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
        {/* Every remote route is generated from src/remotes-manifest.json:
            one entry there registers the federation remote (vite.config.ts),
            this route, the "Contexts" nav prefix and the verify:routes
            smoke check. The lazy component comes from
            src/shell/remoteComponents.ts, keyed by the manifest's name. */}
        {REMOTES.map((remote) => (
          <Route
            key={remote.route}
            path={`${remote.route}/*`}
            element={
              <RemoteBoundary label={remote.label} component={remoteComponent(remote.name)} />
            }
          />
        ))}
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
        work in src/shell/remoteComponents.ts.
      */}
      <NavigationProvider link={RouterLink}>
        <Shell />
      </NavigationProvider>
    </BrowserRouter>
  );
}
