import { useLocation } from "react-router-dom";
import type { NavItem } from "@warehouse/ui-kit";

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

/** Anchored prefix match: a bare startsWith would light up "Inventory"
 *  for a hypothetical /inventory-audit route. */
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The shell's nav items, with `active` derived from the current location.
 *  `remotePrefixes` are the remote route prefixes "Contexts" owns. */
export function useShellNav(remotePrefixes: readonly string[]): NavItem[] {
  const location = useLocation();
  return NAV.map((item) => ({
    ...item,
    active:
      item.href === "/"
        ? location.pathname === "/"
        : item.id === "contexts"
          ? // Contexts owns the eight remote routes as well as its own,
            // plus every per-context /reports/<context> detail screen.
            location.pathname.startsWith("/contexts") ||
            location.pathname.startsWith("/reports") ||
            remotePrefixes.some((p) => isUnder(location.pathname, p))
          : isUnder(location.pathname, item.href),
  }));
}
