import type { ReactElement } from "react";
import { Card, FreshnessBadge, useFetch } from "@warehouse/ui-kit";
import type { ContextReportConfig, ReportFreshness } from "./types";

/**
 * The shared presentational shell for a single bounded context's
 * analytics report screen.
 *
 * Deliberately the shell-owned counterpart to ReportDashboard
 * (src/features/reports/ReportDashboard.tsx): that component renders the
 * console-bff's AGGREGATED, section-oriented envelope across several
 * contexts at once. This one renders exactly ONE context's own,
 * unaggregated `/reports/...` DTO, read directly from that context's own
 * service through Kong -- never through console-bff/ops-agent. Every
 * context's DTO shape is different, so this shell does not attempt a
 * shared row/column schema; it owns only the three degradation states
 * and the freshness badge, and delegates the actual rendering to the
 * config's `renderBody`.
 *
 * Same two failure modes ReportDashboard keeps distinct, mirrored here at
 * the single-context scale:
 *
 *  - The whole report request fails (service down, network error,
 *    unparseable body): nothing true to show, so one error card, and
 *    NEVER a fabricated number to keep the screen looking healthy.
 *  - Freshness fails independently: the report body still renders (it
 *    has its own real numbers), but the badge reads "freshness unknown"
 *    rather than guessing a lag.
 */
export function ContextReportScreen<TDto>({
  config,
}: {
  config: ContextReportConfig<TDto>;
}): ReactElement {
  const { data, loading, error } = useFetch<TDto>(config.reportUrl);
  const freshness = useFetch<ReportFreshness>(config.freshnessUrl);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--wh-space-5)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--wh-space-4)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: "var(--wh-font-size-2xl)", margin: 0 }}>
            {config.title}
          </h1>
          <p style={{ color: "var(--wh-color-text-muted)", marginTop: 4 }}>
            {config.subtitle}
          </p>
        </div>
        <FreshnessBadge lagSeconds={freshness.data?.lagSeconds ?? null} />
      </div>

      {error && (
        <Card title="Report temporarily unavailable">
          <div style={{ color: "var(--wh-color-status-danger)" }}>
            Couldn't reach {config.contextId}'s reports service: {error.message}
          </div>
          <div
            style={{ color: "var(--wh-color-text-muted)", marginTop: "var(--wh-space-2)" }}
          >
            No numbers are shown rather than stale or invented ones. Retry once
            the service is reachable.
          </div>
        </Card>
      )}

      {loading && !data && (
        <Card title="Loading…">
          <div style={{ color: "var(--wh-color-text-muted)" }}>
            Reading the analytical projection from {config.contextId}…
          </div>
        </Card>
      )}

      {data && config.renderBody(data)}
    </div>
  );
}
