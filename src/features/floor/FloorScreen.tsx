import type { ReactElement } from "react";
import { Card, useFetch } from "@warehouse/ui-kit";
import { BFF_BASE_URL } from "../../config";
import { useDocumentTitle } from "../../shell/useDocumentTitle";
import { SEVERITY_RANK, type DailyBrief } from "./types";
import { ExceptionRow } from "./ExceptionRow";
import { LiveIndicator } from "./LiveIndicator";
import { PathCard } from "./PathCard";

/** `/daily-brief` is a pure read across five MCP clients -- safe to poll.
 *  (Never poll wes-work-planning's /telemetry or /rebalance directly:
 *  those publish Kafka events when read.) */
const POLL_MS = 15_000;

/**
 * The Floor: the console's monitor surface.
 *
 * Built entirely on `GET /daily-brief`, a zero-argument, multi-site,
 * multi-path control-tower read model that already existed in
 * warehouse-ops-agent and that nothing in the console used. The old
 * Overview hand-rolled three queue-depth calls and a site count instead,
 * inventing its own alarm thresholds along the way.
 *
 * Two rules govern this screen:
 *
 * 1. Every alarm colour comes from a flag the BACKEND computed
 *    (`overAlarmThreshold`, `understaffed`, correlated `severity`). The
 *    shell contains no thresholds of its own -- deciding when a warehouse
 *    number is bad is domain logic, and ADR-0002 keeps that out of the
 *    shell.
 * 2. A missing reading is rendered as a missing reading. `unavailable[]`
 *    names the upstreams that went quiet, and a null fact shows "—" in
 *    warning tone rather than a calm zero. A supervisor must never read
 *    "0 stuck tasks" when the truth is "we could not ask".
 */
export function FloorScreen(): ReactElement {
  useDocumentTitle("Floor");

  const { data, loading, error, stale, lastUpdatedAt, refetch } =
    useFetch<DailyBrief>(`${BFF_BASE_URL}/daily-brief`, { pollMs: POLL_MS });

  // First load with nothing to show yet.
  if (loading && !data) {
    return (
      <Card title="Reading the floor…">
        <p className="wh-screen-hint" style={{ marginTop: 0 }}>
          Gathering backlog, staffing, queue depth and stuck-task signals
          across every monitored path.
        </p>
      </Card>
    );
  }

  // Failed with no last-good data to fall back on.
  if (error && !data) {
    return (
      <Card title="The floor view is unavailable">
        <div className="wh-screen-error">
          The operations service isn&rsquo;t responding, so no signals could
          be gathered.
        </div>
        <div className="wh-screen-hint">
          Nothing is shown rather than stale or invented numbers.
        </div>
        <button type="button" className="wh-retry" onClick={refetch}>
          Try again
        </button>
      </Card>
    );
  }

  if (!data) return <Card title="No brief available">Nothing to show.</Card>;

  const paths = data.sites.flatMap((site) =>
    site.paths.map((path) => ({ site, path })),
  );
  const exceptions = [...data.openExceptions].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
  const criticals = exceptions.filter((e) => e.severity === "critical").length;
  const warnings = exceptions.filter((e) => e.severity === "warning").length;
  const feedsDown = paths.reduce(
    (n, { path }) => n + (path.unavailable?.length ?? 0),
    0,
  );

  return (
    // data-surface scales the type up for a wall display without forking a
    // single component -- the calibration lives in the kit's tokens.
    <div className="wh-floor" data-surface="monitor">
      <div className="wh-floor__head">
        <div>
          <h1 className="wh-floor__title">Floor</h1>
          <p className="wh-floor__subtitle">
            Every monitored path across every site, and what needs attention
            first.
          </p>
        </div>
        <LiveIndicator
          stale={stale}
          lastUpdatedAt={lastUpdatedAt}
          onRefresh={refetch}
        />
      </div>

      <div className="wh-floor__summary">
        <Summary label="Sites" value={data.sites.length} />
        <Summary label="Paths" value={paths.length} />
        <Summary
          label="Critical"
          value={criticals}
          tone={criticals > 0 ? "critical" : "quiet"}
        />
        <Summary
          label="Warning"
          value={warnings}
          tone={warnings > 0 ? "warning" : "quiet"}
        />
        <Summary
          label="Feeds down"
          value={feedsDown}
          tone={feedsDown > 0 ? "warning" : "quiet"}
        />
      </div>

      <section aria-labelledby="wh-floor-exceptions">
        <h2 className="wh-floor__section-title" id="wh-floor-exceptions">
          Needs attention
        </h2>
        {exceptions.length === 0 ? (
          <Card>
            <span className="wh-screen-hint">
              No correlated exceptions right now.
            </span>
          </Card>
        ) : (
          <ul className="wh-floor__exceptions">
            {exceptions.map((exception, i) => (
              <ExceptionRow
                key={`${exception.siteCode}-${exception.pathId}-${exception.kind}-${i}`}
                exception={exception}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="wh-floor-paths">
        <h2 className="wh-floor__section-title" id="wh-floor-paths">
          Paths
        </h2>
        <div className="wh-floor__paths">
          {paths.map(({ site, path }) => (
            <PathCard
              key={`${site.siteCode}-${path.pathId}`}
              siteCode={site.siteCode}
              path={path}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "critical" | "warning" | "quiet";
}): ReactElement {
  return (
    <div className="wh-floor__summary-item">
      <span
        className={`wh-floor__summary-value${
          tone ? ` wh-floor__summary-value--${tone}` : ""
        }`}
      >
        {value}
      </span>
      <span className="wh-floor__summary-label">{label}</span>
    </div>
  );
}
