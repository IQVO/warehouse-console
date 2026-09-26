import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { LaunchTile, useFetch } from "@warehouse/ui-kit";
import type { LaunchTileProps } from "@warehouse/ui-kit";
import { SERVICE_BASE_URL } from "../../config";
import { useDocumentTitle } from "../../shell/useDocumentTitle";
import { REPORT_ROUTES } from "../context-reports/registry";

interface QueueDepth {
  taskType: string;
  depth: number;
}

interface Site {
  siteCode: string;
  name: string;
  status: string;
}

const POLL_MS = 30_000;

/**
 * Wraps a LaunchTile with a "View metrics report" link when that context
 * has one in the shared REPORT_ROUTES registry (see
 * features/context-reports/registry.ts). Rendered as a SIBLING footer
 * below the tile, not nested inside it -- LaunchTile is itself an anchor,
 * and nesting an interactive link inside another is invalid HTML and
 * makes the inner link unreachable by click in most browsers.
 *
 * The report screens are shell-owned cross-cutting infrastructure (same
 * reasoning as Order Lifecycle/WMS/WES dashboards above), not remote
 * business UI, so this link stays local to ContextsScreen rather than
 * something a remote would ever need to render for itself.
 */
function ContextTile(props: LaunchTileProps): ReactElement {
  const report = REPORT_ROUTES.find((r) => r.path === props.context);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--wh-space-2)" }}>
      <LaunchTile {...props} />
      {report && (
        <Link
          to={`/reports/${report.path}`}
          style={{
            fontSize: "var(--wh-font-size-xs)",
            color: "var(--wh-color-accent)",
            textDecoration: "none",
          }}
        >
          View metrics report →
        </Link>
      )}
    </div>
  );
}

/**
 * The launchpad, on its own route.
 *
 * It used to sit underneath the landing page's KPI strip, which meant the
 * console shipped two competing navigation surfaces -- a top nav listing
 * every destination and a tile grid listing the same ones again, with the
 * tiles repeating KPI numbers already shown 200px above. SAP Fiori, the
 * pattern the tiles were modelled on, uses a launchpad INSTEAD of a
 * persistent top nav, not alongside it.
 *
 * Here it earns its place: the badges are read at the moment someone is
 * choosing where to go, which is when a live number is decision-relevant.
 */
export function ContextsScreen(): ReactElement {
  useDocumentTitle("Contexts");

  const pick = useFetch<QueueDepth>(
    `${SERVICE_BASE_URL.fulfillmentExecution}/queues/PICK/depth`,
    { pollMs: POLL_MS },
  );
  const sites = useFetch<Site[]>(`${SERVICE_BASE_URL.facilityLayout}/sites`, {
    pollMs: POLL_MS,
  });

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: "var(--wh-font-size-2xl)" }}>
        Bounded contexts
      </h1>
      <p
        style={{
          margin: "var(--wh-space-2) 0 var(--wh-space-5)",
          color: "var(--wh-color-text-muted)",
        }}
      >
        Each context owns and deploys its own screens. This shell only hosts
        them.
      </p>

      <div className="wh-contexts__grid">
        <LaunchTile
          context="cross-service"
          title="Order Lifecycle"
          description="Trace one order's journey across every context, end to end."
          href="/order-lifecycle"
        />
        <LaunchTile
          context="cross-service"
          title="WMS Dashboard"
          description="What & where — order funnel, inventory flow accuracy, catalog growth."
          href="/wms-dashboard"
        />
        <LaunchTile
          context="cross-service"
          title="WES Dashboard"
          description="When & in what order — planning, fulfillment and labor throughput."
          href="/wes-dashboard"
        />
        <ContextTile
          context="order-management"
          title="Orders"
          description="Intake, allocation state, ship-complete policy."
          href="/order-management"
        />
        <ContextTile
          context="inventory-storage"
          title="Inventory"
          description="Usable-inventory lookup, chaotic stow, revocable reservations."
          href="/inventory"
        />
        <ContextTile
          context="wes-work-planning"
          title="Planning"
          description="Continuous release, flow balancing, work-pool telemetry."
          href="/planning"
        />
        <ContextTile
          context="fulfillment-execution"
          title="Fulfillment"
          description="Pick/pack/SLAM task lifecycle, queue depth, station leases."
          badge={pick.data ? `${pick.data.depth} in PICK` : undefined}
          href="/fulfillment"
        />
        <ContextTile
          context="workforce-management"
          title="Workforce"
          description="Staffing gap by path -- planned vs active headcount."
          href="/workforce"
        />
        <ContextTile
          context="facility-layout"
          title="Facility"
          description="Sites, zones, aisles & coded storage slots."
          badge={
            sites.data
              ? `${sites.data.length} site${sites.data.length === 1 ? "" : "s"}`
              : undefined
          }
          href="/facility"
        />
        <ContextTile
          context="process-path-management"
          title="Process Paths"
          description="The fleet's declared process-path catalogue -- define, revise, deactivate."
          href="/process-path"
        />
        <ContextTile
          context="labor-performance"
          title="Labor Performance"
          description="Engineered labor standards, associate scorecards, fleet-wide task-type performance."
          href="/labor"
        />
        <ContextTile
          context="network-fulfillment"
          title="Network Fulfillment"
          description="ACL to an external retail fulfillment network -- inventory advertising, order acknowledgement, shipment confirmation. Observation-only from this console."
          href="/network-fulfillment"
        />
      </div>
    </div>
  );
}
